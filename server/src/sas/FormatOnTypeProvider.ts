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
    // If no need to decrease indent
    if (!shouldDecIndent) {
      return [];
    }
    // Otherwise, need to decrease indent of current line
    const foldingBlock: FoldingBlock | null =
      this.syntaxProvider.getFoldingBlock(
        line,
        semicolonCol,
        false,
        true,
        true,
      );
    let blockStartLine;
    if (!foldingBlock) {
      const lastNotEmptyLine = this._getLastNotEmptyLine(line - 1);
      if (lastNotEmptyLine === undefined) {
        return [];
      } else {
        blockStartLine = lastNotEmptyLine;
      }
    } else {
      blockStartLine = foldingBlock.startLine;
    }
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
    const blockStartLineText = this.model.getLine(blockStartLine);
    const blockStartIndentLen = this._getIndentLength(
      blockStartLineText,
      tabSize,
    );
    const expectedCurLineIndent = blockStartIndentLen;
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
      if (prevSemicolonZone === CodeZoneManager.ZONE_TYPE.RESTRICTED) {
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
