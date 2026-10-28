// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { Uri } from "vscode";

import { once } from "events";
import { createWriteStream } from "fs";
import type { Writable } from "stream";
import { finished } from "stream/promises";

export class NodeFileDownloadTarget {
  public constructor(
    private readonly createStream: (
      filePath: string,
    ) => Writable = createWriteStream,
  ) {}

  public async write(
    destination: Uri,
    writeContents: (
      writeChunk: (chunk: Uint8Array, signal: AbortSignal) => Promise<void>,
    ) => Promise<boolean>,
  ): Promise<boolean> {
    const stream = this.createStream(destination.fsPath);
    const streamFinished = finished(stream);
    void streamFinished.catch(() => {});

    try {
      const completed = await writeContents(async (chunk, signal) => {
        signal.throwIfAborted();
        if (!stream.write(chunk)) {
          await once(stream, "drain", { signal });
        }
      });
      stream.end();
      await streamFinished;
      return completed;
    } catch (error) {
      stream.destroy();
      try {
        await streamFinished;
      } catch {
        // Preserve the export or stream error that caused the shutdown.
      }
      throw error;
    }
  }
}
