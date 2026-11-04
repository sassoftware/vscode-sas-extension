// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ProgressLocation, Uri, l10n, window } from "vscode";

import { createWriteStream } from "fs";
import type { Writable } from "stream";
import { pipeline } from "stream/promises";

import type { TableDownloadTarget } from "./TableDownloadTarget";
import type { TableExport } from "./types";

export class FileSystemTableDownloadTarget implements TableDownloadTarget {
  public constructor(
    private readonly destination: Uri,
    private readonly createStream: (
      path: string,
    ) => Writable = createWriteStream,
  ) {}

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
        const output = this.createStream(this.destination.fsPath || fileName);
        const controller = new AbortController();
        const cancellation = token.onCancellationRequested(() =>
          controller.abort(new Error(l10n.t("The download was canceled."))),
        );
        let exported: TableExport | undefined;
        try {
          exported = await createExport(controller.signal);
          await pipeline(exported.stream, output, {
            signal: controller.signal,
          });
        } catch (error) {
          output.destroy();
          if (!token.isCancellationRequested) {
            throw error;
          }
        } finally {
          cancellation.dispose();
          await exported?.dispose();
        }
      },
    );
  }
}
