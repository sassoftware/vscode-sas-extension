// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { DocumentSymbol } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { CodeZoneManager } from "../sas/CodeZoneManager";
import { LanguageServiceProvider } from "../sas/LanguageServiceProvider";
import { isCustomRegionStartComment } from "../sas/utils";

/**
 * Extracts R code from PROC RLANG blocks in a SAS document.
 * This converts the SAS document with embedded R into a pure R document
 * that the R language server can analyze.
 */
export const extractRCodes = (
  doc: TextDocument,
  languageService: LanguageServiceProvider,
): string => {
  const codeZoneManager = languageService.getCodeZoneManager();
  const rDocLines: string[] = [];
  const symbols: DocumentSymbol[] = languageService.getDocumentSymbols();

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    if (isCustomRegionStartComment(symbol.name)) {
      symbols.splice(i + 1, 0, ...(symbol.children ?? []));
    }
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
      pos.line++;
      pos.character = 0;
    }

    if (!rCodeStart) {
      continue;
    }
    if (!rCodeEnd) {
      rCodeEnd = { ...symbol.range.end };
    }

    const rCode = doc.getText({
      start: rCodeStart,
      end: rCodeEnd,
    });

    rDocLines.push(rCode);
  }

  return rDocLines.join("\n");
};
