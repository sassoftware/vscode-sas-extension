// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { Uri } from "vscode";
import { sprintf } from "sprintf-js";
import html from "../webview/DataViewer/view.html";
import { WebView } from "./WebviewManager";

class DataViewer extends WebView {
  private _uid: string;
  private _extensionUri: Uri;
  private _initialData: any;

  public constructor(extensionUri: Uri, uid: string, initialData: any) {
    super();
    this._uid = uid;
    this._extensionUri = extensionUri;
    this._initialData = initialData;
  }

  public render(): DataViewer {
    this.panel.webview.html = sprintf(html, {
      data: {
        viewId: this._uid.replace(/\./g, ""),
        title: this._uid,
        webviewUri: this.webviewUri(this._extensionUri, "DataViewer"),
      },
    });

    return this;
  }

  private processMessage(event: Event): void {
    switch (event.command) {
      case "requestLoad":
        this.panel.webview.postMessage({
          viewId: this._uid.replace(/\./g, ""),
          command: "onLoad",
          data: this._initialData,
        });
        break;
      default:
        break;
    }
  }
}

export default DataViewer;
