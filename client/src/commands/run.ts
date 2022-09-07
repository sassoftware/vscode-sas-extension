// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  OutputChannel,
  ProgressLocation,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import { appendLog } from "../LogViewer";
import { setup, run as computeRun } from "../viya/compute";

let outputChannel: OutputChannel;

function getCode(outputHtml: boolean): string {
  const code = window.activeTextEditor.document.getText();
  return outputHtml ? "ods html5;\n" + code + "\n;quit;ods html5 close;" : code;
}

async function _run() {
  const outputHtml: boolean = workspace
    .getConfiguration("SAS.oDS")
    .get("output");
  const code = getCode(outputHtml);

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Connecting to SAS session...",
    },
    setup
  );

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "SAS code running...",
    },
    () =>
      computeRun(code).then((results) => {
        if (!outputChannel)
          outputChannel = window.createOutputChannel("SAS Log", "sas-log");
        outputChannel.show();
        for (const line of results.log) {
          appendLog(line.type);
          outputChannel.appendLine(line.line);
        }
        if (outputHtml) {
          const odsResult = window.createWebviewPanel(
            "SASSession", // Identifies the type of the webview. Used internally
            "Result", // Title of the panel displayed to the user
            ViewColumn.Two, // Editor column to show the new webview panel in.
            {} // Webview options. More on these later.
          );
          odsResult.webview.html = results.ods;
        }
      })
  );
}

export function run(): void {
  _run().catch((err) => {
    window.showErrorMessage(JSON.stringify(err));
  });
}
