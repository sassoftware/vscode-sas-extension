// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, l10n } from "vscode";

import { WebView } from "../../../panels/WebviewManager";
import {
  browserDownloadMessages,
  createBrowserDownloadLocalizedMessages,
} from "../../../webview/BrowserDownloadMessages";
import { isRecord } from "./BrowserDownloadGuards";

type WebviewMessageHandler = (message: Record<string, unknown>) => void;

export class BrowserDownloadWebview extends WebView {
  public constructor(
    extensionUri: Uri,
    private readonly handleMessage: WebviewMessageHandler,
  ) {
    super(extensionUri, l10n.t(browserDownloadMessages.panelTitle));
  }

  public body(): string {
    return '<div id="browser-download-root"></div>';
  }

  public l10nMessages() {
    return createBrowserDownloadLocalizedMessages((message, args) =>
      args ? l10n.t(message, args) : l10n.t(message),
    );
  }

  public scripts(): string[] {
    return ["BrowserDownloadApp.js"];
  }

  public styles(): string[] {
    return ["BrowserDownloadApp.css"];
  }

  public processMessage(event: Event): void {
    if (isRecord(event)) {
      this.handleMessage(event);
    }
  }
}
