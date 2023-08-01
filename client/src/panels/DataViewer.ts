// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Uri } from "vscode";
import PaginatedResultSet from "../components/LibraryNavigator/PaginatedResultSet";
import { TableData } from "../components/LibraryNavigator/types";
import { Column } from "../connection/rest/api/compute";
import { WebView } from "./WebviewManager";

class DataViewer extends WebView {
  private _uid: string;
  private _extensionUri: Uri;
  private _paginator: PaginatedResultSet<TableData>;
  private _fetchColumns: () => Column[];

  public constructor(
    extensionUri: Uri,
    uid: string,
    paginator: PaginatedResultSet<TableData>,
    fetchColumns: () => Column[],
  ) {
    super();
    this._uid = uid;
    this._extensionUri = extensionUri;
    this._paginator = paginator;
    this._fetchColumns = fetchColumns;
  }

  public render(): WebView {
    const policies = [
      `default-src 'none';`,
      `font-src ${this.panel.webview.cspSource} data:;`,
      `img-src ${this.panel.webview.cspSource} data:;`,
      `script-src ${this.panel.webview.cspSource};`,
      `style-src ${this.panel.webview.cspSource};`,
    ];
    this.panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="${policies.join(
            " ",
          )}" />
          <link rel="stylesheet" href="${this.webviewUri(
            this._extensionUri,
            "DataViewer.css",
          )}">
          <title>${this._uid}</title>
        </head>
        <body>
          <div class="data-viewer"></div>
          <script type="module" src="${this.webviewUri(
            this._extensionUri,
            "DataViewer.js",
          )}"></script>
        </body>
      </html>
    `;

    return this;
  }

  public async processMessage(
    event: Event & {
      key: string;
      command: string;
      data?: { start?: number; end?: number };
    },
  ): Promise<void> {
    switch (event.command) {
      case "request:loadData":
        this.panel.webview.postMessage({
          command: "response:loadData",
          key: event.key,
          data: await this._paginator.getData(
            event.data!.start!,
            event.data!.end!,
          ),
        });
        break;
      case "request:loadColumns":
        this.panel.webview.postMessage({
          key: event.key,
          command: "response:loadColumns",
          data: await this._fetchColumns(),
        });
        break;
      default:
        break;
    }
  }
}

export default DataViewer;
