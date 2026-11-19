// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ProgressLocation, Uri, env, l10n, window } from "vscode";
import type { Disposable } from "vscode";

import { randomUUID } from "crypto";
import { createServer } from "http";
import type { Server } from "http";
import type { RequestListener } from "http";
import { isIP } from "net";
import { pipeline } from "stream/promises";

import type { TableDownloadTarget } from "./TableDownloadTarget";
import type { TableExport } from "./types";

const timeoutMs = 5 * 60 * 1000;

export type HostAttachmentDownloadMode = "external-uri" | "fixed-proxy";

export interface HostAttachmentDownloadConfiguration {
  mode: HostAttachmentDownloadMode;
  listenHost: string;
  listenPort: number;
  externalBaseUrl: string;
}

const defaultConfiguration: HostAttachmentDownloadConfiguration = {
  mode: "external-uri",
  listenHost: "127.0.0.1",
  listenPort: 0,
  externalBaseUrl: "",
};

const environmentVariables = {
  listenHost: "SAS_EXT_PROXY_HOST",
  listenPort: "SAS_EXT_PROXY_PORT",
  externalBaseUrl: "SAS_EXT_PROXY_BASE_URL",
} as const;

type ConfigurationEnvironment = Record<string, string | undefined>;

export function readHostAttachmentDownloadConfiguration(
  environment: ConfigurationEnvironment = typeof process === "undefined"
    ? {}
    : process.env,
): HostAttachmentDownloadConfiguration {
  const proxyValues = [
    environment[environmentVariables.listenHost],
    environment[environmentVariables.listenPort],
    environment[environmentVariables.externalBaseUrl],
  ];
  const configuredProxyValues = proxyValues.filter(
    (value) => value !== undefined,
  );
  if (
    configuredProxyValues.length > 0 &&
    (configuredProxyValues.length !== proxyValues.length ||
      proxyValues.some((value) => value === ""))
  ) {
    throw new Error(
      "SAS_EXT_PROXY_HOST, SAS_EXT_PROXY_PORT, and SAS_EXT_PROXY_BASE_URL must be configured together with non-empty values.",
    );
  }
  const fixedProxyConfigured =
    configuredProxyValues.length === proxyValues.length;
  return {
    mode: fixedProxyConfigured ? "fixed-proxy" : "external-uri",
    listenHost:
      environment[environmentVariables.listenHost] ??
      defaultConfiguration.listenHost,
    listenPort: Number(
      environment[environmentVariables.listenPort] ??
        defaultConfiguration.listenPort,
    ),
    externalBaseUrl:
      environment[environmentVariables.externalBaseUrl] ??
      defaultConfiguration.externalBaseUrl,
  };
}

function validateConfiguration(
  configuration: HostAttachmentDownloadConfiguration,
): HostAttachmentDownloadConfiguration {
  if (!Number.isInteger(configuration.listenPort)) {
    throw new Error("The table download listener port must be an integer.");
  }
  if (
    configuration.listenPort < 0 ||
    configuration.listenPort > 65535 ||
    (configuration.mode === "fixed-proxy" && configuration.listenPort === 0)
  ) {
    throw new Error("The table download listener port is invalid.");
  }
  if (
    !configuration.listenHost ||
    /\s/.test(configuration.listenHost) ||
    (isIP(configuration.listenHost) === 0 &&
      !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(
        configuration.listenHost,
      ))
  ) {
    throw new Error("The table download listener host is required.");
  }
  if (
    configuration.mode !== "external-uri" &&
    configuration.mode !== "fixed-proxy"
  ) {
    throw new Error("The table download route mode is invalid.");
  }
  if (configuration.mode === "fixed-proxy") {
    if (!configuration.externalBaseUrl) {
      throw new Error(
        "A public HTTPS base URL is required for the fixed-proxy table download route.",
      );
    }
    let url: URL;
    try {
      url = new URL(configuration.externalBaseUrl);
    } catch {
      throw new Error("The fixed-proxy table download URL is invalid.");
    }
    if (url.protocol !== "https:") {
      throw new Error("The fixed-proxy table download URL must use HTTPS.");
    }
    if (url.username || url.password || url.hash) {
      throw new Error(
        "The fixed-proxy table download URL cannot contain credentials or a fragment.",
      );
    }
    if (url.search) {
      throw new Error(
        "The fixed-proxy table download URL cannot contain query parameters.",
      );
    }
    if (
      url.pathname
        .split("/")
        .some((segment) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(segment))
    ) {
      throw new Error(
        "The fixed-proxy table download URL cannot contain a transfer token.",
      );
    }
    return { ...configuration, externalBaseUrl: url.toString() };
  }
  return configuration;
}

function waitFor<T>(
  operation: PromiseLike<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const removeAbortListener = () =>
      signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      removeAbortListener();
      reject(signal.reason ?? new Error("The download was canceled."));
    };

    if (signal.aborted) {
      onAbort();
      return;
    }

    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(operation).then(
      (value) => {
        removeAbortListener();
        resolve(value);
      },
      (error: unknown) => {
        removeAbortListener();
        reject(error);
      },
    );
  });
}

function closeServer(server: Server): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

interface PublishedRoute {
  server: Server;
  url: Uri;
}

interface RoutePublication {
  publish(token: string, handler: RequestListener): Promise<PublishedRoute>;
}

class ExternalUriRoutePublication implements RoutePublication {
  public constructor(
    private readonly configuration: HostAttachmentDownloadConfiguration,
    private readonly signal: AbortSignal,
  ) {}

  public async publish(
    token: string,
    handler: RequestListener,
  ): Promise<PublishedRoute> {
    const server = createServer(handler);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, this.configuration.listenHost, resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("The download server did not start correctly.");
    }
    const base = await waitFor(
      env.asExternalUri(Uri.parse(`http://localhost:${address.port}/`)),
      this.signal,
    );
    return {
      server,
      url: base.with({
        path: `${base.path.replace(/\/+$/, "")}/${token}`,
        query: addTokenQuery(base.query, token),
      }),
    };
  }
}

class FixedProxyRoutePublication implements RoutePublication {
  public constructor(
    private readonly configuration: HostAttachmentDownloadConfiguration,
  ) {}

  public async publish(
    token: string,
    handler: RequestListener,
  ): Promise<PublishedRoute> {
    const server = createServer(handler);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(
        this.configuration.listenPort,
        this.configuration.listenHost,
        resolve,
      );
    });
    const base = Uri.parse(this.configuration.externalBaseUrl);
    return {
      server,
      url: base.with({
        path: `${base.path.replace(/\/+$/, "")}/${token}`,
        query: addTokenQuery(base.query, token),
      }),
    };
  }
}

function addTokenQuery(query: string, token: string): string {
  const parameters = new URLSearchParams(query);
  parameters.set("token", token);
  return parameters.toString();
}

export class HostAttachmentDownloadTarget
  implements Disposable, TableDownloadTarget
{
  private servers = new Set<Server>();
  private controllers = new Set<AbortController>();
  private readonly configuration: HostAttachmentDownloadConfiguration;

  public constructor(
    configuration: Partial<HostAttachmentDownloadConfiguration> = {},
  ) {
    this.configuration = validateConfiguration({
      ...defaultConfiguration,
      ...readHostAttachmentDownloadConfiguration(),
      ...configuration,
    });
  }

  public async download(
    fileName: string,
    createExport: (signal: AbortSignal) => Promise<TableExport>,
  ): Promise<void> {
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t("Preparing Table Export"),
        cancellable: true,
      },
      async (_progress, token) => {
        const controller = new AbortController();
        this.controllers.add(controller);
        const cancelSubscription = token.onCancellationRequested(() =>
          controller.abort(new Error("The download was canceled.")),
        );
        let server: Server | undefined;
        let exported: TableExport | undefined;
        let transfer: Promise<void> | undefined;
        let clientDisconnected = false;
        const browserDisconnectError = new Error(
          "The browser closed the download.",
        );
        let resolveCompleted!: () => void;
        let rejectCompleted!: (error: unknown) => void;
        const completed = new Promise<void>((resolve, reject) => {
          resolveCompleted = resolve;
          rejectCompleted = reject;
        });
        void completed.catch(() => undefined);
        const timeout = setTimeout(
          () => controller.abort(new Error("The table download timed out.")),
          timeoutMs,
        );

        try {
          const downloadToken = randomUUID();
          let claimed = false;
          const route =
            this.configuration.mode === "fixed-proxy"
              ? new FixedProxyRoutePublication(this.configuration)
              : new ExternalUriRoutePublication(
                  this.configuration,
                  controller.signal,
                );
          const routeHandler = (
            request: Parameters<RequestListener>[0],
            response: Parameters<RequestListener>[1],
          ) => {
            const requestUrl = new URL(request.url ?? "/", "http://localhost");
            const pathToken = requestUrl.pathname
              .split("/")
              .filter(Boolean)
              .at(-1);
            const queryToken = requestUrl.searchParams.get("token");
            if (
              request.method !== "GET" ||
              (pathToken !== downloadToken && queryToken !== downloadToken)
            ) {
              response.writeHead(404).end();
              return;
            }
            if (claimed) {
              response.writeHead(410).end();
              return;
            }
            if (!exported) {
              response.writeHead(503).end();
              rejectCompleted(new Error("The table export is not ready."));
              return;
            }

            claimed = true;
            response.once("close", () => {
              if (!response.writableFinished) {
                clientDisconnected = true;
                controller.abort(browserDisconnectError);
              }
            });
            response.writeHead(200, {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": `attachment; filename="${fileName.replace(/[\r\n"\\]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            });
            transfer = pipeline(exported.stream, response, {
              signal: controller.signal,
            });
            void transfer.then(resolveCompleted, rejectCompleted);
          };
          const published = await route.publish(downloadToken, routeHandler);
          server = published.server;
          this.servers.add(server);
          server.on("error", (error) => {
            controller.abort(error);
            rejectCompleted(error);
          });
          const externalUri = published.url;

          exported = await waitFor(
            createExport(controller.signal),
            controller.signal,
          );
          if (
            !(await waitFor(env.openExternal(externalUri), controller.signal))
          ) {
            throw new Error("VS Code could not open the browser download.");
          }
          await waitFor(completed, controller.signal);
        } catch (error) {
          const browserCanceled =
            clientDisconnected &&
            (error === browserDisconnectError ||
              (error instanceof Error && error.name === "AbortError"));
          if (!token.isCancellationRequested && !browserCanceled) {
            throw error;
          }
        } finally {
          clearTimeout(timeout);
          cancelSubscription.dispose();
          controller.abort();
          server?.closeAllConnections();
          await transfer?.catch(() => undefined);
          try {
            if (server) {
              await closeServer(server);
            }
          } finally {
            if (server) {
              this.servers.delete(server);
            }
            try {
              if (exported) {
                await exported.dispose();
              }
            } finally {
              this.controllers.delete(controller);
            }
          }
        }
      },
    );
  }

  public dispose(): void {
    this.controllers.forEach((controller) => controller.abort());
    this.servers.forEach((server) => server.closeAllConnections());
    this.controllers.clear();
    this.servers.clear();
  }
}
