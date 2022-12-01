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
import { appendLog } from "../components/LogViewer";
import { getSession } from "../session";
import { profileConfig, switchProfile } from "./profile";

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

async function runCode(selected?: boolean) {
  if (profileConfig.getActiveProfile() === "") {
    switchProfile();
    return;
  }

  const outputHtml = !!workspace
    .getConfiguration("SAS")
    .get("session.outputHtml");
  const code = getCode(outputHtml, selected);

  const session = getSession();

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "Connecting to SAS session...",
    },
    session.setup
  );

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: "SAS code running...",
    },
    () =>
      session
        .run(code, (logs) => {
          if (!outputChannel)
            outputChannel = window.createOutputChannel("SAS Log", "sas-log");
          outputChannel.show();
          for (const line of logs) {
            appendLog(line.type);
            outputChannel.appendLine(line.line);
          }
        })
        .then((results) => {
          if (outputHtml && results.html5) {
            const odsResult = window.createWebviewPanel(
              "SASSession", // Identifies the type of the webview. Used internally
              "Result", // Title of the panel displayed to the user
              ViewColumn.Two, // Editor column to show the new webview panel in.
              {} // Webview options. More on these later.
            );
            odsResult.webview.html = results.html5;
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
      console.dir(err);
      window.showErrorMessage(
        err.response?.data ? JSON.stringify(err.response.data) : err.message
      );
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
