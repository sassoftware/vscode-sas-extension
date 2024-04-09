// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Disposable,
  ExtensionContext,
  Uri,
  ViewColumn,
  WebviewPanel,
  WebviewPanelSerializer,
  l10n,
  window,
} from "vscode";

import { v4 } from "uuid";

import { isSideResultEnabled, isSinglePanelEnabled } from "../utils/settings";

export const SAS_RESULT_PANEL = "SASResultPanel";
let resultPanelManager: ResultPanelManager;
export { resultPanelManager };

interface ResultPanelState {
  panelId: string;
}

export const initResultPanelManager = (
  extension: ExtensionContext,
): ResultPanelManager => {
  resultPanelManager = new ResultPanelManager(extension);
  return resultPanelManager;
};

export class ResultPanelManager implements WebviewPanelSerializer, Disposable {
  private _context: ExtensionContext;
  private _resultPanels: Record<string, WebviewPanel>;
  private _currentPanel: WebviewPanel;

  constructor(context: ExtensionContext) {
    this._context = context;
    this._resultPanels = {};
  }
  dispose() {
    Object.keys(this.resultPanels).forEach((key) => {
      this._resultPanels[key].dispose();
    });
  }

  public get resultPanels(): Record<string, WebviewPanel> {
    return this._resultPanels;
  }

  async deserializeWebviewPanel(
    webviewPanel: WebviewPanel,
    state: ResultPanelState,
  ): Promise<void> {
    const panelHtml: string = this._context.workspaceState.get(state.panelId);
    webviewPanel.webview.html = panelHtml;
    this._resultPanels[state.panelId] = webviewPanel;
  }

  public showResult(html: string, uri?: Uri, title?: string) {
    const resultPanelId = `${v4()}`;
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
    const sideResult = isSideResultEnabled();
    const singlePanel = isSinglePanelEnabled();
    if (!title) {
      title = l10n.t("Result");
    }

    if (!singlePanel || !this._currentPanel) {
      const resultPanel = window.createWebviewPanel(
        SAS_RESULT_PANEL, // Identifies the type of the webview. Used internally
        title, // Title of the panel displayed to the user
        {
          preserveFocus: true,
          viewColumn: sideResult ? ViewColumn.Beside : ViewColumn.Active,
        }, // Editor column to show the new webview panel in.
        { enableScripts: true }, // Webview options. More on these later.
      );
      resultPanel.webview;
      resultPanel.onDidDispose(
        ((id) => () => {
          delete this._resultPanels[id];
          this._currentPanel = undefined;
          this._context.workspaceState.update(id, undefined);
        })(resultPanelId),
      );
      this._currentPanel = resultPanel;
      this._resultPanels[resultPanelId] = resultPanel;
      this._context.workspaceState.update(resultPanelId, html);
    } else {
      const editor = uri
        ? window.visibleTextEditors.find(
            (editor) => editor.document.uri.toString() === uri.toString(),
          )
        : window.activeTextEditor;
      if (this._currentPanel.title !== title) {
        this._currentPanel.title = title;
      }
      this._currentPanel.reveal(
        sideResult ? ViewColumn.Beside : editor?.viewColumn,
        true,
      );
    }
    this._currentPanel.webview.html = html;
  }
}
