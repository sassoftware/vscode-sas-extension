// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { DocumentSymbol } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { CodeZoneManager } from "../sas/CodeZoneManager";
import { LanguageServiceProvider } from "../sas/LanguageServiceProvider";
import { isCustomRegionStartComment } from "../sas/utils";

export const extractPythonCodes = (
  doc: TextDocument,
  languageService: LanguageServiceProvider,
): string => {
  const codeZoneManager = languageService.getCodeZoneManager();
  let pythonDocLines = ["import sas2py;SAS = sas2py.SAS2py() #type: ignore"];
  const symbols: DocumentSymbol[] = languageService.getDocumentSymbols();
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    if (isCustomRegionStartComment(symbol.name)) {
      symbols.splice(i + 1, 0, ...(symbol.children ?? []));
    }
    if (symbol.name?.toUpperCase() !== "PROC PYTHON") {
      continue;
    }
    let pythonCodeStart = undefined;
    let pythonCodeEnd = undefined;
    const pos = { ...symbol.range.start };
    while (pos.line <= symbol.range.end.line) {
      if (
        !pythonCodeStart &&
        codeZoneManager.getCurrentZone(pos.line, pos.character) ===
          CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG
        // // a codezone bug
        // pos.line >= symbol.range.start.line + 2
      ) {
        pythonCodeStart = { ...pos };
      }
      if (
        pythonCodeStart &&
        codeZoneManager.getCurrentZone(pos.line, pos.character) !==
          CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG
      ) {
        pythonCodeEnd = { ...pos };
        if (pythonCodeEnd.character === 0) {
          pythonCodeEnd.line--;
          pythonCodeEnd.character =
            languageService.model.getColumnCount(pythonCodeEnd.line) - 1;
          if (pythonCodeEnd.character < 0) {
            pythonCodeEnd.character = 0;
          }
        }
        break;
      }
      pos.character++;
      if (pos.character >= languageService.model.getLine(pos.line).length) {
        pos.line++;
        pos.character = 0;
      }
    }
    if (!pythonCodeStart) {
      continue;
    }
    const pythonCodeLines = doc
      .getText({
        start: pythonCodeStart,
        end: pythonCodeEnd ?? symbol.range.end,
      })
      .split("\n");
    const lineGap = pythonCodeStart.line - pythonDocLines.length;
    if (lineGap > 0) {
      pythonDocLines = pythonDocLines.concat(Array(lineGap).fill(""));
    } else if (lineGap === -1 && pythonCodeLines[0] === "") {
      // head in one line: proc python; submit;
      pythonCodeLines.shift();
    }
    pythonDocLines = pythonDocLines.concat(pythonCodeLines);
    pythonDocLines.push("pass");
  }
  const pythonDoc = pythonDocLines.join("\n");
  return pythonDoc;
};
