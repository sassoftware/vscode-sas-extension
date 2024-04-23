// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, ViewColumn, WebviewPanel, l10n, window } from "vscode";

import { v4 } from "uuid";

import { getContextValue, setContextValue } from "../ExtensionContext";
import { isSideResultEnabled, isSinglePanelEnabled } from "../utils/settings";

const SCRIPT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
export const SAS_RESULT_PANEL = "SASResultPanel";

interface ResultPanelState {
  panelId: string;
}

interface IdentifiableWebviewPanel {
  webviewPanel: WebviewPanel;
  panelId: string;
}

let resultPanel: IdentifiableWebviewPanel | undefined;

export const showResult = (html: string, uri?: Uri, title?: string) => {
  const sideResult = isSideResultEnabled();
  const singlePanel = isSinglePanelEnabled();
  let panelId: string;

  if (!title) {
    title = l10n.t("Result");
  }

  if (!singlePanel || !resultPanel) {
    panelId = `${v4()}`;
    const webviewPanel = window.createWebviewPanel(
      SAS_RESULT_PANEL, // Identifies the type of the webview. Used internally
      title, // Title of the panel displayed to the user
      {
        preserveFocus: true,
        viewColumn: sideResult ? ViewColumn.Beside : ViewColumn.Active,
      }, // Editor column to show the new webview panel in.
      { enableScripts: true }, // Webview options.
    );
    webviewPanel.onDidDispose(() => disposePanel(panelId));
    resultPanel = { webviewPanel, panelId };
  } else {
    const editor = uri
      ? window.visibleTextEditors.find(
          (editor) => editor.document.uri.toString() === uri.toString(),
        )
      : window.activeTextEditor;
    if (resultPanel.webviewPanel.title !== title) {
      resultPanel.webviewPanel.title = title;
    }
    panelId = resultPanel.panelId;
    resultPanel.webviewPanel.reveal(
      sideResult ? ViewColumn.Beside : editor?.viewColumn,
      true,
    );
  }

  const panelHtml = wrapPanelHtml(html, panelId);
  resultPanel.webviewPanel.webview.html = panelHtml;
  setContextValue(resultPanel.panelId, panelHtml);
};

const wrapPanelHtml = (html: string, panelId: string): string => {
  return (
    html
      // Inject vscode context into our results html body
      .replace(
        "<body ",
        `<body data-vscode-context='${JSON.stringify({
          preventDefaultContextMenuItems: true,
          panelId,
        })}' `,
      )
      // Make sure the html and body take up the full height of the parent
      // iframe so that the context menu is clickable anywhere on the page
      .replace(
        "</head>",
        `<script language="javascript">
          if(acquireVsCodeApi){
            const vscode = acquireVsCodeApi();
            const panelId = '${panelId}'
            vscode.setState({panelId});
          }
         </script>
         <style>html,body { height: 100% !important; }</style></head>`,
      )
  );
};

export const deserializeWebviewPanel = async (
  webviewPanel: WebviewPanel,
  state: ResultPanelState,
): Promise<void> => {
  const panelHtml: string = await getContextValue(state.panelId);
  resultPanel = { panelId: state.panelId, webviewPanel: webviewPanel };
  webviewPanel.webview.html = panelHtml;
  webviewPanel.onDidDispose(() => disposePanel(state.panelId));
};

export const fetchHtmlFor = async (panelId: string) => {
  let panelHtml: string = "";
  panelHtml = await getContextValue(panelId);
  panelHtml = panelHtml.replace(SCRIPT_REGEX, "");

  return panelHtml;
};

const disposePanel = (id: string) => {
  resultPanel = undefined;
  setContextValue(id, undefined);
};
