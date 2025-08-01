// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  DocumentSymbol,
  FoldingRange,
  SymbolKind,
} from "vscode-languageserver";
import type { Range, TextDocument } from "vscode-languageserver-textdocument";

import { CodeZoneManager } from "./CodeZoneManager";
import { CompletionProvider } from "./CompletionProvider";
import { FormatOnTypeProvider } from "./FormatOnTypeProvider";
import { FoldingBlock, LexerEx } from "./LexerEx";
import { Model } from "./Model";
import type { LibService } from "./SyntaxDataProvider";
import { SyntaxProvider } from "./SyntaxProvider";
import { Formatter } from "./formatter";

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

// DATA, PROC, MACRO, GBL, CUSTOM
const SymbolKinds = [
  SymbolKind.Struct,
  SymbolKind.Function,
  SymbolKind.Module,
  SymbolKind.Module,
  SymbolKind.Module,
];

export class LanguageServiceProvider {
  public model;
  public syntaxProvider;
  public completionProvider;
  public formatOnTypeProvider;
  public formatter;

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
    this.formatter = new Formatter(this.model, this.syntaxProvider);

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

  getCodeZoneManager(): CodeZoneManager {
    return this.completionProvider.getCodeZoneManager();
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

  getDocumentSymbols(): DocumentSymbol[] {
    const lineCount = this.model.getLineCount();
    const result: DocumentSymbol[] = [];

    for (let i = 0; i < lineCount; i++) {
      const rootBlock = this.syntaxProvider.getFoldingBlock(
        i,
        undefined,
        false,
        false,
        true,
      );
      if (rootBlock && rootBlock.startLine === i) {
        const docSymbol: DocumentSymbol = this._buildDocumentSymbol(rootBlock);
        if (docSymbol.name) {
          result.push(docSymbol);
        }
        i = rootBlock.endFoldingLine;
        continue;
      }
    }
    return result;
  }

  private _buildDocumentSymbol(
    block: FoldingBlock,
    parent?: DocumentSymbol,
  ): DocumentSymbol {
    const range: Range = {
      start: { line: block.startLine, character: block.startCol },
      end: { line: block.endFoldingLine, character: block.endFoldingCol },
    };
    const docSymbol: DocumentSymbol = {
      name: this.syntaxProvider.getSymbolName(block),
      kind: SymbolKinds[block.type],
      range,
      selectionRange: range,
      children: [],
    };
    if (parent && docSymbol.name) {
      parent.children!.push(docSymbol);
    }
    for (const innerBlock of block.innerBlocks) {
      this._buildDocumentSymbol(innerBlock, docSymbol);
    }
    return docSymbol;
  }

  getFoldingRanges(): FoldingRange[] {
    const lineCount = this.model.getLineCount();
    const result: FoldingRange[] = [];

    for (let i = 0; i < lineCount; i++) {
      const rootBlock = this.syntaxProvider.getFoldingBlock(
        i,
        undefined,
        false,
        false,
        true,
      );
      if (rootBlock && rootBlock.startLine === i) {
        const blocks: FoldingBlock[] = this._flattenFoldingBlockTree(rootBlock);
        for (const block of blocks) {
          result.push({
            startLine: block.startLine,
            endLine: block.endFoldingLine,
            kind: block.type === LexerEx.SEC_TYPE.CUSTOM ? "region" : undefined,
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

  getFoldingBlock(
    line: number,
    col: number,
    strict?: boolean,
    ignoreCustomBlock?: boolean,
    ignoreGlobalBlock?: boolean,
  ) {
    return this.syntaxProvider.getFoldingBlock(
      line,
      col,
      strict,
      ignoreCustomBlock,
      ignoreGlobalBlock,
    );
  }

  toggleLineComment(range: Range) {
    const token = this.syntaxProvider.getSyntax(range.start.line)[0];
    if (token?.style === "embedded-code") {
      return null;
    }
    const lines = this.model
      .getText({
        start: {
          line: range.start.line,
          column: 0,
        },
        end: {
          line: range.end.line,
          column: range.end.character,
        },
      })
      .split(/\n|\r\n/);
    const shouldAdd = lines.some(
      (line) => line.trim() !== "" && !/^\s*\/\*.*\*\/\s*$/.test(line),
    );
    if (shouldAdd) {
      return lines
        .map((line) => (line.trim() !== "" ? `/* ${line} */` : line))
        .join("\n");
    }
    return lines
      .map((line) => line.replace(/^(\s*)\/\* ?| ?\*\/(\s*)$/g, "$1"))
      .join("\n");
  }

  setLibService(fn: LibService): void {
    return this.syntaxProvider.lexer.syntaxDb.setLibService(fn);
  }
}
