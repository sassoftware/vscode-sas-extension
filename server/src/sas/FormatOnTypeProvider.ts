// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextEdit } from "vscode-languageserver";

import { CodeZoneManager } from "./CodeZoneManager";
import { Lexer } from "./Lexer";
import { FoldingBlock, LexerEx } from "./LexerEx";
import { Model } from "./Model";
import { SyntaxProvider, SyntaxToken } from "./SyntaxProvider";

const ZONE_TYPE = CodeZoneManager.ZONE_TYPE;

export class FormatOnTypeProvider {
  private czMgr;
  private loader;

  constructor(
    private model: Model,
    private syntaxProvider: SyntaxProvider,
  ) {
    this.loader = syntaxProvider.lexer.syntaxDb;
    this.czMgr = new CodeZoneManager(model, this.loader, syntaxProvider);
  }

  public getIndentEdit(
    line: number,
    col: number,
    triggerChar: string,
    tabSize: number,
    useSpace: boolean,
  ): TextEdit[] {
    if (triggerChar === "\n") {
      return this._getEnterTriggeredIndentEdit(line - 1, tabSize, useSpace);
    } else if (triggerChar === ";") {
      return this._getSemicolonTriggeredIndentEdit(
        line,
        col - 1,
        tabSize,
        useSpace,
      );
    }
    return [];
  }

  private _getSemicolonTriggeredIndentEdit(
    line: number,
    semicolonCol: number,
    tabSize: number,
    useSpace: boolean,
  ): TextEdit[] {
    const ZT = ZONE_TYPE;
    // validate end of zone
    const zoneBeforeSemicolon: number = this.czMgr.getCurrentZone(
      line,
      semicolonCol,
    );
    const zoneAfterSemicolon: number = this.czMgr.getCurrentZone(
      line,
      semicolonCol + 1,
    );
    let curBlockZoneType: "proc" | "data" | "macro" | undefined;
    let shouldDecIndent = false;
    if (
      zoneAfterSemicolon === ZONE_TYPE.GBL_STMT ||
      zoneAfterSemicolon === ZONE_TYPE.COMMENT ||
      zoneAfterSemicolon === undefined
    ) {
      switch (zoneBeforeSemicolon) {
        case ZT.PROC_STMT:
        case ZT.PROC_STMT_OPT:
        case ZT.PROC_STMT_OPT_REQ:
        case ZT.PROC_STMT_OPT_VALUE:
        case ZT.PROC_STMT_SUB_OPT:
        case ZT.PROC_STMT_SUB_OPT_VALUE:
          !curBlockZoneType && (curBlockZoneType = "proc");
        // eslint-disable-next-line no-fallthrough
        case ZT.DATA_STEP_STMT:
        case ZT.DATA_STEP_STMT_OPT:
        case ZT.DATA_STEP_STMT_OPT_VALUE:
          !curBlockZoneType && (curBlockZoneType = "data");
        // eslint-disable-next-line no-fallthrough
        case ZT.MACRO_STMT:
        case ZT.MACRO_STMT_OPT:
        case ZT.MACRO_STMT_OPT_VALUE:
        case ZT.MACRO_STMT_BODY: {
          !curBlockZoneType && (curBlockZoneType = "macro");
          shouldDecIndent = true;
          break;
        }
      }
    }

    const foldingBlock: FoldingBlock | null =
      this.syntaxProvider.getFoldingBlock(
        line,
        semicolonCol,
        false,
        true,
        true,
      );
    // Detect recursive block, which is not supported yet
    switch (curBlockZoneType) {
      case "data": {
        if (foldingBlock?.type !== LexerEx.SEC_TYPE.DATA) {
          return [];
        }
        break;
      }
      case "proc": {
        if (foldingBlock?.type !== LexerEx.SEC_TYPE.PROC) {
          return [];
        }
        break;
      }
      case "macro": {
        if (foldingBlock?.type !== LexerEx.SEC_TYPE.MACRO) {
          return [];
        }
        break;
      }
    }

    let referLine;
    let extraIndent = 0;
    if (!foldingBlock || foldingBlock.startLine === line) {
      const lastNotEmptyLine = this._getLastNotEmptyLine(line - 1);
      if (lastNotEmptyLine === undefined) {
        return [];
      } else {
        referLine = lastNotEmptyLine;
      }
      if (foldingBlock?.startLine === line && line > 0) {
        const prevLineText = this.model.getLine(line - 1);
        const lastFoldingBlock: FoldingBlock | null =
          this.syntaxProvider.getFoldingBlock(
            line - 1,
            prevLineText.length - 1,
            false,
            true,
            true,
          );
        if (
          lastFoldingBlock?.startLine === line - 1 &&
          lastFoldingBlock?.startLine !== lastFoldingBlock?.endLine
        ) {
          // if the last line is the start line of the block, need to add extra indent.
          extraIndent = tabSize;
        }
      }
    } else {
      referLine = foldingBlock.startLine;
    }
    // when the ending word is in the separate line as following cases, the indentationRules cannot match it,
    // we need to ajust the line indent to the same as the last line.
    if (!shouldDecIndent) {
      /*
       * if the ending word is part of a string or comment and is in the next line.
       * a ='
       * run;
       */
      const [tokenText, tokenCol, tokenStyle] = this._getPrevValidTokenInfo(
        line,
        semicolonCol - 1,
        false,
      );
      if (tokenStyle && ["comment", "string"].includes(tokenStyle)) {
        const curLineText = this.model.getLine(line);
        if (
          curLineText.match(
            /(;|^\s*)(\s|\/\*.*\*\/|\*[^;]*;)*(run|quit|%mend)(\s|\/\*.*\*\/|\*[^;]*;)*;$/i,
          )
        ) {
          shouldDecIndent = true;
        }
      }
      /*
       * a =
       * run;
       */
      if (
        tokenText &&
        ["RUN", "QUIT", "%MEND"].includes(tokenText.toUpperCase())
      ) {
        let sameLinePrevTokenText;
        if (tokenCol) {
          [sameLinePrevTokenText] = this._getPrevValidTokenInfo(
            line,
            tokenCol - 1,
            false,
          );
        }
        // if no valid token in the same line, we should find the last valid token in the last line.
        if (!sameLinePrevTokenText) {
          const [prevLineTokenText] = this._getPrevValidTokenInfo(
            line - 1,
            undefined,
          );
          if (prevLineTokenText !== ";") {
            shouldDecIndent = true;
          }
        }
      }
      if (!shouldDecIndent) {
        return [];
      }
      referLine = line - 1;
      // if the last line is the start line of the block, need to add extra indent.
      // it's impossible to be the end line of the block here.
      if (foldingBlock?.startLine === line - 1) {
        extraIndent = tabSize;
      }
    }

    const referLineText = this.model.getLine(referLine);
    const referLineIndentLen = this._getIndentLength(referLineText, tabSize);
    const expectedCurLineIndent = referLineIndentLen + extraIndent;
    const curLineText = this.model.getLine(line);
    const curLineIndentText = this._getIndentText(curLineText);
    const curLineIndentLen = this._getIndentLength(curLineText, tabSize);
    if (expectedCurLineIndent === curLineIndentLen) {
      return [];
    } else {
      const expectedCurLineIndentText = this._makeIndentText(
        expectedCurLineIndent,
        useSpace,
        tabSize,
      );
      return [
        TextEdit.replace(
          {
            start: { line: line, character: 0 },
            end: { line: line, character: curLineIndentText.length },
          },
          expectedCurLineIndentText,
        ),
      ];
    }
  }

  private _getEnterTriggeredIndentEdit(
    line: number,
    tabSize: number,
    useSpace: boolean,
  ): TextEdit[] {
    // find indent text
    const lastNotEmptyLine = this._getLastNotEmptyLine(line);
    if (lastNotEmptyLine === undefined) {
      return [];
    }
    const lastNotEmptyLineText = this.model.getLine(lastNotEmptyLine);
    const nextLineText =
      line < this.model.getLineCount() - 1 ? this.model.getLine(line + 1) : "";
    const nextLineIndentText = this._getIndentText(nextLineText);

    // calculate indent length
    const curIndentLen = this._getIndentLength(lastNotEmptyLineText, tabSize);
    const nextLineIndentInc: number | undefined =
      this._getIndentIncrementOfNextLine(
        lastNotEmptyLine,
        curIndentLen,
        tabSize,
      );
    if (nextLineIndentInc === undefined) {
      return [];
    }
    const expectedNextLineIndentLen = curIndentLen + nextLineIndentInc;
    const actualNextLineIndentLen = this._getIndentLength(
      nextLineText,
      tabSize,
    );

    if (expectedNextLineIndentLen === actualNextLineIndentLen) {
      return [];
    } else {
      const expectedNextLineIndentText = this._makeIndentText(
        expectedNextLineIndentLen,
        useSpace,
        tabSize,
      );
      return [
        TextEdit.replace(
          {
            start: { line: line + 1, character: 0 },
            end: { line: line + 1, character: nextLineIndentText.length },
          },
          expectedNextLineIndentText,
        ),
      ];
    }
  }

  private _getIndentIncrementOfNextLine(
    line: number,
    curIndent: number,
    tabSize: number,
  ): number | undefined {
    // find semicolon token
    const tokens: SyntaxToken[] = this.syntaxProvider.getSyntax(line);
    const cleanedTokens = this._cleanTokens(line, tokens);
    if (cleanedTokens.length === 0) {
      return 0;
    }
    // find patterns of "data xxx;", "proc xxx;" or "%macro xxx;"
    const lineText = this.model.getLine(line);
    let curIndex = cleanedTokens.length;
    do {
      curIndex = this._findSemicolonTokenRightToLeft(
        line,
        cleanedTokens,
        curIndex - 1,
      );
      if (curIndex <= 0) {
        return 0;
      }
      const tokenBeforeSemicolon = cleanedTokens[curIndex - 1]; // curIndex must be > 0
      const tokenBeforeSemicolonText = this._getTokenText(
        cleanedTokens,
        curIndex - 1,
        lineText,
      ).trim();
      if (
        (tokenBeforeSemicolon.style === Lexer.TOKEN_TYPES.SKEYWORD ||
          tokenBeforeSemicolon.style === Lexer.TOKEN_TYPES.MSKEYWORD) &&
        (tokenBeforeSemicolonText.toLowerCase() === "run" ||
          tokenBeforeSemicolonText.toLowerCase() === "quit" ||
          tokenBeforeSemicolonText.toLowerCase() === "%mend")
      ) {
        return 0;
      }
      // calculate indent
      const prevSemicolonZone: number = this.czMgr.getCurrentZone(
        line,
        tokenBeforeSemicolon.start,
      );
      if (
        prevSemicolonZone === CodeZoneManager.ZONE_TYPE.RESTRICTED ||
        prevSemicolonZone === CodeZoneManager.ZONE_TYPE.MACRO_SUB_OPT_NAME
      ) {
        return undefined;
      }
      if (this._isDefZone(prevSemicolonZone)) {
        return tabSize - (curIndent % tabSize);
      }
    } while (curIndex > 0);
    return 0;
  }

  /**
   * remove comment, blanks
   */
  private _cleanTokens(line: number, tokens: SyntaxToken[]): SyntaxToken[] {
    const lineText = this.model.getLine(line);
    const cleanedTokens: SyntaxToken[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const curToken = tokens[i];
      const text = this._getTokenText(tokens, i, lineText);
      if (this._isCommentOrBlankToken(curToken, text)) {
        continue;
      }
      cleanedTokens.push(curToken);
    }
    return cleanedTokens;
  }

  private _findSemicolonTokenRightToLeft(
    line: number,
    tokens: SyntaxToken[],
    startIndex: number,
  ): number {
    const lineText = this.model.getLine(line);
    if (startIndex < 0) {
      return -1;
    } else if (startIndex >= tokens.length) {
      startIndex = tokens.length - 1;
    }
    let semicolonTokenIdx = -1;
    for (let i = startIndex; i >= 0; i--) {
      const curToken = tokens[i];
      if (lineText[curToken.start] === ";") {
        semicolonTokenIdx = i;
        break;
      }
    }
    return semicolonTokenIdx;
  }

  private _isDefZone(codeZode: number) {
    const ZT = CodeZoneManager.ZONE_TYPE;
    switch (codeZode) {
      case ZT.DATA_STEP_DEF:
      case ZT.DATA_STEP_DEF_OPT:
      case ZT.DATA_STEP_OPT_NAME:
      case ZT.DATA_STEP_OPT_VALUE:
      case ZT.DATA_SET_NAME:
      case ZT.VIEW_OR_DATA_SET_NAME:
      case ZT.DATA_SET_OPT_NAME:
      case ZT.DATA_SET_OPT_VALUE:
      case ZT.VIEW_OR_PGM_NAME:
      case ZT.VIEW_OR_PGM_OPT_NAME:
      case ZT.VIEW_OR_PGM_OPT_VALUE:
      case ZT.VIEW_OR_PGM_SUB_OPT_NAME:
      case ZT.PROC_DEF:
      case ZT.PROC_OPT:
      case ZT.PROC_OPT_VALUE:
      case ZT.PROC_SUB_OPT_NAME:
      case ZT.MACRO_DEF:
      case ZT.MACRO_DEF_OPT:
      case ZT.MACRO_FUNC:
      case ZT.MACRO_VAR:
        return true;
      default:
        return false;
    }
  }

  private _getLastNotEmptyLine(line: number): number | undefined {
    let lastNotEmptyLine = undefined;
    let lastNotEmptyLineText = "";
    for (let i = line; i >= 0; i--) {
      lastNotEmptyLineText = this.model.getLine(i);
      if (!this._isEmptyLine(lastNotEmptyLineText)) {
        lastNotEmptyLine = i;
        break;
      }
    }
    return lastNotEmptyLine;
  }

  private _makeIndentText(
    expectedIndentLen: number,
    useSpace: boolean,
    tabSize: number,
  ): string {
    let indentText;
    if (useSpace) {
      indentText = " ".repeat(expectedIndentLen);
    } else {
      const tabCount = Math.floor(expectedIndentLen / tabSize);
      indentText = "\t".repeat(tabCount);
      const spaceCount = expectedIndentLen % tabSize;
      indentText += " ".repeat(spaceCount);
    }
    return indentText;
  }

  private _getIndentText(line: string): string {
    let pos = 0;
    while (pos < line.length) {
      if (line[pos] === " " || line[pos] === "\t") {
        pos++;
      } else {
        break;
      }
    }
    return line.substring(0, pos);
  }

  private _getIndentLength(line: string, tabSize: number): number {
    let indentLen = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === " ") {
        indentLen++;
      } else if (line[i] === "\t") {
        indentLen += tabSize - (indentLen % tabSize);
      } else {
        break;
      }
    }
    return indentLen;
  }

  private _isEmptyLine(line: string) {
    return !/\S/.test(line);
  }

  private _getTokenText(
    tokens: SyntaxToken[],
    index: number,
    lineText: string,
  ): string {
    if (index < 0 || index >= tokens.length) {
      return "";
    }
    const curToken = tokens[index];
    let text;
    if (index === tokens.length - 1) {
      text = lineText.substring(curToken.start);
    } else {
      text = lineText.substring(curToken.start, tokens[index + 1].start);
    }
    return text;
  }

  private _getPrevValidTokenInfo(
    line: number,
    col: number | undefined,
    needMultiLine = true,
  ): [string, number, string] | [] {
    const tokens: SyntaxToken[] = this.syntaxProvider.getSyntax(line);
    let _line = line;
    while (_line >= 0) {
      const lineText = this.model.getLine(line);
      for (let i = tokens.length - 1; i >= 0; i--) {
        const curToken = tokens[i];
        const text = this._getTokenText(tokens, i, lineText);
        if (
          !this._isCommentOrBlankToken(curToken, text) &&
          curToken.start <= (_line < line || !col ? lineText.length : col)
        ) {
          return [text, curToken.start, curToken.style];
        }
      }
      if (!needMultiLine) {
        return [];
      }
      _line--;
    }
    return [];
  }

  private _isCommentOrBlankToken(token: SyntaxToken, text: string): boolean {
    const TOKEN_TYPES = Lexer.TOKEN_TYPES;
    if (
      token.style === TOKEN_TYPES.COMMENT ||
      token.style === TOKEN_TYPES.MCOMMENT
    ) {
      return true;
    }
    return this._isEmptyLine(text);
  }
}
