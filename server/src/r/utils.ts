// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { DocumentSymbol, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { CodeZoneManager } from "../sas/CodeZoneManager";
import { LanguageServiceProvider } from "../sas/LanguageServiceProvider";
import { isCustomRegionStartComment } from "../sas/utils";

/**
 * Extracts R code from a SAS document that contains PROC RLANG blocks.
 * Similar to extractPythonCodes but for R code blocks.
 */
export const extractRCodes = (
  doc: TextDocument,
  languageService: LanguageServiceProvider,
): string => {
  const codeZoneManager = languageService.getCodeZoneManager();
  let rDocLines: string[] = [];
  const symbols: DocumentSymbol[] = languageService.getDocumentSymbols();
  
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    if (isCustomRegionStartComment(symbol.name)) {
      symbols.splice(i + 1, 0, ...(symbol.children ?? []));
    }
    
    // Look for PROC RLANG blocks
    if (symbol.name?.toUpperCase() !== "PROC RLANG") {
      continue;
    }
    
    let rCodeStart = undefined;
    let rCodeEnd = undefined;
    const pos = { ...symbol.range.start };
    
    while (pos.line <= symbol.range.end.line) {
      if (
        !rCodeStart &&
        codeZoneManager.getCurrentZone(pos.line, pos.character) ===
          CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG
      ) {
        rCodeStart = { ...pos };
      }
      
      if (
        rCodeStart &&
        codeZoneManager.getCurrentZone(pos.line, pos.character) !==
          CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG
      ) {
        rCodeEnd = { ...pos };
        if (rCodeEnd.character === 0) {
          rCodeEnd.line--;
          rCodeEnd.character =
            languageService.model.getColumnCount(rCodeEnd.line) - 1;
          if (rCodeEnd.character < 0) {
            rCodeEnd.character = 0;
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
    
    if (!rCodeStart) {
      continue;
    }
    
    const rCodeLines = doc
      .getText({
        start: rCodeStart,
        end: rCodeEnd ?? symbol.range.end,
      })
      .split("\n");
      
    const lineGap = rCodeStart.line - rDocLines.length;
    if (lineGap > 0) {
      rDocLines = rDocLines.concat(Array(lineGap).fill(""));
    } else if (lineGap === -1 && rCodeLines[0] === "") {
      // head in one line: proc rlang; submit;
      rCodeLines.shift();
    }
    
    rDocLines = rDocLines.concat(rCodeLines);
  }
  
  const rDoc = rDocLines.join("\n");
  return rDoc;
};

/**
 * Gets the word (symbol) at the specified position in a text document.
 * This is used to identify R functions and keywords for hover support.
 */
export const getWordAtPosition = (
  doc: TextDocument,
  position: Position,
): string | undefined => {
  const line = doc.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  });
  
  // R identifier regex: starts with letter or dot, followed by letters, digits, dots, or underscores
  const wordPattern = /[a-zA-Z._][a-zA-Z0-9._]*/g;
  let match: RegExpExecArray | null;
  
  while ((match = wordPattern.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    
    if (position.character >= start && position.character <= end) {
      return match[0];
    }
  }
  
  return undefined;
};
