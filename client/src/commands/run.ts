// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Position,
  ProgressLocation,
  Selection,
  ViewColumn,
  commands,
  window,
  workspace,
  l10n,
  Uri,
  ColorThemeKind,
} from "vscode";
import type { BaseLanguageClient } from "vscode-languageclient";
import { LogFn as LogChannelFn } from "../components/LogChannel";
import { appendLog } from "../components/LogViewer";
import { getSession } from "../connection";
import { profileConfig, switchProfile } from "./profile";

interface FoldingBlock {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

let running = false;

function getCode(
  outputHtml: boolean,
  htmlStyle: string,
  selected = false,
  uri?: Uri
): string {
  const editor = uri
    ? window.visibleTextEditors.find(
        (editor) => editor.document.uri.toString() === uri.toString()
      )
    : window.activeTextEditor;
  const activeColorTheme = window.activeColorTheme;
  const doc = editor?.document;
  let code = "";
  if (selected) {
    // run selected code if there is one or more non-empty selections, otherwise run all code

    // since you can have multiple selections, append the text for each selection in order of selection
    // note: selection ranges can be empty (ex. just a carat)
    for (const selection of editor.selections) {
      const selectedText: string = doc.getText(selection);
      code += selectedText;
    }
    // if no non-whitespace characters are selected, treat as no selection and run all code
    if (code.trim().length === 0) {
      code = doc?.getText();
    }
  } else {
    code = doc?.getText();
  }

  if (outputHtml) {
    let odsStyle = "";
    switch (htmlStyle) {
      case "(auto)":
        switch (activeColorTheme.kind) {
          case ColorThemeKind.Light: {
            odsStyle = "Illuminate";
            break;
          }
          case ColorThemeKind.Dark: {
            odsStyle = "Ignite";
            break;
          }
          case ColorThemeKind.HighContrast: {
            odsStyle = "HighContrast";
            break;
          }
          case ColorThemeKind.HighContrastLight: {
            odsStyle = "Illuminate";
            break;
          }
        }
        break;
      case "(server default)":
        odsStyle = "";
        break;
      default:
        odsStyle = htmlStyle;
        break;
    }

    let usercode = code;
    code = `ods html5`;
    if (odsStyle) code += ` style=${odsStyle}`;
    code += ";\n" + usercode + "\n;run;quit;ods html5 close;";
  }

  return code;
}

async function getSelectedRegions(
  client: BaseLanguageClient
): Promise<Selection[]> {
  const result: string[] = [];

  async function pushBlock(line: number, col: number) {
    const block = await client.sendRequest<FoldingBlock>(
      "sas/getFoldingBlock",
      {
        textDocument: { uri: window.activeTextEditor.document.uri.toString() },
        line,
        col,
      }
    );
    if (block) {
      const start = doc.offsetAt(new Position(block.startLine, block.startCol));
      const end = doc.offsetAt(new Position(block.endLine, block.endCol));
      const key = `${start}-${end}`;
      if (result.indexOf(key) === -1) {
        result.push(key);
      }
      return end;
    }
  }

  const editor = window.activeTextEditor;
  const doc = editor.document;
  for (const selection of editor.selections) {
    const start = doc.offsetAt(selection.start);
    let end = doc.offsetAt(selection.end);
    const selectedText = doc.getText(selection);
    if (selectedText.endsWith("\n")) {
      --end;
    }
    for (let i = start; i <= end; i++) {
      const pos = doc.positionAt(i);
      const blockEnd = await pushBlock(pos.line, pos.character);
      if (blockEnd && blockEnd > i) {
        i = blockEnd;
      }
    }
  }
  return result.map((key) => {
    const [start, end] = key.split("-");
    return new Selection(
      doc.positionAt(parseInt(start)),
      doc.positionAt(parseInt(end))
    );
  });
}

async function runCode(selected?: boolean, uri?: Uri) {
  if (profileConfig.getActiveProfile() === "") {
    switchProfile();
    return;
  }

  const outputHtml = !!workspace
    .getConfiguration("SAS")
    .get("session.outputHtml");
  const htmlStyle: string = workspace
    .getConfiguration("SAS")
    .get("session.htmlStyle");
  const code = getCode(outputHtml, htmlStyle, selected, uri);

  const session = getSession();
  session.onLogFn = LogChannelFn;

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: l10n.t("Connecting to SAS session..."),
    },
    session.setup
  );

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: l10n.t("SAS code running..."),
      cancellable: typeof session.cancel === "function",
    },
    (_progress, cancellationToken) => {
      cancellationToken.onCancellationRequested(() => {
        session.cancel?.();
      });
      return session.run(code).then((results) => {
        if (outputHtml && results.html5) {
          const odsResult = window.createWebviewPanel(
            "SASSession", // Identifies the type of the webview. Used internally
            l10n.t("Result"), // Title of the panel displayed to the user
            { preserveFocus: true, viewColumn: ViewColumn.Beside }, // Editor column to show the new webview panel in.
            {} // Webview options. More on these later.
          );
          odsResult.webview.html = results.html5;
        }
      });
    }
  );
}

const _run = async (selected = false, uri?: Uri) => {
  if (running) {
    return;
  }
  running = true;
  commands.executeCommand("setContext", "SAS.running", true);

  await runCode(selected, uri)
    .catch((err) => {
      console.dir(err);
      window.showErrorMessage(
        err.response?.data ? JSON.stringify(err.response.data) : err.message
      );
    })
    .finally(() => {
      running = false;
      commands.executeCommand("setContext", "SAS.running", false);
    });
};

export async function run(): Promise<void> {
  await _run();
}

export async function runSelected(uri: Uri): Promise<void> {
  await _run(true, uri);
}

export async function runRegion(client: BaseLanguageClient): Promise<void> {
  const selections = await getSelectedRegions(client);
  window.activeTextEditor.selections = selections;
  await _run(true);
}
