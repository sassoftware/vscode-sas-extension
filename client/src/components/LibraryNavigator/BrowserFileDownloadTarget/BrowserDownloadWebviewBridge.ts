// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Disposable, ViewColumn, WebviewPanel, l10n, window } from "vscode";

import { randomBytes, randomUUID } from "crypto";

import { createBrowserDownloadWebview } from "./BrowserDownloadWebview";
import type { BrowserDownloadChoice } from "./types";

interface PendingRequest {
  reject: (error: Error) => void;
  resolve: () => void;
}

interface PendingChoice {
  reject: (error: Error) => void;
  resolve: (choice: BrowserDownloadChoice) => void;
}

type WebviewMessage = Record<string, unknown>;

export class BrowserDownloadWebviewBridge implements Disposable {
  private panel?: WebviewPanel;
  private readyPromise?: Promise<void>;
  private resolveReady?: () => void;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly pendingChoices = new Map<string, PendingChoice>();
  private readonly visibleWaiters = new Set<() => void>();
  private readonly closeListeners = new Set<() => void>();
  private visible = false;
  private closed = false;

  public async chooseLocalFile(
    fileName: string,
    tableName: string,
  ): Promise<BrowserDownloadChoice> {
    await this.ensurePanel();
    if (this.pendingChoices.size > 0) {
      throw new Error(
        l10n.t("Another browser file destination choice is already open."),
      );
    }

    const panel = this.panel;
    if (!panel) {
      throw new Error(l10n.t("Browser file download panel is unavailable."));
    }
    panel.title = l10n.t("Download Table: {tableName}", { tableName });
    panel.reveal(ViewColumn.Beside, false);

    const choiceId = randomUUID();
    const result = new Promise<BrowserDownloadChoice>((resolve, reject) => {
      this.pendingChoices.set(choiceId, { resolve, reject });
    });
    const delivered = await panel.webview.postMessage({
      type: "choose",
      choiceId,
      fileName,
    });
    if (!delivered) {
      this.pendingChoices.delete(choiceId);
      throw new Error(
        l10n.t("Could not open the download destination choices."),
      );
    }
    return result;
  }

  public async open(
    token: string,
    transferId: string,
    fileName: string,
  ): Promise<void> {
    await this.request("open", { token, transferId, fileName });
  }

  public async write(
    transferId: string,
    data: Uint8Array,
    signal: AbortSignal,
  ): Promise<void> {
    const maximumChunkSize = 192 * 1024;
    for (let offset = 0; offset < data.byteLength; offset += maximumChunkSize) {
      await this.waitUntilVisible(signal);
      const byteLength = Math.min(maximumChunkSize, data.byteLength - offset);
      const chunk = new Uint8Array(byteLength);
      chunk.set(data.subarray(offset, offset + byteLength));
      await this.request(
        "write",
        {
          transferId,
          data: chunk,
          byteLength,
        },
        signal,
      );
    }
  }

  public async finish(transferId: string, commit: boolean): Promise<void> {
    await this.request("finish", { transferId, commit });
  }

  public async discardDestination(token: string): Promise<void> {
    if (this.panel && !this.closed) {
      await this.request("discard", { token });
    }
  }

  public async setStatus(message: string): Promise<void> {
    await this.panel?.webview.postMessage({ type: "status", message });
  }

  public async waitUntilVisible(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.closed || !this.panel) {
      throw new Error(l10n.t("The download panel was closed."));
    }
    if (this.panel?.visible) {
      this.visible = true;
    }
    if (this.visible) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        this.visibleWaiters.delete(onVisible);
        reject(signal.reason);
      };
      const onVisible = () => {
        signal.removeEventListener("abort", onAbort);
        resolve();
      };
      this.visibleWaiters.add(onVisible);
      signal.addEventListener("abort", onAbort, { once: true });
      if (this.panel?.visible) {
        this.visible = true;
        this.visibleWaiters.delete(onVisible);
        onVisible();
      }
    });
    signal.throwIfAborted();
    if (this.closed) {
      throw new Error(l10n.t("The download panel was closed."));
    }
  }

  public onDidClose(listener: () => void): Disposable {
    this.closeListeners.add(listener);
    return new Disposable(() => this.closeListeners.delete(listener));
  }

  public dispose(): void {
    this.panel?.dispose();
    this.panel = undefined;
    this.rejectPending(
      new Error(l10n.t("Browser file download was disposed.")),
    );
  }

  private async ensurePanel(): Promise<void> {
    if (!this.panel) {
      this.createPanel();
    }

    await this.readyPromise;
  }

  private createPanel(): void {
    const panel = window.createWebviewPanel(
      "sasBrowserFileDownload",
      l10n.t("Download Table"),
      { viewColumn: ViewColumn.Beside, preserveFocus: false },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    this.panel = panel;
    this.closed = false;
    this.readyPromise = new Promise<void>((resolve) => {
      this.resolveReady = resolve;
    });
    panel.webview.onDidReceiveMessage((message: WebviewMessage) =>
      this.onMessage(message),
    );
    this.visible = panel.visible;
    panel.onDidChangeViewState((event) => {
      this.visible = event.webviewPanel.visible;
      if (this.visible) {
        for (const waiter of this.visibleWaiters) {
          waiter();
        }
        this.visibleWaiters.clear();
      }
    });
    panel.onDidDispose(() => {
      if (this.panel === panel) {
        this.panel = undefined;
        this.readyPromise = undefined;
        const error = new Error(
          l10n.t("Browser file download panel was closed."),
        );
        for (const pending of this.pending.values()) {
          pending.reject(error);
        }
        this.pending.clear();
        for (const choice of this.pendingChoices.values()) {
          choice.resolve({ kind: "cancelled" });
        }
        this.pendingChoices.clear();
        this.visible = false;
        this.closed = true;
        for (const listener of this.closeListeners) {
          listener();
        }
        this.closeListeners.clear();
        for (const waiter of this.visibleWaiters) {
          waiter();
        }
        this.visibleWaiters.clear();
      }
    });

    const nonce = randomBytes(16).toString("base64");
    panel.webview.html = createBrowserDownloadWebview(nonce);
  }

  private async request(
    type: "open" | "write" | "finish" | "discard" | "abort",
    data: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<void> {
    const panel = this.panel;
    if (!panel || this.closed) {
      throw new Error(l10n.t("Browser file download panel is unavailable."));
    }

    const requestId = randomUUID();
    let abort: (() => void) | undefined;
    const response = new Promise<void>((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      if (signal) {
        abort = () => {
          this.pending.delete(requestId);
          reject(signal.reason);
          if (type === "write" && typeof data.transferId === "string") {
            void this.panel?.webview.postMessage({
              type: "abort",
              transferId: data.transferId,
            });
          }
        };
        signal.addEventListener("abort", abort, { once: true });
      }
    });
    let delivered: boolean;
    try {
      delivered = await panel.webview.postMessage({
        ...data,
        requestId,
        type,
      });
    } catch (error) {
      this.pending.delete(requestId);
      if (abort) {
        signal.removeEventListener("abort", abort);
      }
      throw error;
    }
    if (!delivered) {
      this.pending.delete(requestId);
      if (abort) {
        signal.removeEventListener("abort", abort);
      }
      throw new Error(l10n.t("Could not deliver a browser download chunk."));
    }
    try {
      await response;
    } finally {
      if (abort) {
        signal.removeEventListener("abort", abort);
      }
    }
  }

  private onMessage(event: WebviewMessage): void {
    if (event.type === "ready") {
      this.resolveReady?.();
      this.resolveReady = undefined;
      return;
    }

    if (event.type === "destination" && typeof event.choiceId === "string") {
      const pendingChoice = this.pendingChoices.get(event.choiceId);
      if (!pendingChoice) {
        return;
      }
      this.pendingChoices.delete(event.choiceId);
      if (event.kind === "unsupported") {
        pendingChoice.resolve({ kind: "unsupported" });
        this.panel?.dispose();
        return;
      }
      if (
        event.kind === "local" &&
        typeof event.token === "string" &&
        typeof event.fileName === "string"
      ) {
        pendingChoice.resolve({
          kind: "local",
          token: event.token,
          fileName: event.fileName,
        });
      } else {
        pendingChoice.resolve({ kind: "cancelled" });
        this.panel?.dispose();
      }
      return;
    }

    if (event.type !== "ack" || typeof event.requestId !== "string") {
      return;
    }

    const pending = this.pending.get(event.requestId);
    if (!pending) {
      return;
    }
    this.pending.delete(event.requestId);
    if (event.ok === true) {
      pending.resolve();
    } else {
      pending.reject(
        new Error(
          typeof event.error === "string"
            ? event.error
            : l10n.t("Browser file operation failed."),
        ),
      );
    }
  }

  private rejectPending(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }
    this.pending.clear();
    for (const choice of this.pendingChoices.values()) {
      choice.reject(error);
    }
    this.pendingChoices.clear();
  }
}
