// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { Uri } from "vscode";
import { Messages } from "../../components/LibraryNavigator/const";
import { TableData, TableRow } from "../../components/LibraryNavigator/types";
import { sprintf } from "sprintf-js";
import html from "../webview/DataViewer/view.html";
import { WebView } from "./WebviewManager";

class DataTable extends WebView {
  public static panels: Record<string, DataTable> = {};
  private _uid: string;
  private _extensionUri: Uri;

  public constructor(extensionUri: Uri, uid: string) {
    super();
    this._uid = uid;
    this._extensionUri = extensionUri;
  }

  public render(): DataTable {
    this.panel.webview.html = sprintf(html, {
      data: {
        title: this._uid,
        webviewUri: this.webviewUri(this._extensionUri, "DataViewer"),
      },
    });

    return this;
  }
}

export default DataTable;
