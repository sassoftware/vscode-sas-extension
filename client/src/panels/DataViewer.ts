// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Uri } from "vscode";
import PaginatedResultSet from "../components/LibraryNavigator/PaginatedResultSet";
import { TableData } from "../components/LibraryNavigator/types";
import { WebView } from "./WebviewManager";

class DataViewer extends WebView {
  private _uid: string;
  private _extensionUri: Uri;
  private _paginator: PaginatedResultSet<TableData>;

  public constructor(
    extensionUri: Uri,
    uid: string,
    paginator: PaginatedResultSet<TableData>
  ) {
    super();
    this._uid = uid;
    this._extensionUri = extensionUri;
    this._paginator = paginator;
  }

  public render(): WebView {
    this.panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en" style="min-height:100%;height:100%;">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <link rel="stylesheet" href="${this.webviewUri(
            this._extensionUri,
            "DataViewer.css"
          )}">
          <title>${this._uid}</title>
        </head>
        <body style="min-height:100%;height:100%;padding:0;">
          <vscode-data-grid
            class="data-view-${this._uid.replace(/\./g, "")}"
            aria-label="${this._uid} contents"
          ></vscode-data-grid>
          <div class="data-viewer" style="height:100%;"></div>
          <script type="module" src="${this.webviewUri(
            this._extensionUri,
            "DataViewer.js"
          )}"></script>
        </body>
      </html>
    `;

    return this;
  }

  public async processMessage(
    event: Event & { command: string; data?: { start?: number; end?: number } }
  ): Promise<void> {
    switch (event.command) {
      case "request:loadData":
        this.panel.webview.postMessage({
          command: "response:loadData",
          data: await this._paginator.getData(event.data.start, event.data.end),
        });
        break;
      case "request:loadMoreResults":
        this.panel.webview.postMessage({
          command: "response:loadMoreResults",
          data: await this._paginator.getMoreResults(),
        });
        break;
      case "request:updateStart":
        this._paginator.updateStartOffset(event.data.start);
        break;
      default:
        break;
    }
  }
}

export default DataViewer;
