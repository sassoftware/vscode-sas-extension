// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, env, l10n } from "vscode";

import { randomBytes, timingSafeEqual } from "crypto";
import { createServer } from "http";

import LibraryDataProvider from "./LibraryDataProvider";
import { LibraryItem } from "./types";

const DOWNLOAD_TOKEN_BYTES = 24; // 192-bit token
const MAX_DOWNLOAD_FILENAME_LENGTH = 250;
const BROWSER_CONNECTION_TIMEOUT_MS = 60_000;
const DOWNLOAD_ENDPOINT_PATH = "/sas-library-download";
const DOWNLOAD_TOKEN_PARAM = "token";
const DEFAULT_DOWNLOAD_FILENAME = "table.csv";

export function isValidDownloadToken(
  candidate: string | null,
  token: string,
): boolean {
  if (!candidate || candidate.length !== token.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(candidate), Buffer.from(token));
}

export function sanitizeDownloadFilename(
  fileName: string,
  maxLength: number,
  fallback: string,
): string {
  // Preserve Unicode while removing only dangerous characters
  return (
    fileName
      .trim()
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f"\r\n]/g, "") // Remove control chars + quotes
      .replace(/\.\.+/g, ".") // Collapse multiple dots (path traversal)
      .replace(/^\.+/, "") // Remove leading dots
      .slice(0, maxLength) || fallback
  );
}

export type DownloadRequestOutcome =
  | { readonly outcome: 405 }
  | { readonly outcome: 410 }
  | { readonly outcome: 404 }
  | { readonly outcome: "stream" };

export function classifyDownloadRequest(
  method: string | undefined,
  url: string | undefined,
  token: string,
  endpointPath: string,
  tokenParam: string,
  requestLock: boolean,
): DownloadRequestOutcome {
  if (method !== "GET") {
    return { outcome: 405 };
  }
  if (requestLock) {
    return { outcome: 410 };
  }
  const requestUrl = url ? new URL(url, "http://127.0.0.1") : undefined;
  if (
    !requestUrl ||
    requestUrl.pathname !== endpointPath ||
    !isValidDownloadToken(requestUrl.searchParams.get(tokenParam), token)
  ) {
    return { outcome: 404 };
  }
  return { outcome: "stream" };
}

export async function streamTableToBrowserDownload(
  item: LibraryItem,
  fileName: string,
  libraryDataProvider: LibraryDataProvider,
): Promise<void> {
  const token = randomBytes(DOWNLOAD_TOKEN_BYTES).toString("hex");
  const asciiFileName = sanitizeDownloadFilename(
    fileName,
    MAX_DOWNLOAD_FILENAME_LENGTH,
    DEFAULT_DOWNLOAD_FILENAME,
  );
  const encodedFileName = encodeURIComponent(asciiFileName);

  await new Promise<void>((resolve, reject) => {
    let timeoutId: NodeJS.Timeout | undefined;
    let requestLock = false;
    let settled = false;

    const settleResolve = () => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      server.removeListener("error", errorHandler);
      resolve();
    };

    const settleReject = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      server.removeListener("error", errorHandler);
      server.close(() => {});
      reject(error);
    };

    const server = createServer((request, response) => {
      const verdict = classifyDownloadRequest(
        request.method,
        request.url,
        token,
        DOWNLOAD_ENDPOINT_PATH,
        DOWNLOAD_TOKEN_PARAM,
        requestLock,
      );

      if (verdict.outcome !== "stream") {
        response.statusCode = verdict.outcome;
        if (verdict.outcome === 405) {
          response.setHeader("Allow", "GET");
        }
        response.end();
        return;
      }

      requestLock = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }

      response.setHeader("Content-Type", "text/csv; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Pragma", "no-cache");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
      );

      libraryDataProvider
        .writeTableContentsToStream(response, item)
        .then(() => {
          if (!response.writableEnded) {
            response.end();
          }
          settleResolve();
        })
        .catch((error) => {
          if (!response.headersSent) {
            response.statusCode = 500;
            response.setHeader("Content-Type", "text/plain");
            response.end("Download failed");
          } else {
            // Headers already sent - destroy connection to signal error to browser
            response.destroy();
          }
          settleReject(error);
        });
    });

    const errorHandler = (error: Error) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      settleReject(error);
    };

    server.on("error", errorHandler);

    server.listen(0, "127.0.0.1", async () => {
      try {
        const address = server.address();
        if (!address || typeof address === "string") {
          throw new Error(l10n.t("Unable to start download server."));
        }

        // asExternalUri only transforms scheme+host+port — the proxy strips
        // path and query. Resolve just the base, then append path+token.
        const baseLocalUri = Uri.parse(`http://127.0.0.1:${address.port}`);
        const externalBase = await env.asExternalUri(baseLocalUri);
        const externalUri = Uri.parse(
          `${externalBase.toString(true).replace(/\/+$/, "")}${DOWNLOAD_ENDPOINT_PATH}?${DOWNLOAD_TOKEN_PARAM}=${token}`,
        );
        // Timeout guards against the browser never making the request.
        // Once the request arrives and streaming begins, settleResolve()
        // is called from the request handler instead.
        // Arm before openExternal so no window exists between open and guard.
        timeoutId = setTimeout(() => {
          settleReject(
            new Error(
              l10n.t(
                "Timed out waiting for the browser to start the download.",
              ),
            ),
          );
        }, BROWSER_CONNECTION_TIMEOUT_MS);

        const opened = await env.openExternal(externalUri);

        if (!opened) {
          throw new Error(l10n.t("Failed to open browser download URL."));
        }
      } catch (error) {
        server.close();
        settleReject(error);
      }
    });
  });
}
