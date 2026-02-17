// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { NotebookCell, NotebookDocument } from "vscode";

export const exportToSAS = (notebook: NotebookDocument) =>
  notebook
    .getCells()
    .map((cell) => exportCell(cell) + "\n")
    .join("\n");

const exportCell = (cell: NotebookCell) => {
  const text = cell.document.getText();
  switch (cell.document.languageId) {
    case "sas":
      return text;
    case "python":
      return wrapPython(text);
    case "r":
      return wrapR(text);
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

const wrapPython = (code: string) => `proc python;
submit;
${code}
endsubmit;
run;`;

const wrapR = (code: string) => `proc r;
submit;
${code}
endsubmit;
run;`;
