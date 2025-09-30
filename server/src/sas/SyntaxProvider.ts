// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable @typescript-eslint/no-unused-vars,@typescript-eslint/no-explicit-any */
import { Token } from "./Lexer";
import { FoldingBlock, LexerEx } from "./LexerEx";
import { Model } from "./Model";
import { TextRange } from "./utils";

export interface Change {
  text: string;
  removedText: string;
  oldRange: TextRange;
  newRange: TextRange;
}

export interface SyntaxToken {
  start: number;
  state: any;
  style: Token["type"];
}

export class SyntaxProvider {
  private parsingQueue: Change[] = [];
  private parsingState = 2;
  private syntaxTable: SyntaxToken[][] = [];
  private lastToken: Omit<Token, "text"> | null = null;
  private currTokenIndex = 0;
  private parsedRange: any = {};
  private tailUnchangedSyntaxTable: SyntaxToken[][] = [];
  private removedSyntaxTable: SyntaxToken[][] = [];
  private _tokenCallback: ((token: Token) => void) | undefined;
  private _multilineComments: Array<{ startLine: number; endLine: number }> =
    [];

  public blockComment = { start: "/*", end: "*/" };
  public lexer;

  constructor(private model: Model) {
    this.lexer = new LexerEx(model);
  }

  // private functions
  private _push(change: Change) {
    this.parsingQueue.push(change);
  }
  private _startParse(change: Change) {
    let startLine = 0;
    this.currTokenIndex = 0;
    this.lastToken = null;
    this._multilineComments = []; // Clear previous comments
    this.parsingState = 1; //LanguageService.ParsingState.STARTING;
    this.parsedRange = this.lexer.start(change);

    startLine = this.parsedRange.endLine + 1;
    this.tailUnchangedSyntaxTable = this.syntaxTable.splice(
      startLine,
      this.syntaxTable.length - startLine,
    );
    this.removedSyntaxTable = this.syntaxTable.splice(
      this.parsedRange.startLine,
      startLine - this.parsedRange.startLine,
    );

    /*
      (1) ^ removed
      -----^^^^^     //keep the head part
      ^^^^^^^^^^
      ^^^-------   //keep the tail part
      (2)
      ---^^^^---    //keep the tail part and the head part
      (3)
      ----|-----   //no removed. keep the head part and tail part
      (4)
      --------
      ~~~~~~~~  // parsed
      ~~~~~~~~
      --------
      */
    const syntaxLine: SyntaxToken[] = [];
    let i = 0;
    const tmpSyntaxLine = this.removedSyntaxTable[0];
    // keep the head part
    if (this.parsedRange.startCol > 0 && tmpSyntaxLine) {
      while (
        tmpSyntaxLine[i] &&
        tmpSyntaxLine[i].start < this.parsedRange.startCol
      ) {
        syntaxLine.push(tmpSyntaxLine[i]);
        i++;
      }
      tmpSyntaxLine.splice(0, i); //remove

      let endCol = this.parsedRange.startCol;
      if (tmpSyntaxLine.length) {
        endCol = tmpSyntaxLine[0].start;
      }
      const tmp = syntaxLine[syntaxLine.length - 1];
      this.lastToken = {
        start: { line: this.parsedRange.startLine, column: tmp.start },
        end: { line: this.parsedRange.startLine, column: endCol },
        type: tmp.style,
      };
      this.currTokenIndex = syntaxLine.length;
      this.syntaxTable[this.parsedRange.startLine] = syntaxLine;
    }

    // remove changed (middle part)
    i = 0;
    if (
      this.parsedRange.startLine === this.parsedRange.endLine &&
      tmpSyntaxLine
    ) {
      while (
        tmpSyntaxLine[i] &&
        tmpSyntaxLine[i].start < this.parsedRange.endCol
      ) {
        i++;
      }
      tmpSyntaxLine.splice(0, i);
    }
    // for multiple lines, keep the last line for late usage, we handle it in _parse
    this._parse(change);
  }
  private _endParse(change: Change) {
    this.parsingState = 2; //LanguageService.ParsingState.ENDED;

    this._schedule();
  }
  private _schedule() {
    if (
      this.parsingState === 2 /*LanguageService.ParsingState.ENDED*/ &&
      this.parsingQueue.length
    ) {
      const change = this.parsingQueue.shift()!;
      this._startParse(change);
    }
  }
  private _parse(change: Change) {
    let token = null;
    try {
      for (;;) {
        token = this.lexer.getNext();
        this._addItem(token);
        if (!token || this.lexer.end()) {
          this._endParse(change);
          break;
        }
      }
    } catch (e: any) {
      if (e && e.changedLineCount !== undefined) {
        if (this.lastToken) {
          token = this.lastToken;
        } else if (this.syntaxTable.length === 0) {
          token = {
            type: "text",
            start: { line: 0, column: 0 },
            end: { line: 0, column: 0 },
          };
        } else {
          //ignored
        }

        // merge tokens
        let tailPart,
          validPos = 0;
        const len = this.removedSyntaxTable.length,
          line = e.token.start.line;
        if (
          len >= 1 &&
          line === this.parsedRange.endLine + e.changedLineCount
        ) {
          tailPart = this.removedSyntaxTable[len - 1];
          tailPart.forEach(function (item: { start: number }) {
            item.start += e.changedColCount;
            if (item.start < e.token.start.column) {
              validPos++;
            }
          });
          tailPart.splice(0, validPos);
          if (this.syntaxTable[line]) {
            //add blank token.
            this._tryToAddBlank(line, this.syntaxTable[line], tailPart);
            //
            this.syntaxTable[line] = this.syntaxTable[line].concat(tailPart);
          }
        } /*else if (parsedRange.startLine === parsedRange.endLine) {
          tailPart = removedSyntaxTable[0];
          tailPart.forEach(function(item) {
            item.start += e.changedColCount;
          });
          if (syntaxTable[parsedRange.startLine]) {//FIXID S1159519
           syntaxTable[parsedRange.startLine] = syntaxTable[parsedRange.startLine].concat(tailPart);
          }
        }*/

        // merge syntax table
        //_addEndMarkForSkippedLines(token, e.token.start.line);
        this.syntaxTable = this.syntaxTable.concat(
          this.tailUnchangedSyntaxTable,
        );
        this._endParse(change);
      } else {
        throw e;
      }
    }
  }
  private _tryToAddBlank(
    line: number,
    syntax: SyntaxToken[],
    added: SyntaxToken[],
  ) {
    if (syntax.length) {
      const token = syntax[syntax.length - 1];
      if (added.length) {
        const text = this.model
          .getLine(line)
          .substring(token.start, added[0].start);
        const matches = /\s+$/.exec(text);
        if (matches) {
          syntax.push({
            start: token.start + text.length - matches[0].length,
            state: null,
            style: "text",
          });
        }
      }
    }
  }
  private _addEndMarkForSkippedLines(
    token: Omit<Token, "text">,
    endLine: number,
  ) {
    let line = 0,
      column = 0,
      syntaxLine = null;
    if (token.end.line !== endLine) {
      line = token.end.line;
      column = token.end.column;
      do {
        syntaxLine = this.syntaxTable[line] = this.syntaxTable[line] || [];
        if (this.currTokenIndex < syntaxLine.length) {
          syntaxLine.splice(
            this.currTokenIndex,
            syntaxLine.length - this.currTokenIndex,
          ); //clear the garbages
        }
        //add end marks
        syntaxLine.push({ start: column, state: 0, style: "text" });
        line++;
        column = 0;
      } while (line < endLine);
      this.currTokenIndex = 0;
      this.lastToken = null;
    }
  }
  private _addItem(token: Omit<Token, "text">) {
    let line = 0,
      syntaxLine = null,
      addRange = false,
      addStartTag = true;
    if (this.lastToken) {
      // (1) line changed, handle the end marks
      // (2) end all, add marks for all skipped lines
      this._addEndMarkForSkippedLines(
        this.lastToken,
        token ? token.start.line : this.model.getLineCount(),
      );
    }
    if (!token) {
      return;
    }
    // handle new token
    line = token.start.line;
    //add blank to the head for old format requirement
    //(1) there are space(s) before the first token
    //(2) the token is a middle token,
    if (
      (this.lastToken === null && token.start.column > 0) ||
      (this.lastToken &&
        this.lastToken.end.column !== token.start.column &&
        this.lastToken.end.line === token.start.line)
    ) {
      syntaxLine = this.syntaxTable[line] = this.syntaxTable[line] || [];
      if (this.currTokenIndex < syntaxLine.length) {
        syntaxLine.splice(
          this.currTokenIndex,
          syntaxLine.length - this.currTokenIndex,
        );
      }
      syntaxLine.push({
        start: this.lastToken ? this.lastToken.end.column : 0,
        state: null,
        style: "text",
      });
      this.currTokenIndex++;
    }
    // ATTENTION: multiple lines condition
    if (token.end.line !== token.start.line) {
      addRange = true;
    }
    do {
      syntaxLine = this.syntaxTable[line] = this.syntaxTable[line] || [];
      //add the token
      if (this.currTokenIndex < syntaxLine.length) {
        //clear the unused elements
        syntaxLine.splice(
          this.currTokenIndex,
          syntaxLine.length - this.currTokenIndex,
        );
      }
      syntaxLine.push({
        start: line === token.start.line ? token.start.column : 0,
        state: addStartTag
          ? addRange
            ? { line: token.end.line, col: token.end.column }
            : 1
          : null,
        style: token.type,
      });
      this.currTokenIndex++;
      addRange = false;
      addStartTag = false;
      //next line
      if (line < token.end.line) {
        //add end marks, ignore the last line
        syntaxLine.push({
          start: this.model.getLine(line).length,
          state: 0,
          style: "text",
        });
        this.currTokenIndex = 0;
      }
      line++;
    } while (line <= token.end.line); //end do

    //currTokenIndex++;
    this.lastToken = {
      type: token.type,
      start: { line: token.start.line, column: token.start.column },
      end: { line: token.end.line, column: token.end.column },
    }; // jpnjfk

    if (this._tokenCallback) {
      this._tokenCallback({
        text: this.model.getText(token),
        type: token.type,
        start: { line: token.start.line, column: token.start.column },
        end: { line: token.end.line, column: token.end.column },
      });
    }

    // Collect multiline comments as they're processed by the lexer
    if (
      (token.type === "comment" || token.type === "macro-comment") &&
      token.end.line > token.start.line
    ) {
      this._multilineComments.push({
        startLine: token.start.line,
        endLine: token.end.line,
      });
    }
  }

  // public functions
  getSyntax(line: number): SyntaxToken[] {
    return this.syntaxTable[line] ? this.syntaxTable[line] : [];
  }
  getParseRange(change: Change) {
    return this.lexer.getParseRange(change);
  }
  getFoldingBlock(
    line: number,
    col?: number,
    strict?: boolean,
    ignoreCustomBlock?: boolean,
    ignoreGlobalBlock?: boolean,
  ): FoldingBlock | null {
    return this.lexer.getFoldingBlock(
      line,
      col,
      strict,
      ignoreCustomBlock,
      ignoreGlobalBlock,
    );
  }
  add(change: Change): void {
    this._push(change);
    this._schedule();
  }
  type(line: number, col: number): Token["type"] {
    const syntax = this.getSyntax(line),
      len = syntax.length;
    for (let i = 1; i < len; i++) {
      // TODO: improve algorithm
      if (syntax[i].start >= col) {
        if (syntax[i - 1].start <= col) {
          return syntax[i - 1].style;
        } else {
          return "text";
        }
      }
    } //try our best to get real type
    return syntax &&
      syntax.length === 2 &&
      syntax[0].start === 0 &&
      syntax[1].state === 0
      ? syntax[0].style
      : "text";
  }
  setTokenCallback(cb: ((token: Token) => void) | undefined): void {
    this._tokenCallback = cb;
  }
  getSymbolName(block: FoldingBlock) {
    const line = block.startLine;
    const tokens = this.getSyntax(line);
    for (let i = 2; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.start <= block.startCol) {
        continue;
      }
      if (token.style === "proc-name" || token.style === "text") {
        const end =
          i === tokens.length - 1
            ? this.model.getColumnCount(line)
            : tokens[i + 1].start;
        const tokenText = this.model.getText({
          start: { line, column: token.start },
          end: { line, column: end },
        });
        if (tokenText.trim() === "") {
          continue;
        }
        return `${block.name} ${
          token.style === "proc-name" ? tokenText.toUpperCase() : tokenText
        }`;
      }
    }
    return block.name;
  }
  getMultilineComments(): Array<{ startLine: number; endLine: number }> {
    return this._multilineComments;
  }
}
