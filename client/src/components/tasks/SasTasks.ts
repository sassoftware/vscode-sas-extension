// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { EventEmitter, TaskDefinition, ViewColumn, l10n, window } from "vscode";

import { runTask } from "../../commands/run";
import { RunResult } from "../../connection";
import {
  getSASCodeFromActiveEditor,
  getSASCodeFromFile,
  wrapCode,
} from "../Helper/SasCodeHelper";
import { isOutputHtmlEnabled } from "../Helper/SettingHelper";

export const SAS_TASK_TYPE = "sas";

export enum SasTaskNames {
  // Run the sas file indicated in the "file" property. if preamble or postamble provided, wrapping the sas code in the file with them.
  // If this task is called as predefined task or custom task without file or blank file name provided,
  // the code to run will be the selected code in active editor or be the active file code if there is no code selected.
  RunSasFile = "Run sas file",
}

export interface SasTaskDefinition extends TaskDefinition {
  task: string;
  file?: string;
  preamble?: string;
  postamble?: string;
}

export interface TaskInfo {
  definition: SasTaskDefinition;
  label: string;
}

export type Execute = (
  messageEmitter: EventEmitter<string>,
  taskInfo: TaskInfo,
  closeEmitter: EventEmitter<number>,
) => Promise<void>;

export async function runSasFileTask(
  messageEmitter: EventEmitter<string>,
  taskInfo: TaskInfo,
  closeEmitter: EventEmitter<number>,
) {
  const { definition: taskDefinition, label: taskLabel } = taskInfo;

  const isFileSpecified =
    taskDefinition.file !== undefined && taskDefinition.file.trim() !== "";

  const getCode = isFileSpecified
    ? getSASCodeFromFile(taskDefinition.file)
    : getSASCodeFromActiveEditor();

  return getCode
    .then((code) =>
      wrapCode(code, taskDefinition.preamble, taskDefinition.postamble),
    )
    .then((code) => runTask(code, messageEmitter, closeEmitter))
    .then((results) => {
      showRunResult(results, messageEmitter, `${taskLabel}`);
    });
}

function showRunResult(
  results: RunResult,
  messageEmitter: EventEmitter<string>,
  taskName: string,
) {
  const outputHtml = isOutputHtmlEnabled();

  if (outputHtml && results.html5) {
    messageEmitter.fire(l10n.t("Show results...") + "\r\n");
    const odsResult = window.createWebviewPanel(
      "SASSession", // Identifies the type of the webview. Used internally
      l10n.t("Result: {result}", { result: taskName }), // Title of the panel displayed to the user
      { preserveFocus: true, viewColumn: ViewColumn.Beside }, // Editor column to show the new webview panel in.
      {}, // Webview options. More on these later.
    );
    odsResult.webview.html = results.html5;
  }
}
