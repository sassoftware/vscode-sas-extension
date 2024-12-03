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
  const pythonDocLines = [
    "import sas2py #type: ignore",
    "SAS = sas2py.SAS2py()",
  ];
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

    let startingEmptyLineCount = 0;
    let firstNotEmptyLine: string | undefined = undefined;
    for (const line of pythonCodeLines) {
      if (line.trim().length > 0 && !line.trim().startsWith("#")) {
        firstNotEmptyLine = line;
        break;
      } else {
        startingEmptyLineCount++;
      }
    }
    if (startingEmptyLineCount > 0) {
      pythonCodeLines.splice(0, startingEmptyLineCount);
      pythonCodeStart.line += startingEmptyLineCount;
      pythonCodeStart.character = 0;
    }

    let tailingEmptyLineCount = 0;
    for (let i = pythonCodeLines.length - 1; i >= 0; i--) {
      if (
        pythonCodeLines[i].trim().length === 0 ||
        pythonCodeLines[i].trim().startsWith("#")
      ) {
        tailingEmptyLineCount++;
      } else {
        break;
      }
    }
    if (tailingEmptyLineCount > 0) {
      pythonCodeLines.splice(pythonCodeLines.length - tailingEmptyLineCount);
      if (pythonCodeEnd) {
        pythonCodeEnd.line -= startingEmptyLineCount;
        pythonCodeEnd.character =
          pythonCodeLines[pythonCodeLines.length - 1].length;
      }
    }

    const shouldAddDummyBlock: boolean =
      !!firstNotEmptyLine && [" ", "\t"].includes(firstNotEmptyLine[0]);
    const lineGap = pythonCodeStart.line - pythonDocLines.length;
    // must be: proc python;submit;<python code>
    if (lineGap === 0) {
      let line = "if True:";
      line += " ".repeat(pythonCodeStart.character - line.length);
      line += pythonCodeLines[0];
      if (firstNotEmptyLine) {
        line += ";pass";
      }
      pythonDocLines.push(line);
    } else {
      for (let i = 0; i < lineGap; i++) {
        if (shouldAddDummyBlock && i === lineGap - 1) {
          pythonDocLines.push("if True:");
        } else {
          pythonDocLines.push("");
        }
      }
      for (const line of pythonCodeLines) {
        pythonDocLines.push(line);
      }
      if (firstNotEmptyLine) {
        pythonDocLines.push("pass");
      }
    }
  }
  const pythonDoc = pythonDocLines.join("\n");
  return pythonDoc;
};
