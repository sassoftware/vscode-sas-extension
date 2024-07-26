// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { DocumentSymbol } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { CodeZoneManager } from "../sas/CodeZoneManager";
import { LanguageServiceProvider } from "../sas/LanguageServiceProvider";

export const extractPythonCodes = (
  doc: TextDocument,
  languageService: LanguageServiceProvider,
): string => {
  const codeZoneManager = languageService.getCodeZoneManager();
  const pythonDocLines = [];
  const symbols: DocumentSymbol[] = languageService.getDocumentSymbols();
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
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
          CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG &&
        // a codezone bug
        pos.line >= symbol.range.start.line + 2
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
    let firstNotEmptyLine: string | undefined = undefined;
    for (const line of pythonCodeLines) {
      if (line.trim().length > 0 && !line.trim().startsWith("#")) {
        firstNotEmptyLine = line;
        break;
      }
    }
    const shouldAddDummyBlock: boolean =
      !!firstNotEmptyLine && [" ", "\t"].includes(firstNotEmptyLine[0]);
    const lineGap = pythonCodeStart.line - pythonDocLines.length;
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
  const pythonDoc = pythonDocLines.join("\n");
  return pythonDoc;
};
