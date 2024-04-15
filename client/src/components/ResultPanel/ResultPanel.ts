// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, ViewColumn, WebviewPanel, l10n, window } from "vscode";

import { v4 } from "uuid";

import { getContextValue, setContextValue } from "../ExtensionContext";
import { isSideResultEnabled, isSinglePanelEnabled } from "../utils/settings";

const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
export const SAS_RESULT_PANEL = "SASResultPanel";

let resultPanel: WebviewPanel | undefined;
export const resultPanels: Record<string, WebviewPanel> = {};

interface ResultPanelState {
  panelId: string;
}

export const showResult = (html: string, uri?: Uri, title?: string) => {
  const resultPanelId = `${v4()}`;
  const sideResult = isSideResultEnabled();
  const singlePanel = isSinglePanelEnabled();
  if (!title) {
    title = l10n.t("Result");
  }

  if (!singlePanel || !resultPanel) {
    resultPanel = window.createWebviewPanel(
      SAS_RESULT_PANEL, // Identifies the type of the webview. Used internally
      title, // Title of the panel displayed to the user
      {
        preserveFocus: true,
        viewColumn: sideResult ? ViewColumn.Beside : ViewColumn.Active,
      }, // Editor column to show the new webview panel in.
      { enableScripts: true }, // Webview options. More on these later.
    );
    resultPanel.onDidDispose(() => disposePanel(resultPanelId));
    resultPanels[resultPanelId] = resultPanel;
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

  html = html
    // Inject vscode context into our results html body
    .replace(
      "<body ",
      `<body data-vscode-context='${JSON.stringify({
        preventDefaultContextMenuItems: true,
        resultPanelId,
      })}' `,
    )
    // Make sure the html and body take up the full height of the parent
    // iframe so that the context menu is clickable anywhere on the page
    .replace(
      "</head>",
      `<script language="javascript">
          if(acquireVsCodeApi){
            const vscode = acquireVsCodeApi();
            const panelId = '${resultPanelId}'
            vscode.setState({panelId});
          }
         </script>
         <style>html,body { height: 100% !important; }</style></head>`,
    );
  resultPanel.webview.html = html;
  setContextValue(resultPanelId, html);
};

export const deserializeWebviewPanel = async (
  webviewPanel: WebviewPanel,
  state: ResultPanelState,
): Promise<void> => {
  const panelHtml: string = await getContextValue(state.panelId);
  resultPanel = webviewPanel;
  webviewPanel.webview.html = panelHtml;
  webviewPanel.onDidDispose(() => disposePanel(state.panelId));
  resultPanels[state.panelId] = webviewPanel;
};

export const fetchHtmlFor = (panelId: string) => {
  const foundPanel = resultPanels[panelId];
  let panelHtml: string = "";

  if (foundPanel !== undefined) {
    panelHtml = foundPanel.webview.html.replace(SCRIPT_REGEX, "");
  }
  return panelHtml;
};

const disposePanel = (id: string) => {
  delete resultPanels[id];
  resultPanel = undefined;
  setContextValue(id, undefined);
};
