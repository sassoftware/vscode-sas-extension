// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Disposable, Uri, ViewColumn, WebviewPanel, window } from "vscode";

export class WebViewManager {
  public panels: Record<string, WebView> = {};

  public render(webview: WebView, uid: string) {
    if (this.panels[uid]) {
      this.panels[uid].display();
      return;
    }

    const panel = window.createWebviewPanel("webView", uid, ViewColumn.One, {
      enableScripts: true,
    });

    webview.onDispose = () => delete this.panels[uid];
    this.panels[uid] = webview.withPanel(panel).render();
  }
}

export abstract class WebView {
  protected panel: WebviewPanel;
  private _disposables: Disposable[] = [];
  private _onDispose: () => void;

  set onDispose(disposeCallback: () => void) {
    this._onDispose = disposeCallback;
  }

  abstract render(): WebView;
  abstract processMessage(event: Event): void;

  public withPanel(webviewPanel: WebviewPanel): WebView {
    this.panel = webviewPanel;
    this.panel.onDidDispose(() => this.dispose(), null, this._disposables);
    this.panel.webview.onDidReceiveMessage(this.processMessage.bind(this));

    return this;
  }

  public dispose() {
    this.panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
    this._onDispose && this._onDispose();
  }

  public display() {
    this.panel.reveal(ViewColumn.One);
  }

  public webviewUri(extensionUri: Uri, name: string): Uri {
    return this.panel.webview.asWebviewUri(
      Uri.joinPath(extensionUri, "client", "dist", "webview", `${name}.js`)
    );
  }
}
