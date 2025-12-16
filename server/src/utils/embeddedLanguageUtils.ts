// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { DocumentSymbol } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { CodeZoneManager } from "../sas/CodeZoneManager";
import { LanguageServiceProvider } from "../sas/LanguageServiceProvider";
import { isCustomRegionStartComment } from "../sas/utils";

/**
 * Configuration for extracting embedded language code from PROC blocks
 */
interface ExtractCodeOptions {
  /** The name of the PROC statement (e.g., "PROC PYTHON", "PROC RLANG") */
  procName: string;
  /** Optional header lines to prepend to the extracted code */
  headerLines?: string[];
  /** Optional footer lines to append to the extracted code */
  footerLines?: string[];
}

/**
 * Generic function to extract embedded language code from PROC blocks in SAS documents.
 * This handles both PROC PYTHON and PROC RLANG (and potentially other embedded languages).
 *
 * @param doc - The text document to extract code from
 * @param languageService - The SAS language service provider
 * @param options - Configuration options for extraction
 * @returns The extracted code as a string
 */
export const extractEmbeddedLanguageCode = (
  doc: TextDocument,
  languageService: LanguageServiceProvider,
  options: ExtractCodeOptions,
): string => {
  const codeZoneManager = languageService.getCodeZoneManager();
  let docLines: string[] = options.headerLines ? [...options.headerLines] : [];
  const symbols: DocumentSymbol[] = languageService.getDocumentSymbols();

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    if (isCustomRegionStartComment(symbol.name)) {
      symbols.splice(i + 1, 0, ...(symbol.children ?? []));
    }
    if (symbol.name?.toUpperCase() !== options.procName.toUpperCase()) {
      continue;
    }

    let codeStart = undefined;
    let codeEnd = undefined;
    const pos = { ...symbol.range.start };

    while (pos.line <= symbol.range.end.line) {
      if (
        !codeStart &&
        codeZoneManager.getCurrentZone(pos.line, pos.character) ===
          CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG
      ) {
        codeStart = { ...pos };
      }

      if (
        codeStart &&
        codeZoneManager.getCurrentZone(pos.line, pos.character) !==
          CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG
      ) {
        codeEnd = { ...pos };
        if (codeEnd.character === 0) {
          codeEnd.line--;
          codeEnd.character =
            languageService.model.getColumnCount(codeEnd.line) - 1;
          if (codeEnd.character < 0) {
            codeEnd.character = 0;
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

    if (!codeStart) {
      continue;
    }

    const codeLines = doc
      .getText({
        start: codeStart,
        end: codeEnd ?? symbol.range.end,
      })
      .split("\n");

    const lineGap = codeStart.line - docLines.length;
    if (lineGap > 0) {
      docLines = docLines.concat(Array(lineGap).fill(""));
    } else if (lineGap === -1 && codeLines[0] === "") {
      // head in one line: proc [lang]; submit;
      codeLines.shift();
    }

    docLines = docLines.concat(codeLines);

    // Add footer lines after each code block if specified
    if (options.footerLines) {
      docLines = docLines.concat(options.footerLines);
    }
  }

  return docLines.join("\n");
};
