// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
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
import { getSession } from "../connection";
import { profileConfig, switchProfile } from "./profile";

let outputChannel: OutputChannel;
let running = false;

function getCode(outputHtml: boolean, selected = false): string {
  const editor = window.activeTextEditor;
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

  return outputHtml ? "ods html5;\n" + code + "\n;quit;ods html5 close;" : code;
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
          if (!outputChannel) {
            outputChannel = window.createOutputChannel("SAS Log", "sas-log");
          }
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
              { preserveFocus: true, viewColumn: ViewColumn.Beside }, // Editor column to show the new webview panel in.
              {} // Webview options. More on these later.
            );
            odsResult.webview.html = results.html5;
          }
        })
  );
}

const _run = async (selected = false) => {
  if (running) {
    return;
  }
  running = true;
  commands.executeCommand("setContext", "SAS.hideRunMenuItem", true);

  await runCode(selected)
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
};

export async function run(): Promise<void> {
  await _run();
}

export async function runSelected(): Promise<void> {
  await _run(true);
}
