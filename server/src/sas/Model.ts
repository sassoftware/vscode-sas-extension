// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocument } from "vscode-languageserver-textdocument";

import { TextRange } from "./utils";

export class Model {
  constructor(private doc: TextDocument) {}

  getLine(line: number): string {
    return this.doc.getText({
      start: { line, character: 0 },
      end: { line: line + 1, character: 0 },
    });
  }

  getLineCount(): number {
    return this.doc.lineCount;
  }

  getText(range: TextRange): string {
    return this.doc.getText({
      start: {
        line: range.start.line,
        character: range.start.column,
      },
      end: {
        line: range.end.line,
        character: range.end.column,
      },
    });
  }

  getColumnCount(line: number): number {
    return (
      this.doc.offsetAt({ line: line + 1, character: 0 }) -
      this.doc.offsetAt({ line, character: 0 })
    );
  }
}
