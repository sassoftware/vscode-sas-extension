// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class BrowserDownloadChunkBuffer {
  private buffer: Uint8Array;
  private bufferedBytes = 0;

  public constructor(
    private readonly chunkSize: number,
    private readonly writeChunk: (
      chunk: Uint8Array,
      signal: AbortSignal,
    ) => Promise<void>,
  ) {
    if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
      throw new RangeError("Browser download chunk size must be positive.");
    }
    this.buffer = new Uint8Array(chunkSize);
  }

  public async write(chunk: Uint8Array, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    let offset = 0;
    while (offset < chunk.byteLength) {
      const copied = Math.min(
        this.chunkSize - this.bufferedBytes,
        chunk.byteLength - offset,
      );
      this.buffer.set(
        chunk.subarray(offset, offset + copied),
        this.bufferedBytes,
      );
      this.bufferedBytes += copied;
      offset += copied;
      if (this.bufferedBytes === this.chunkSize) {
        await this.flush(signal);
      }
    }
  }

  public async flush(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.bufferedBytes === 0) {
      return;
    }
    const chunk =
      this.bufferedBytes === this.chunkSize
        ? this.buffer
        : this.buffer.subarray(0, this.bufferedBytes);
    this.buffer = new Uint8Array(this.chunkSize);
    this.bufferedBytes = 0;
    await this.writeChunk(chunk, signal);
  }
}
