// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Range, TextDocument } from "vscode-languageserver-textdocument";
import { DocumentSymbol, SymbolKind } from "vscode-languageserver-types";

import { CompletionProvider } from "./CompletionProvider";
import { FormatOnTypeProvider } from "./FormatOnTypeProvider";
import { FoldingBlock } from "./LexerEx";
import { Model } from "./Model";
import type { LibService } from "./SyntaxDataProvider";
import { SyntaxProvider } from "./SyntaxProvider";

export const legend = {
  tokenTypes: [
    "sep",
    "keyword",
    "sec-keyword",
    "proc-name",
    "comment",
    "macro-keyword",
    "macro-comment",
    "macro-ref",
    "macro-sec-keyword",
    "cards-data",
    "string",
    "date",
    "time",
    "dt",
    "bitmask",
    "namelit",
    "hex",
    "numeric",
    "format", //, 'text', 'blank'
  ],
  tokenModifiers: [],
};

function getType(type: string) {
  return legend.tokenTypes.indexOf(type);
}

// DATA, PROC, MACRO
const SymbolKinds = [SymbolKind.Struct, SymbolKind.Function, SymbolKind.Module];

export class LanguageServiceProvider {
  private model;
  private syntaxProvider;
  public completionProvider;
  public formatOnTypeProvider;

  constructor(doc: TextDocument) {
    this.model = new Model(doc);
    this.syntaxProvider = new SyntaxProvider(this.model);
    this.completionProvider = new CompletionProvider(
      this.model,
      this.syntaxProvider,
    );
    this.formatOnTypeProvider = new FormatOnTypeProvider(
      this.model,
      this.syntaxProvider,
    );

    const lineCount = this.model.getLineCount();

    this.syntaxProvider.add({
      text: "",
      removedText: "",
      oldRange: {
        start: {
          line: 0,
          column: 0,
        },
        end: {
          line: 0,
          column: 0,
        },
      },
      newRange: {
        start: {
          line: 0,
          column: 0,
        },
        end: {
          line: lineCount - 1,
          column: this.model.getColumnCount(lineCount - 1),
        },
      },
    });
  }

  getTokens(): number[] {
    const lineCount = this.model.getLineCount();

    const data: number[] = [];
    let prevLine = 0;
    let prevChar = 0;

    for (let i = 0; i < lineCount; i++) {
      const line = this.model.getLine(i);
      const tokens = this.syntaxProvider.getSyntax(i);
      for (let j = 0; j < tokens.length; j++) {
        const type = getType(tokens[j].style);
        const end = j === tokens.length - 1 ? line.length : tokens[j + 1].start;
        if (type < 0) {
          continue;
        }
        data.push(
          i - prevLine,
          prevLine === i ? tokens[j].start - prevChar : tokens[j].start,
          end - tokens[j].start,
          type,
          0,
        );
        prevLine = i;
        prevChar = tokens[j].start;
      }
    }

    return data;
  }

  getFoldingBlocks(): DocumentSymbol[] {
    const lineCount = this.model.getLineCount();
    const result: DocumentSymbol[] = [];

    for (let i = 0; i < lineCount; i++) {
      const rootBlock = this.syntaxProvider.getFoldingBlock(i);
      if (rootBlock && rootBlock.startLine === i) {
        const flattenBlocks = this._flattenFoldingBlockTree(rootBlock);
        for (const block of flattenBlocks) {
          const range: Range = {
            start: { line: block.startLine, character: block.startCol },
            end: { line: block.endFoldingLine, character: block.endFoldingCol },
          };
          result.push({
            name:
              block.type === 1
                ? this._getProcName(block.startLine)
                : block.name,
            kind: SymbolKinds[block.type],
            range,
            selectionRange: range,
          });
        }
        i = rootBlock.endFoldingLine;
        continue;
      }
    }
    return result;
  }

  // DFS
  private _flattenFoldingBlockTree(rootBlock: FoldingBlock): FoldingBlock[] {
    const stack: FoldingBlock[] = [rootBlock];
    const resultList: FoldingBlock[] = [];
    while (stack.length > 0) {
      const curBlock: FoldingBlock = stack.pop()!;
      resultList.push(curBlock);
      for (let i = curBlock.innerBlocks.length - 1; i >= 0; i--) {
        const innerBlock = curBlock.innerBlocks[i];
        stack.push(innerBlock);
      }
    }
    return resultList;
  }

  getFoldingBlock(line: number, col: number) {
    return this.syntaxProvider.getFoldingBlock(line, col, true);
  }

  setLibService(fn: LibService): void {
    return this.syntaxProvider.lexer.syntaxDb.setLibService(fn);
  }

  private _getProcName(line: number) {
    const tokens = this.syntaxProvider.getSyntax(line);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.style === "proc-name") {
        const end =
          i === tokens.length - 1
            ? this.model.getColumnCount(line)
            : tokens[i + 1].start;
        return (
          "PROC " +
          this.model
            .getText({
              start: { line, column: token.start },
              end: { line, column: end },
            })
            .toUpperCase()
        );
      }
    }
    return "";
  }
}
