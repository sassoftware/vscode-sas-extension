// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ProgressLocation, l10n, window } from "vscode";

import { randomUUID } from "crypto";

import { BrowserDownloadChunkBuffer } from "./BrowserFileDownloadTarget/BrowserDownloadChunkBuffer";
import { BrowserFileDownloadTarget } from "./BrowserFileDownloadTarget/BrowserFileDownloadTarget";
import { MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES } from "./BrowserFileDownloadTarget/constants";
import type { TableDownloadTarget } from "./TableDownloadTarget";
import type { TableExport } from "./types";

export class BrowserFileTableDownloadTarget implements TableDownloadTarget {
  public constructor(
    private readonly browser: BrowserFileDownloadTarget,
    private readonly destination: { fileName: string; token: string },
  ) {}

  public async download(
    fileName: string,
    createExport: (signal: AbortSignal) => Promise<TableExport>,
  ): Promise<void> {
    const transferId = randomUUID();
    const controller = new AbortController();
    const panelClosed = this.browser.onDidClose(() =>
      controller.abort(new Error(l10n.t("The download panel was closed."))),
    );
    let opened = false;
    let finished = false;
    let exported: TableExport | undefined;
    let canceled = false;
    try {
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: l10n.t("Preparing Table Export"),
          cancellable: true,
        },
        async (_progress, token) => {
          const cancellation = token.onCancellationRequested(() => {
            canceled = true;
            controller.abort(new Error(l10n.t("The download was canceled.")));
          });
          try {
            await this.browser.setStatus(
              l10n.t("Preparing the CSV export..."),
              "notStarted",
            );
            await this.browser.open(
              this.destination.token,
              transferId,
              this.destination.fileName || fileName,
            );
            opened = true;
            await this.browser.setStatus(
              l10n.t("Streaming the CSV to your computer..."),
              "inProgress",
            );
            exported = await createExport(controller.signal);
            const chunkBuffer = new BrowserDownloadChunkBuffer(
              MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES,
              async (chunk, signal) => {
                await this.browser.waitUntilVisible(signal);
                await this.browser.write(transferId, chunk, signal);
              },
            );
            for await (const chunk of exported.stream) {
              await chunkBuffer.write(chunk, controller.signal);
            }
            await chunkBuffer.flush(controller.signal);
            await this.browser.finish(transferId, true);
            finished = true;
            await this.browser.setStatus(
              l10n.t("Download complete. You can close this tab."),
              "completed",
            );
          } finally {
            cancellation.dispose();
          }
        },
      );
    } catch (error) {
      if (opened && !finished) {
        await this.browser.finish(transferId, false).catch(() => undefined);
      }
      if (canceled) {
        await this.browser.setStatus(l10n.t("Download canceled."), "canceled");
      } else if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : String(error);
        await this.browser.setStatus(
          l10n.t("Export failed: {message}", { message }),
          "failed",
        );
        throw error;
      }
    } finally {
      panelClosed.dispose();
      controller.abort();
      if (opened && !finished) {
        await this.browser.finish(transferId, false).catch(() => undefined);
      }
      await this.browser
        .discardDestination(this.destination.token)
        .catch(() => undefined);
      await exported?.dispose();
    }
  }
}
