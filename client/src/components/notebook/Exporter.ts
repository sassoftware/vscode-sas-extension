// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { NotebookCell, window, workspace } from "vscode";

export const exportNotebook = async () => {
  const notebook = window.activeNotebookEditor?.notebook;

  if (!notebook) {
    return;
  }

  const uri = await window.showSaveDialog({
    filters: { SAS: ["sas"] },
  });

  if (!uri) {
    return;
  }

  const content = notebook
    .getCells()
    .map((cell) => exportCell(cell) + "\n")
    .join("\n");

  workspace.fs.writeFile(uri, Buffer.from(content));
};

const exportCell = (cell: NotebookCell) => {
  const text = cell.document.getText();
  switch (cell.document.languageId) {
    case "sas":
      return text;
    case "python":
      return wrapPython(text);
    case "sql":
      return wrapSQL(text);
    case "markdown":
      return `/*\n${text}\n*/`;
  }
};

const wrapSQL = (code: string) => {
  if (!code.trimEnd().endsWith(";")) {
    code = `${code};`;
  }
  return `proc sql;
${code}
quit;`;
};

const wrapPython = (code: string) => {
  return `proc python;
submit;
${code}
endsubmit;
run;`;
};
