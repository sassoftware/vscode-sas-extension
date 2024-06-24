// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { EventEmitter, TaskDefinition, l10n, window, workspace } from "vscode";

import { isAbsolute } from "path";

import { runTask } from "../../commands/run";
import { SASCodeDocument } from "../utils/SASCodeDocument";
import { getCodeDocumentConstructionParameters } from "../utils/SASCodeDocumentHelper";

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
  const {
    definition: { file, preamble, postamble },
    label,
  } = taskInfo;

  const textDocument = await getTextDocumentFromFile(file);
  const parameters = getCodeDocumentConstructionParameters(textDocument, {
    preamble,
    postamble,
  });

  const codeDoc = new SASCodeDocument(parameters);

  return runTask(codeDoc, messageEmitter, closeEmitter, label);
}

async function getTextDocumentFromFile(file: string | undefined) {
  if (file === undefined || file.trim() === "") {
    return window.activeTextEditor.document;
  } else if (isAbsolute(file)) {
    return await workspace.openTextDocument(file);
  } else {
    const uri = (await workspace.findFiles(file))[0];
    if (uri === undefined) {
      throw new Error(l10n.t("Cannot find file: {file}", { file }));
    } else {
      return await workspace.openTextDocument(uri);
    }
  }
}
