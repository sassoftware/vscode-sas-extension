// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  NotebookCellData,
  NotebookCellKind,
  NotebookData,
  window,
  workspace,
} from "vscode";

export async function newSASNotebook() {
  await window.showNotebookDocument(
    await workspace.openNotebookDocument(
      "sas-notebook",
      new NotebookData([
        new NotebookCellData(NotebookCellKind.Code, "", "sas"),
      ]),
    ),
  );
}

export async function newSASFile() {
  await window.showTextDocument(
    await workspace.openTextDocument({ language: "sas" }),
  );
}
