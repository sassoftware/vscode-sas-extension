// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  OutputChannel,
  ProgressLocation,
  ViewColumn,
  window,
  workspace,
  commands,
} from "vscode";
import { appendLog } from "../LogViewer";
import { setup, run as computeRun } from "../viya/compute";

let outputChannel: OutputChannel;
let running = false;

function getCode(outputHtml: boolean, selected = false): string {
  const editor = window.activeTextEditor;
  const doc = editor?.document;
  const code = selected ? doc?.getText(editor?.selection) : doc?.getText();

  return code
    ? outputHtml
      ? "ods html5;\n" + code + "\n;quit;ods html5 close;"
      : code
    : "";
}

async function runCode(selected) {
  const outputHtml = !!workspace
    .getConfiguration("SAS")
    .get("session.outputHtml");
  const code = getCode(outputHtml, selected);

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

function _run(selected = false) {
  if (running) return;
  running = true;
  commands.executeCommand("setContext", "SAS.hideRunMenuItem", true);

  runCode(selected)
    .catch((err) => {
      window.showErrorMessage(JSON.stringify(err));
    })
    .finally(() => {
      running = false;
      commands.executeCommand("setContext", "SAS.hideRunMenuItem", false);
    });
}

export function run(): void {
  _run();
}

export function runSelected(): void {
  _run(true);
}
