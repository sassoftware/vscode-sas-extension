// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, ViewColumn, WebviewPanel, l10n, window } from "vscode";

import {
  isSideResultEnabled,
  isSinglePanelEnabled,
} from "./Helper/SettingHelper";

let resultPanel: WebviewPanel | undefined;

export const showResult = (html: string, uri?: Uri, title?: string) => {
  const sideResult = isSideResultEnabled();
  const singlePanel = isSinglePanelEnabled();
  if (!title) {
    title = l10n.t("Result");
  }

  if (!singlePanel || !resultPanel) {
    resultPanel = window.createWebviewPanel(
      "SASSession", // Identifies the type of the webview. Used internally
      title, // Title of the panel displayed to the user
      {
        preserveFocus: true,
        viewColumn: sideResult ? ViewColumn.Beside : ViewColumn.Active,
      }, // Editor column to show the new webview panel in.
      {}, // Webview options. More on these later.
    );
    resultPanel.onDidDispose(() => (resultPanel = undefined));
  } else {
    const editor = uri
      ? window.visibleTextEditors.find(
          (editor) => editor.document.uri.toString() === uri.toString(),
        )
      : window.activeTextEditor;
    if (resultPanel.title !== title) {
      resultPanel.title = title;
    }
    resultPanel.reveal(
      sideResult ? ViewColumn.Beside : editor?.viewColumn,
      true,
    );
  }
  resultPanel.webview.html = html;
};
