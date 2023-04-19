// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { Disposable, Uri, ViewColumn, WebviewPanel, window } from "vscode";

export class WebViewManager {
  public panels: Record<string, WebView> = {};
  private _currentUid: string;

  public render(webview: WebView, uid: string) {
    this._currentUid = uid;
    if (this.panels[uid]) {
      this.panels[uid].display();
      return;
    }

    const panel = window.createWebviewPanel("webView", uid, ViewColumn.One, {
      enableScripts: true,
    });

    this.panels[uid] = webview.withPanel(panel).render();
  }

  public dispose() {
    this.panels[this._currentUid].dispose();
    delete this.panels[this._currentUid];
  }
}

export abstract class WebView {
  protected panel: WebviewPanel;
  private _disposables: Disposable[] = [];

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
