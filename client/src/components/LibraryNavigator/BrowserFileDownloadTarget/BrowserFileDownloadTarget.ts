// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { Disposable } from "vscode";

import { BrowserDownloadWebviewBridge } from "./BrowserDownloadWebviewBridge";
import type { BrowserDownloadChoice } from "./types";

export type { BrowserDownloadChoice } from "./types";

export class BrowserFileDownloadTarget implements Disposable {
  private readonly bridge = new BrowserDownloadWebviewBridge();

  public async chooseLocalFile(
    fileName: string,
    tableName: string,
  ): Promise<BrowserDownloadChoice> {
    return this.bridge.chooseLocalFile(fileName, tableName);
  }

  public async setStatus(message: string): Promise<void> {
    await this.bridge.setStatus(message);
  }

  public async open(
    token: string,
    transferId: string,
    fileName: string,
  ): Promise<void> {
    await this.bridge.open(token, transferId, fileName);
  }

  public async write(
    transferId: string,
    data: Uint8Array,
    signal: AbortSignal,
  ): Promise<void> {
    await this.bridge.write(transferId, data, signal);
  }

  public async finish(transferId: string, commit: boolean): Promise<void> {
    await this.bridge.finish(transferId, commit);
  }

  public async waitUntilVisible(signal: AbortSignal): Promise<void> {
    await this.bridge.waitUntilVisible(signal);
  }

  public onDidClose(listener: () => void): Disposable {
    return this.bridge.onDidClose(listener);
  }

  public async discardDestination(token: string): Promise<void> {
    await this.bridge.discardDestination(token);
  }

  public dispose(): void {
    this.bridge.dispose();
  }
}
