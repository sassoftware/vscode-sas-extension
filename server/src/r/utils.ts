// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { LanguageServiceProvider } from "../sas/LanguageServiceProvider";
import { extractEmbeddedLanguageCode } from "../utils/embeddedLanguageUtils";

export const extractRCodes = (
  doc: TextDocument,
  languageService: LanguageServiceProvider,
): string => {
  return extractEmbeddedLanguageCode(doc, languageService, {
    procName: "PROC RLANG",
  });
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
