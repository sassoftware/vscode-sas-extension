// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { Uri } from "vscode";
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

  public render(): WebView {
    this.panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>${this._uid}</title>
        </head>
        <body>
          <vscode-data-grid
            class="data-view-${this._uid.replace(/\./g, "")}"
            aria-label="${this._uid} contents"
          ></vscode-data-grid>
          <div class="data-viewer"></div>
          <script type="module" src="${this.webviewUri(
            this._extensionUri,
            "DataViewer"
          )}"></script>
        </body>
      </html>
    `;

    return this;
  }

  public processMessage(event: Event): void {
    switch (event.command) {
      case "requestLoad":
        this.panel.webview.postMessage({
          viewId: this._uid.replace(/\./g, ""),
          command: "onLoad",
          data: this._initialData,
        });
        break;
      case "loadMore":
        this.panel.webview.postMessage({
          viewId: this._uid.replace(/\./g, ""),
          command: "onResultsLoaded",
          data: {
            rows: this._initialData.rows.slice(0, 50),
          },
        });
        break;
      default:
        break;
    }
  }
}

export default DataViewer;
