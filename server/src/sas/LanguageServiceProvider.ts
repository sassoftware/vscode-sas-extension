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
    "macro-keyword-param",
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
    this.addCommentFolding(result);

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
  private addCommentFolding(result: FoldingRange[]) {
    // Get multiline comments directly from lexer token processing
    const commentRanges = this.syntaxProvider.getMultilineComments();

    for (const range of commentRanges) {
      result.push({
        startLine: range.startLine,
        endLine: range.endLine,
        kind: "comment",
      });
    }
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

  /**
   * Detects whether a selected line is already wrapped as a single-line SAS block comment.
   */
  private isSingleLineComment(line: string): boolean {
    return /^\s*\/\*.*\*\/\s*$/.test(line);
  }

  /**
   * Wraps a single SAS statement in a block comment while preserving leading indentation.
   */
  private wrapSingleLine(line: string): string {
    const trimmed = line.trim();
    if (!trimmed || this.isSingleLineComment(line)) {
      return line;
    }

    const indentation = line.match(/^\s*/)?.[0] ?? "";
    return `${indentation}/*${trimmed}*/`;
  }

  /**
   * Removes a single-line SAS block comment wrapper while preserving the original indentation.
   */
  private unwrapSingleLine(line: string): string {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("/*") || !trimmed.includes("*/")) {
      return line;
    }

    const match = line.match(/^(\s*)\/\*\s*(.*?)\s*\*\/(\s*)$/);
    if (!match) {
      return line;
    }

    return `${match[1]}${match[2]}${match[3]}`;
  }

  /**
   * Returns true when a single selected line is a real embedded Python statement that should
   * defer to the editor's native comment command instead of SAS block-comment syntax.
   */
  private isSingleEmbeddedLine(range: Range, singleLineText: string): boolean {
    const normalizedText = this.isSingleLineComment(singleLineText)
      ? this.unwrapSingleLine(singleLineText)
      : singleLineText;

    return (
      range.start.line === range.end.line &&
      !/^(?:submit|endsubmit|run)\s*;?$/i.test(normalizedText.trim()) &&
      this.syntaxProvider.getSyntax(range.start.line)[0]?.style ===
        "embedded-code"
    );
  }

  /**
   * Toggles SAS block comments for the selected range.
   *
   * For SAS statements we comment each non-blank line independently, while single embedded
   * Python lines are left alone so the editor's native # comment handling can take over.
   */
  toggleLineComment(range: Range) {
    const singleLineText =
      range.start.line === range.end.line
        ? this.model
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
            .trim()
        : "";

    if (this.isSingleEmbeddedLine(range, singleLineText)) {
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
      .split(/\r\n|\r|\n/);

    // Decide if the selection is in "add comment" mode or "remove comment" mode.
    // Any non-empty, non-comment line means we should wrap with SAS block comments.
    let insideBlockComment = false;
    const shouldAdd = lines.some((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return false;
      }

      if (insideBlockComment) {
        if (trimmed.includes("*/")) {
          insideBlockComment = false;
        }
        return false;
      }

      if (trimmed.startsWith("/*")) {
        if (this.isSingleLineComment(line)) {
          return false;
        }
        insideBlockComment = true;
        return false;
      }

      return true;
    });

    if (shouldAdd) {
      insideBlockComment = false;
      return lines
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) {
            return line;
          }

          if (insideBlockComment) {
            if (trimmed.includes("*/")) {
              insideBlockComment = false;
            }
            return line;
          }

          if (trimmed.startsWith("/*")) {
            if (this.isSingleLineComment(line)) {
              return line;
            }
            insideBlockComment = true;
            return line;
          }

          return this.wrapSingleLine(line);
        })
        .join("\n");
    }

    return lines.map((line) => this.unwrapSingleLine(line)).join("\n");
  }

  setLibService(fn: LibService): void {
    return this.syntaxProvider.lexer.syntaxDb.setLibService(fn);
  }
}
