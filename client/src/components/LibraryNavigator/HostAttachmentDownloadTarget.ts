// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ProgressLocation, Uri, env, l10n, window, workspace } from "vscode";
import type { Disposable } from "vscode";

import { randomUUID } from "crypto";
import { createServer } from "http";
import type { Server } from "http";
import { pipeline } from "stream/promises";

import type { TableExport } from "./types";

const timeoutMs = 5 * 60 * 1000;

export type HostAttachmentDownloadMode = "external-uri" | "fixed-proxy";

export interface HostAttachmentDownloadConfiguration {
  mode: HostAttachmentDownloadMode;
  listenHost: string;
  listenPort: number;
  externalBaseUrl: string;
  authentication: "deployment" | "none";
}

const defaultConfiguration: HostAttachmentDownloadConfiguration = {
  mode: "external-uri",
  listenHost: "127.0.0.1",
  listenPort: 0,
  externalBaseUrl: "",
  authentication: "none",
};

function readConfiguration(): HostAttachmentDownloadConfiguration {
  const configuration = workspace.getConfiguration("SAS.tableDownload");
  return {
    mode: configuration.get("hostAttachment.mode", "external-uri"),
    listenHost: configuration.get("hostAttachment.listenHost", "127.0.0.1"),
    listenPort: configuration.get("hostAttachment.listenPort", 0),
    externalBaseUrl: configuration.get("hostAttachment.externalBaseUrl", ""),
    authentication: configuration.get("hostAttachment.authentication", "none"),
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
  if (!configuration.listenHost) {
    throw new Error("The table download listener host is required.");
  }
  if (
    configuration.mode !== "external-uri" &&
    configuration.mode !== "fixed-proxy"
  ) {
    throw new Error("The table download route mode is invalid.");
  }
  if (
    configuration.authentication !== "deployment" &&
    configuration.authentication !== "none"
  ) {
    throw new Error("The table download authentication mode is invalid.");
  }
  if (configuration.mode === "fixed-proxy") {
    if (configuration.authentication !== "deployment") {
      throw new Error(
        "The fixed-proxy table download route requires deployment authentication.",
      );
    }
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

export class HostAttachmentDownloadTarget implements Disposable {
  private servers = new Set<Server>();
  private controllers = new Set<AbortController>();
  private readonly configuration: HostAttachmentDownloadConfiguration;

  public constructor(
    configuration: Partial<HostAttachmentDownloadConfiguration> = {},
  ) {
    this.configuration = validateConfiguration({
      ...defaultConfiguration,
      ...readConfiguration(),
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
          server = createServer((request, response) => {
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
          });
          this.servers.add(server);
          server.on("error", (error) => {
            controller.abort(error);
            rejectCompleted(error);
          });
          await new Promise<void>((resolve, reject) => {
            server?.once("error", reject);
            const { listenHost, listenPort } = this.configuration;
            server?.listen(
              this.configuration.mode === "fixed-proxy" ? listenPort : 0,
              listenHost,
              resolve,
            );
          });

          const address = server.address();
          if (!address || typeof address === "string") {
            throw new Error("The download server did not start correctly.");
          }
          const externalBase =
            this.configuration.mode === "fixed-proxy"
              ? Uri.parse(this.configuration.externalBaseUrl)
              : await waitFor(
                  env.asExternalUri(
                    Uri.parse(`http://localhost:${address.port}/`),
                  ),
                  controller.signal,
                );
          const query = new URLSearchParams(externalBase.query);
          query.set("token", downloadToken);
          const externalUri = externalBase.with({
            path: `${externalBase.path.replace(/\/+$/, "")}/${downloadToken}`,
            query: query.toString(),
          });

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
