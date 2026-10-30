// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { isRecord } from "./BrowserDownloadGuards";
import { MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES } from "./constants";

export interface BrowserFileWriterMessages {
  unsupportedFilePicker: string;
  selectionCanceled: string;
  selectionFailed: string;
  selectedFileUnavailable: string;
  permissionRevoked: string;
  writerNotOpen: string;
  abortFailed: string;
  invalidBinaryChunk: string;
}

export interface BrowserFileHandle {
  name: string;
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  createWritable(): Promise<BrowserWritableFile>;
}

export interface BrowserWritableFile {
  write(data: Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}

export interface BrowserDownloadClientApi {
  postMessage(message: Record<string, unknown>): void;
}

export interface BrowserFileBrowser {
  crypto: Pick<Crypto, "randomUUID">;
  showSaveFilePicker?: (options: {
    suggestedName: string;
  }) => Promise<BrowserFileHandle>;
}

export type BrowserFileChoice =
  | { kind: "local"; token: string; fileName: string }
  | { kind: "unsupported"; error: string }
  | { kind: "canceled" }
  | { kind: "failed"; error: string };

declare global {
  interface Window {
    showSaveFilePicker?: (options: {
      suggestedName: string;
    }) => Promise<BrowserFileHandle>;
  }
}

interface BrowserWriterTransfer {
  token: string;
  writer: BrowserWritableFile;
}

const errorName = (error: unknown): string | undefined =>
  isRecord(error) && typeof error.name === "string" ? error.name : undefined;

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class BrowserFileWriter {
  private readonly fileHandles = new Map<string, BrowserFileHandle>();
  private readonly writers = new Map<string, BrowserWriterTransfer>();

  public constructor(
    private readonly vscode: BrowserDownloadClientApi,
    private readonly messages: BrowserFileWriterMessages,
    private readonly browser: BrowserFileBrowser = window,
  ) {}

  public isPickerSupported(): boolean {
    return typeof this.browser.showSaveFilePicker === "function";
  }

  public async chooseFile(suggestedName: string): Promise<BrowserFileChoice> {
    const showSaveFilePicker = this.browser.showSaveFilePicker;
    if (!showSaveFilePicker) {
      return {
        kind: "unsupported",
        error: this.messages.unsupportedFilePicker,
      };
    }

    try {
      const selection = showSaveFilePicker.call(this.browser, {
        suggestedName,
      });
      const fileHandle = await selection;
      const token = this.browser.crypto.randomUUID();
      this.fileHandles.set(token, fileHandle);
      return { kind: "local", token, fileName: fileHandle.name };
    } catch (error) {
      if (errorName(error) === "AbortError") {
        return { kind: "canceled" };
      }
      return {
        kind: "failed",
        error: this.messages.selectionFailed.replace("{error}", () =>
          errorText(error),
        ),
      };
    }
  }

  public async handleMessage(message: unknown): Promise<void> {
    if (!isRecord(message) || typeof message.type !== "string") {
      return;
    }

    if (message.type === "abort") {
      await this.abort(message);
      return;
    }

    if (
      message.type !== "open" &&
      message.type !== "write" &&
      message.type !== "finish" &&
      message.type !== "discard"
    ) {
      return;
    }

    let newlyOpenedWriter: BrowserWritableFile | undefined;
    try {
      if (message.type === "open") {
        const { token, transferId } = message;
        if (typeof token !== "string" || typeof transferId !== "string") {
          throw new Error(this.messages.selectedFileUnavailable);
        }
        const fileHandle = this.fileHandles.get(token);
        if (!fileHandle) {
          throw new Error(this.messages.selectedFileUnavailable);
        }
        const permission = await fileHandle.queryPermission({
          mode: "readwrite",
        });
        if (permission !== "granted") {
          throw new Error(this.messages.permissionRevoked);
        }
        newlyOpenedWriter = await fileHandle.createWritable();
        this.writers.set(transferId, {
          writer: newlyOpenedWriter,
          token,
        });
      } else if (message.type === "write") {
        const transfer = this.getTransfer(message.transferId);
        if (
          !(message.data instanceof Uint8Array) ||
          message.byteLength !== message.data.byteLength ||
          message.data.byteLength === 0 ||
          message.data.byteLength > MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES ||
          message.data.byteOffset !== 0 ||
          message.data.buffer.byteLength !== message.data.byteLength
        ) {
          throw new Error(this.messages.invalidBinaryChunk);
        }
        await transfer.writer.write(message.data);
      } else if (message.type === "finish") {
        const transfer = this.writers.get(
          typeof message.transferId === "string" ? message.transferId : "",
        );
        if (!transfer) {
          if (message.commit === false) {
            this.acknowledge(message.requestId);
            return;
          }
          throw new Error(this.messages.writerNotOpen);
        }
        if (message.commit === true) {
          await transfer.writer.close();
        } else {
          await transfer.writer.abort();
        }
        this.writers.delete(String(message.transferId));
        this.fileHandles.delete(transfer.token);
        newlyOpenedWriter = undefined;
      } else {
        if (typeof message.token === "string") {
          const writerEntry = [...this.writers.entries()].find(
            ([, transfer]) => transfer.token === message.token,
          );
          if (writerEntry) {
            const [transferId, transfer] = writerEntry;
            this.writers.delete(transferId);
            this.fileHandles.delete(message.token);
            await transfer.writer.abort();
          }
          this.fileHandles.delete(message.token);
        }
      }
      this.acknowledge(message.requestId);
    } catch (error) {
      const transfer =
        typeof message.transferId === "string"
          ? this.writers.get(message.transferId)
          : undefined;
      const writer = transfer?.writer ?? newlyOpenedWriter;
      let messageText = errorText(error);
      if (writer) {
        if (typeof message.transferId === "string") {
          this.writers.delete(message.transferId);
        }
        try {
          await writer.abort();
        } catch (abortError) {
          messageText += `; ${this.messages.abortFailed.replace("{error}", () =>
            errorText(abortError),
          )}`;
        }
      }
      if (transfer) {
        this.fileHandles.delete(transfer.token);
      }
      this.acknowledge(message.requestId, messageText);
    }
  }

  private getTransfer(transferId: unknown): BrowserWriterTransfer {
    if (typeof transferId !== "string") {
      throw new Error(this.messages.writerNotOpen);
    }
    const transfer = this.writers.get(transferId);
    if (!transfer) {
      throw new Error(this.messages.writerNotOpen);
    }
    return transfer;
  }

  private async abort(message: Record<string, unknown>): Promise<void> {
    if (typeof message.transferId !== "string") {
      return;
    }
    const transfer = this.writers.get(message.transferId);
    if (!transfer) {
      return;
    }
    this.writers.delete(message.transferId);
    this.fileHandles.delete(transfer.token);
    await transfer.writer.abort();
  }

  private acknowledge(requestId: unknown, error?: string): void {
    if (typeof requestId !== "string") {
      return;
    }
    this.vscode.postMessage({
      type: "ack",
      requestId,
      ok: !error,
      error,
    });
  }
}
