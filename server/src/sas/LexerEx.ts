// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable */
import { Lexer, Token } from "./Lexer";
import { Model } from "./Model";
import { SyntaxDataProvider } from "./SyntaxDataProvider";
import { Change } from "./SyntaxProvider";
import {
  TextPosition,
  arrayToMap,
  isCustomRegionEndComment,
  isCustomRegionStartComment,
} from "./utils";

/**
 * LexerEx to handle basic semantic related problems.
 */

export class FoldingBlock {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  type: any;
  name: string;
  endFoldingLine: number;
  endFoldingCol: number;
  collapsed?: boolean;
  explicitEnd: any;
  explicitEndStmt: any;
  specialBlks: any;
  sectionIdx: number | undefined;
  blockComment: boolean | undefined;
  outerBlock?: FoldingBlock;
  innerBlocks: FoldingBlock[];
  constructor(...arg: any[]) {
    if (arguments.length === 1) {
      //copy constructor
      this.startLine = arguments[0].startLine;
      this.startCol = arguments[0].startCol;
      this.endLine = arguments[0].endLine;
      this.endCol = arguments[0].endCol;
      this.type = arguments[0].type;
      this.name = arguments[0].name;
      this.endFoldingLine = arguments[0].endFoldingLine;
      this.endFoldingCol = arguments[0].endFoldingCol;
      this.outerBlock = arguments[0].outerBlock;
      this.innerBlocks = [...arguments[0].innerBlocks];
    } else if (arguments.length >= 4) {
      this.startLine = arguments[0];
      this.startCol = arguments[1];
      this.endLine = arguments[2];
      this.endCol = arguments[3];
      this.type = arguments[4];
      this.name = arguments[5] ? arguments[5] : "";
      this.innerBlocks = [];
      this.endFoldingLine = -1;
      this.endFoldingCol = -1;
    } else {
      this.startLine = -1;
      this.startCol = -1;
      this.endLine = -1;
      this.endCol = -1;
      this.type = -1;
      this.name = "";
      this.endFoldingLine = -1;
      this.endFoldingCol = -1;
      this.innerBlocks = [];
    }
  }
}

//var StmtBlock = FoldingBlock;
const TknBlock = FoldingBlock;

const stmtAlias: Record<string, string> = {
  OPTION: "OPTIONS",
  GOPTION: "GOPTIONS",
};

const regComment =
    /(\/\*[\s\S]*?\*\/)|(^\s*\*[\s\S]*?;)|(;\s*\*[\s\S]*?;)|(%\*[\s\S]*?;)/i,
  regConst = /('|")([\s\S]*?)(\1)/i,
  regMacro = /%macro\b(?!.+%mend;)/i,
  regCardsStart = /(^\s*|;\s*)(data)(;|[\s]+[^;]*;)/i, //first ;
  regCards = /(;[\s]*)(cards|lines|datalines)(;|[\s]+[^;]*;)/i, //TODO: for the code having label
  regCards4 = /(;[\s]*)(cards4|lines4|datalines4)(;|[\s]+[^;]*;)/i,
  regParmcardsStart =
    /(^\s*|;\s*)(proc)(\s*\/\*[\s\S]+\*\/\s*|\s+)(explode)(;|[\s]+[^;]*;)/i,
  regParmcards = /(;[\s]*)(parmcards)(;|[\s]+[^;]*;)/i,
  regParmcards4 = /(;[\s]*)(parmcards4)(;|[\s]+[^;]*;)/i,
  regCardsEnd = /([^;]*;)/im,
  regCards4End = /(\n^;;;;)/im,
  cards = {
    start: regCardsStart,
    cards: regCards,
    end: regCardsEnd,
  },
  cards4 = {
    start: regCardsStart,
    cards: regCards4,
    end: regCards4End,
  },
  parmcards = {
    start: regParmcardsStart,
    cards: regParmcards,
    end: regCardsEnd,
  },
  parmcards4 = {
    start: regParmcardsStart,
    cards: regParmcards4,
    end: regCards4End,
  };

export class LexerEx {
  lexer: Lexer;
  expr: Expression;
  syntaxDb: SyntaxDataProvider;
  SEC_TYPE: typeof LexerEx.SEC_TYPE;
  PARSING_STATE: {
    IN_GBL: number;
    IN_MACRO: number;
    IN_PROC: number;
    IN_DATA: number;
  };
  isTokenWithScopeMarks: any;
  CARDS_STATE: {
    IN_NULL: number;
    IN_CMD: number;
    IN_DATA: number;
    IN_DATA_WAITING: number;
  };
  cardsState: any;
  startLineForCardsData: number;
  stack: any;
  curr: any;
  lookAheadTokens: any[];
  sectionCache: (FoldingBlock | null)[];
  lastToken: any;
  sections: FoldingBlock[] = [];
  tailSections: FoldingBlock[] = [];
  currSection?: FoldingBlock;
  //stmts: any[] = [],
  //currStmt,
  //isStmtStart = true,
  tokens: any[] = [];
  tknBlks: any[] = [];
  tailTknBlks: FoldingBlock[] = [];
  changedLineCount = 0;
  changedColCount = 0;

  static readonly SEC_TYPE = {
    DATA: 0,
    PROC: 1,
    MACRO: 2,
    GBL: 3,
    CUSTOM: 4,
  };

  constructor(private model: Model) {
    this.lexer = new Lexer(model);
    this.expr = new Expression(this);
    this.syntaxDb = new SyntaxDataProvider();
    this.SEC_TYPE = LexerEx.SEC_TYPE;
    this.PARSING_STATE = {
      IN_GBL: 0,
      IN_MACRO: 1,
      IN_PROC: 2,
      IN_DATA: 3,
    };
    this.isTokenWithScopeMarks = {
      comment: 1,
      "macro-comment": 1,
      string: 1,
      date: 1,
      time: 1,
      dt: 1,
      bitmask: 1,
      namelit: 1,
      hex: 1,
    };
    this.CARDS_STATE = {
      IN_NULL: 0,
      IN_CMD: 1,
      IN_DATA: 2,
      IN_DATA_WAITING: 3,
    };
    this.cardsState = this.CARDS_STATE.IN_NULL;
    this.startLineForCardsData = 0;
    this.stack = null;
    this.curr = null;
    this.lookAheadTokens = [];
    this.sectionCache = [];
    this.lastToken = null;
    // support to cache collapsible block
    this.sections = [];
    this.currSection = new FoldingBlock(); //this is ref to FoldingBlock obj
    //currStmt = new StmtBlock();
  }

  // The definition of return value is same to getBlockPos1_
  // FIXID S1178400
  private getBlockPos2_(
    blocks: FoldingBlock[],
    currentIdx: number,
    line: number,
    col: number,
  ) {
    let i = currentIdx,
      block = blocks[i];
    const pos = { line: line, column: col };

    if (
      !block ||
      this._isBetween(pos, this._startPos(block), this._endPos(block), true)
    ) {
      return currentIdx;
    }

    if (this._isBefore(pos, this._startPos(block))) {
      /*
        |[] <-
      */
      do {
        i--;
        block = blocks[i];
      } while (
        block &&
        !this._isBetween(pos, this._startPos(block), this._endPos(block), true)
      ); // []|

      return block ? i : -1;
    } else {
      /*
        []| ->
      */
      do {
        i++;
        block = blocks[i];
      } while (
        block &&
        !this._isBetween(pos, this._startPos(block), this._endPos(block), true)
      ); // |[]
      return block ? i : -1;
    }
  }

  private _startPos(block: FoldingBlock) {
    return { line: block.startLine, column: block.startCol };
  }
  private _endPos(block: FoldingBlock) {
    return { line: block.endLine, column: block.endCol };
  }
  private _setStart(block: FoldingBlock, pos: TextPosition) {
    block.startLine = pos.line;
    block.startCol = pos.column;
  }
  private _setEnd(block: FoldingBlock, pos: TextPosition) {
    block.endLine = pos.line;
    block.endCol = pos.column;
  }
  private _sectionEndPos(block: FoldingBlock) {
    return { line: block.endFoldingLine, column: block.endFoldingCol };
  }
  private _setSectionEnd(block: FoldingBlock, pos: TextPosition) {
    block.endFoldingLine = pos.line;
    block.endFoldingCol = pos.column;
  }

  private _getNextValidTknBlkIdx(startIndex: number) {
    // section index
    let i = startIndex,
      section;
    const max = this.sections.length - 1;

    while (i <= max) {
      section = this.sections[i];
      if (section && section.specialBlks) {
        return section.specialBlks[0];
      }
      i++;
    }
    return -1;
  }

  private _checkCards4(
    regExp: { start: RegExp; cards: RegExp; end?: RegExp },
    text: string,
  ) {
    let cards = null;

    const start = regExp.start.exec(text); //find start statement
    if (start) {
      text = text.substring(start.index + start[0].length);
      cards = regExp.cards.exec(text); // find cards statement
    }

    return cards;
  }
  private _saveRemoveDataLines(
    regExp: { start: RegExp; cards: RegExp; end: RegExp },
    text: string,
  ) {
    let done;

    function _removeDataLines(text: string) {
      let start, cards, end, len;
      const parts = [];

      done = true;
      for (;;) {
        start = regExp.start.exec(text); //find start statement
        if (start) {
          len = start.index + start[0].length;
          parts.push(text.substring(0, len));
          text = ";" + text.substring(len); //NOTE: add ;
          cards = regExp.cards.exec(text); // find cards statement
          if (cards) {
            parts.push(text.substring(0, cards.index + 1));
            text = text.substring(cards.index + cards[0].length); //remove cards;
            end = regExp.end.exec(text); //find end position of cards data
            if (end) {
              text = text.substring(end.index + end[0].length);

              if (parts.length > 400) {
                // jump out to release memory
                done = false;
                break;
              }
            } else {
              parts.push(cards[0]);
              //text = "";
              break;
            }
          } else {
            parts.push(text.substring(1)); // no cards, we should keep the remaining
            break;
          }
        } else {
          parts.push(text);
          break;
        }
      }
      return parts.join("");
    }

    do {
      text = _removeDataLines(text);
    } while (!done);
    return text;
  }

  private _remove(reg: RegExp, text: string, replacement?: string) {
    const parts = [];
    for (;;) {
      const matched = reg.exec(text);
      if (matched) {
        parts.push(text.substring(0, matched.index));
        if (replacement) {
          parts.push(replacement);
        }
        text = text.substring(matched.index + matched[0].length);
      } else {
        parts.push(text);
        break;
      }
    }
    return parts.join("");
  }

  private _removeComment(text: string) {
    return this._remove(regComment, text);
  }

  private _removeConst(text: string) {
    return this._remove(regConst, text, "x");
  }

  private _isBlank(text: string) {
    return /^\s*$/.test(text);
  }

  private _isTailDestroyed(change: Change, block: FoldingBlock) {
    const oldRange = change.oldRange;
    if (
      !this._isBefore(oldRange.end, this._endPos(block)) ||
      (block.type !== LexerEx.SEC_TYPE.GBL &&
        block.explicitEnd &&
        this._isBefore(block.explicitEndStmt.start, oldRange.end))
    ) {
      return true;
    }
    return false;
  }
  private _isCollapsedPartially(block: FoldingBlock) {
    return block && block.collapsed && block.endLine !== block.endFoldingLine;
  }
  private _isBetween(
    pos: TextPosition,
    start: TextPosition,
    end: TextPosition,
    inclusive?: boolean,
  ) {
    return (
      this._isBefore(start, pos, inclusive) &&
      this._isBefore(pos, end, inclusive)
    );
  }

  private _isBefore(
    pos1: TextPosition,
    pos2: TextPosition,
    inclusive?: boolean,
  ) {
    if (pos1.line < pos2.line) {
      return true;
    } else if (pos1.line === pos2.line) {
      if (inclusive) {
        return pos1.column <= pos2.column;
      } else {
        return pos1.column < pos2.column;
      }
    } else {
      return false;
    }
  }

  private _getBlkIndex(
    startSectionIdx: number,
    containerName: string,
    blocks: FoldingBlock[],
  ) {
    let i = startSectionIdx,
      section: any = this.sections[i],
      blockIdxs = null;
    while (section && !section[containerName]) {
      i++;
      section = this.sections[i];
    }
    if (section) {
      blockIdxs = section[containerName];
    }
    return blockIdxs ? blockIdxs[0] : blocks.length;
  }
  private _handleSpecialBlocks(
    change: Change,
    parseRange: any,
    getBlkIndex: { (startSectionIdx: any): any; (arg0: any): any },
    blocks: FoldingBlock[],
  ) {
    if (this.sections.length <= 0 || parseRange.removedBlocks.count <= 0) {
      return;
    }
    //find start idx
    const startIdx = getBlkIndex(parseRange.removedBlocks.start);
    // find end idx
    const endIdx = getBlkIndex(parseRange.removedBlocks.end + 1); // must be here

    const unchangedBlocks = blocks;
    blocks = unchangedBlocks.splice(0, startIdx);
    // t1 t2 t3 [] t4 ...
    // no tokens are destroyed if i > end
    // t1 [t2 t3 t4] t5 ...
    // t1 [t2 .....
    // t1 [t2 ...) ti...
    if (unchangedBlocks.length > 0 && endIdx > startIdx) {
      // remove blocks
      unchangedBlocks.splice(0, endIdx - startIdx);

      // adjust token coordinate
      this._adjustBlocksCoord(unchangedBlocks, change, parseRange);
    }
    return { blocks: blocks, unchangedBlocks: unchangedBlocks };
  }
  private _getTknBlkIndex(startSectionIdx: number) {
    return this._getBlkIndex(startSectionIdx, "specialBlks", this.tknBlks);
  }

  private _adjustPosCoord(change: Change, pos: TextPosition) {
    if (pos.line === change.oldRange.end.line) {
      let index = -1,
        col;
      const addedCount = change.text.length,
        len1 = change.oldRange.start.column,
        len2 = pos.column - change.oldRange.end.column;

      index = change.text.lastIndexOf("\n");
      if (index >= 0) {
        // multiple lines
        col =
          change.text[change.text.length - 1] === "\n"
            ? len2
            : addedCount - index - 1 + len2;
      } else {
        col = len1 + addedCount + len2;
      }

      pos.column = col;
    } //ignore pos.line <> change.oldRange.end.line

    pos.line +=
      change.newRange.end.line -
      change.newRange.start.line -
      change.oldRange.end.line +
      change.oldRange.start.line;
  }

  private _adjustBlocksCoord(
    blocks: FoldingBlock[],
    change: Change,
    parseRange: { endLine: number },
  ) {
    const len = blocks.length;
    let i, pos;
    this.changedLineCount =
      change.newRange.end.line -
      change.newRange.start.line -
      change.oldRange.end.line +
      change.oldRange.start.line;

    for (i = 0; i < len; i++) {
      if (
        blocks[i].startLine > parseRange.endLine &&
        this.changedLineCount === 0
      ) {
        break;
      }
      pos = this._startPos(blocks[i]);
      this._adjustPosCoord(change, pos);
      this._setStart(blocks[i], pos);

      pos = this._endPos(blocks[i]);
      this._adjustPosCoord(change, pos);
      this._setEnd(blocks[i], pos);
      // TODO: not very good, folding block end
      const isSection = arrayToMap([
        LexerEx.SEC_TYPE.DATA,
        LexerEx.SEC_TYPE.PROC,
        LexerEx.SEC_TYPE.MACRO,
      ]);
      if (isSection[blocks[i].type]) {
        pos = this._sectionEndPos(blocks[i]);
        this._adjustPosCoord(change, pos);
        this._setSectionEnd(blocks[i], pos);
      }
    }
  }

  private _isHeadDestroyed(change: Change, block: FoldingBlock) {
    const oldRange = change.oldRange,
      blank = this._isBlank(change.text + change.removedText);
    if (this._isBefore(oldRange.start, this._startPos(block)) && !blank) {
      //PROC PROCEDURE DATA %MACRO
      return true;
    } else if (oldRange.start.line === block.startLine) {
      const offset = oldRange.start.column - block.startCol;
      if (change.text === "=") {
        const text = this.model
          .getLine(block.startLine)
          .slice(block.startCol, oldRange.start.column);
        return /(PROC|PROCEDURE|DATA)\s*/i.test(this._removeComment(text));
      }
      if (offset === 0 && blank) {
        return false;
      } else if (offset <= block.name.length) {
        return true;
      }
    }
    return false;
  }

  private _cleanKeyword(keyword: string) {
    if (/^(TITLE|FOOTNOTE|AXIS|LEGEND|PATTERN|SYMBOL)\d{0,}$/.test(keyword)) {
      const results = keyword.match(
          /(^(TITLE|FOOTNOTE|AXIS|LEGEND|PATTERN|SYMBOL)|\d{0,}$)/g,
        )!,
        nbr = parseInt(results[1], 10);
      let isKeyword = false;

      switch (results[0]) {
        case "TITLE":
        case "FOOTNOTE":
          isKeyword = nbr < 11 && nbr > 0;
          break;
        case "AXIS":
        case "LEGEND":
          isKeyword = nbr < 100 && nbr > 0;
          break;
        case "PATTERN":
        case "SYMBOL":
          isKeyword = nbr < 256 && nbr > 0;
          break;
      }
      if (isKeyword) {
        keyword = results[0];
      }
    } else {
      const alias = stmtAlias[keyword];
      if (alias) {
        keyword = alias;
      }
    }

    return keyword;
  }
  private adjustFoldingEnd_(prevBlock: FoldingBlock, currBlock: FoldingBlock) {
    if (
      prevBlock.endLine > prevBlock.startLine &&
      prevBlock.endLine === currBlock.startLine
    ) {
      prevBlock.endFoldingLine = prevBlock.endLine - 1;
      prevBlock.endFoldingCol = this.model.getColumnCount(
        prevBlock.endFoldingLine,
      );
    } else {
      prevBlock.endFoldingLine = prevBlock.endLine;
      prevBlock.endFoldingCol = prevBlock.endCol;
    }
  }
  private _pushRootBlock(block: FoldingBlock) {
    // adjust previous block
    const stack: FoldingBlock[] = [block];
    while (stack.length > 0) {
      const curBlock: FoldingBlock = stack.pop()!;
      for (let i = curBlock.innerBlocks.length - 1; i >= 0; i--) {
        const innerBlock = curBlock.innerBlocks[i];
        stack.push(innerBlock);
      }
    }
    this._adjustBlockTreeFoldingEnd(block);
    if (this.sections.length) {
      this.adjustFoldingEnd_(this.sections[this.sections.length - 1], block);
    }
    // add
    this.sections.push(block);
    this.tokens = [];
  }

  private _adjustBlockTreeFoldingEnd(rootBlock: FoldingBlock): void {
    for (let i = 1; i < rootBlock.innerBlocks.length; i++) {
      this.adjustFoldingEnd_(
        rootBlock.innerBlocks[i - 1],
        rootBlock.innerBlocks[i],
      );
    }
    for (let i = 0; i < rootBlock.innerBlocks.length; i++) {
      this._adjustBlockTreeFoldingEnd(rootBlock.innerBlocks[i]);
    }
  }

  //TODO: IMPROVE
  private _changeCardsDataToken(token: {
    type: string;
    start: TextPosition;
    end: TextPosition;
  }) {
    this.tokens.pop();
    this.tokens.push(token);
    return token;
  }
  private _clonePos(pos: TextPosition) {
    return { line: pos.line, column: pos.column };
  }
  private startFoldingBlock_(type: any, pos: TextPosition, name: string) {
    const newBlock = new FoldingBlock();
    newBlock.startLine = pos.line;
    newBlock.startCol = pos.column;
    newBlock.type = type;
    newBlock.name = name;
    newBlock.specialBlks = null;
    if (!this.currSection) {
      this.currSection = newBlock;
    } else {
      this.currSection.innerBlocks.push(newBlock);
      newBlock.outerBlock = this.currSection;
      this.currSection = newBlock;
    }
  }

  private endFoldingBlock_(
    type: any,
    pos: TextPosition,
    explicitEnd?: boolean,
    start?: { start: any },
    name?: string,
  ) {
    if (!this.currSection) {
      return;
    }
    if (pos.line >= this.currSection.startLine) {
      this.currSection.endLine = pos.line;
      this.currSection.endCol = pos.column;
      this.trimBlock_(this.currSection);
      // folding end
      this.sectionCache[this.currSection.startLine] = null; // clear cached block, it must try to get the last
      this.currSection.endFoldingLine = this.currSection.endLine;
      this.currSection.endFoldingCol = this.currSection.endCol;
      //currSection.type = type;
      if (!this.currSection.outerBlock) {
        this.currSection.explicitEnd = explicitEnd;
        if (explicitEnd) {
          this.currSection.explicitEndStmt = {};
          this.currSection.explicitEndStmt.start = start?.start;
          this.currSection.explicitEndStmt.name = name;
        }
        if (this.currSection.specialBlks) {
          this.currSection.specialBlks = this.currSection.specialBlks;
          this.currSection.specialBlks = null;
        }
        this._pushRootBlock(this.currSection);
      }
    }
    this.currSection = this.currSection.outerBlock;
  }
  private hasFoldingBlock_(): boolean {
    return !!this.currSection;
  }
  private getLastNormalFoldingBlockInLine_(
    currentIdx: number,
    line: number,
    blocks: FoldingBlock[],
  ): FoldingBlock | null {
    let i = currentIdx,
      block = blocks[i],
      idx = currentIdx;
    // find forward
    while (block && (block.startLine === line || block.endLine === line)) {
      if (block.type !== this.SEC_TYPE.GBL) {
        idx = i;
      } else idx = -1;
      i++;
      block = blocks[i];
    }
    // find backward
    if (idx < 0) {
      i = currentIdx - 1;
      block = blocks[i];
      while (block && (block.startLine === line || block.endLine === line)) {
        if (block.type !== this.SEC_TYPE.GBL) {
          idx = i;
          break;
        } else idx = -1;
        i--;
        block = blocks[i];
      }
    }
    return blocks[idx] ?? null;
    //return sections[idx]?sections[idx]:null; //we return null if no
  }
  private getFoldingBlock_(
    blocks: FoldingBlock[],
    line: number,
    col?: number,
    strict?: boolean,
  ): FoldingBlock | null {
    const idx = this.getBlockPos_(blocks, line, col);
    let block: FoldingBlock | null = blocks[idx];
    let found: boolean = false;
    if (strict) {
      found = !!block;
    } else if (block && block.startLine <= line && block.endLine >= line) {
      block = this.getLastNormalFoldingBlockInLine_(idx, line, blocks);
      found = !!block;
    } else if (col) {
      // for last block, the input position is the last
      block = blocks[blocks.length - 1];
      if (
        block &&
        !this._isBefore({ line: line, column: col }, this._endPos(block)) &&
        !block.explicitEnd
      ) {
        // must use !
        found = true;
      }
    }
    if (found) {
      if (block!.innerBlocks.length > 0) {
        return (
          this.getFoldingBlock_(block!.innerBlocks, line, col, strict) ?? block
        );
      } else {
        return block;
      }
    } else {
      return null;
    }
  }
  getFoldingBlock(
    line: number,
    col?: number,
    strict?: boolean,
    ignoreCustomBlock?: boolean,
    ignoreGlobalBlock?: boolean,
  ): FoldingBlock | null {
    let block: FoldingBlock | null = null;
    if (col === undefined) {
      if (!this.sectionCache[line]) {
        const section = this.getFoldingBlock_(this.sections, line);
        if (section && line <= section.endFoldingLine!) {
          this.sectionCache[line] = section;
        } else {
          this.sectionCache[line] = null;
        }
      }
      block = this.sectionCache[line];
    } else {
      block = this.getFoldingBlock_(this.sections, line, col, strict);
    }
    while (
      (ignoreCustomBlock && block?.type === this.SEC_TYPE.CUSTOM) ||
      (ignoreGlobalBlock && block?.type === this.SEC_TYPE.GBL)
    ) {
      block = block.outerBlock ?? null;
    }
    return block;
  }
  private getBlockPos_(blocks: FoldingBlock[], line: number, col?: number) {
    let idx = this.getBlockPos1_(blocks, line);
    if (col || col === 0) {
      idx = this.getBlockPos2_(blocks, idx, line, col); // multiple blocks are in one same lines
    }
    return idx;
  }

  //SUPPORT CODE FOLDING
  //we define global statments as a kind of block, so the return will always be the first form.
  //
  private getBlockPos1_(blocks: FoldingBlock[], line: number) {
    const len = blocks.length,
      flags: any = {};
    let m = Math.floor(len / 2),
      l = 0,
      r = len - 1;
    if (len) {
      for (;;) {
        flags[m] = true;
        if (line <= blocks[m].endLine) {
          if (line >= blocks[m].startLine) {
            return m;
          } else {
            r = m;
            m = Math.floor((l + r) / 2); // to left
          }
        } else {
          l = m;
          m = Math.ceil((l + r) / 2); //to right
        }
        if (flags[m]) {
          if (line >= blocks[m].endLine) {
            return m + 1;
          } else {
            return m;
          }
        }
      }
    }
    return 0;
  }
  private resetFoldingBlockCache_() {
    this.sections = [];
  }
  private tryEndFoldingBlock_(
    pos: TextPosition,
    untilType?: number,
    lastPos?: TextPosition,
  ) {
    if (!lastPos) {
      lastPos = pos;
    }
    if (this.hasFoldingBlock_()) {
      // handle text end
      let secType = this.SEC_TYPE.PROC;
      if (this.curr.state === this.PARSING_STATE.IN_DATA) {
        secType = this.SEC_TYPE.DATA;
      } else if (this.curr.state === this.PARSING_STATE.IN_MACRO) {
        secType = this.SEC_TYPE.MACRO;
      } else if (this.curr.state === this.PARSING_STATE.IN_GBL) {
        secType = this.SEC_TYPE.GBL;
      }
      let stop = false;
      while (this.currSection && !stop) {
        if (untilType && this.currSection.type === untilType) {
          stop = true;
        }
        this.endFoldingBlock_(secType, stop ? lastPos : pos);
      }
    }
  }
  private tryStop_(token: Token) {
    let len = this.tailSections.length;
    //this.tryToAddStmtBlock_(token);
    this.tryToAddTknBlock_(token);
    //this.tryToAddCardsBlock_(token);
    if (
      token &&
      len &&
      !this._isBefore(token.start, this._startPos(this.tailSections[0]))
    ) {
      if (this.hasFoldingBlock_()) {
        if (this.currSection?.type === this.SEC_TYPE.MACRO) {
          this.tailSections.splice(0, 1);
          return;
        }
        this.tryEndFoldingBlock_(this.lastToken.end);
      }
      // adjust the associated information
      let blkIdx = this.tknBlks.length;
      let sectionIdx = this.sections.length;
      let i,
        j = 0;
      this.tailSections.forEach((section) => {
        if (section.specialBlks) {
          i = 0;
          len = section.specialBlks.length;
          for (; i < len; i++) {
            section.specialBlks[i] = blkIdx;
            if (this.tailTknBlks[j]) {
              this.tailTknBlks[j].sectionIdx = sectionIdx;
            }
            j++;
            blkIdx++;
          }
        }
        sectionIdx++;
      });
      if (this.sections.length && this.tailSections.length) {
        this.adjustFoldingEnd_(
          this.sections[this.sections.length - 1],
          this.tailSections[0],
        );
      }
      // merge
      this.sections = this.sections.concat(this.tailSections);
      this.tknBlks = this.tknBlks.concat(this.tailTknBlks);
      this.lastToken = null;
      throw {
        changedLineCount: this.changedLineCount,
        changedColCount: this.changedColCount,
        type: "skip-syntax-parsing",
        token: token,
      };
    }
    if (token) this.tokens.push(token);
  }
  printBlocks() {
    for (let i = 0; i < this.sections.length; i++) {
      //sas.log.info(sections[i].startLine + '-'+sections[i].endLine);
    }
  }
  private normalizeStart_(block: FoldingBlock) {
    if (
      block.startCol !== 0 &&
      block.startCol === this.model.getColumnCount(block.startLine) &&
      block.startLine + 1 < this.model.getLineCount()
    ) {
      block.startLine++;
      block.startCol = 0;
    }
  }
  private normalizeEnd_(block: FoldingBlock) {
    if (
      block.endCol <= 0 &&
      block.endLine > 0 &&
      this.model.getColumnCount(block.endCol) > 0
    ) {
      block.endLine--;
      block.endCol = this.model.getColumnCount(block.endLine);
    }
  }
  private normalizeBlock_(block: FoldingBlock) {
    this.normalizeStart_(block);
    this.normalizeEnd_(block);
  }
  private trimBlock_(block: FoldingBlock) {
    const lastToken = this.getLastToken_(block);
    if (lastToken) {
      block.endLine = lastToken.end.line;
      block.endCol = lastToken.end.column;
    }
    this.normalizeBlock_(block);
    //if (block.type === this.SEC_TYPE.GBL && this.isBlank_(block)) {
    //    block.blank = true;
    //}
  }
  private getLastToken_(block: FoldingBlock) {
    let i = this.tokens.length - 1;
    // skip the tokens belonging to next block
    // while(i >= 0 && this.getWord_(tokens[i]) !== ';') {
    while (
      this.tokens[i] &&
      (this.tokens[i].start.line > block.endLine ||
        (this.tokens[i].start.line === block.endLine &&
          this.tokens[i].start.column >= block.endCol))
    ) {
      i--;
    }
    while (i >= 0 && /^\s*$/g.test(this.lexer.getText(this.tokens[i]))) {
      i--;
    }
    if (i >= 0) {
      return this.tokens[i];
    }
    return null;
  }
  private getChange_(blocks: FoldingBlock[], origPos: TextPosition) {
    const idx = this.getBlockPos_(blocks, origPos.line, origPos.column);
    let blockIdx = idx,
      block: any = {
        startLine: 0,
        startCol: 0,
        endLine: 0,
        endCol: 0,
      };

    if (blocks[idx]) {
      block = blocks[idx];
    } else if (blocks.length > 0 && idx >= blocks.length) {
      blockIdx = blocks.length - 1;
      block = blocks[blockIdx];
      if (block.explicitEnd) {
        block = {
          startLine: block.endLine,
          startCol: block.endCol,
          endLine: this.model.getLineCount() - 1,
          endCol: 0,
        };
        block.endCol = this.model.getColumnCount(block.endLine);

        if (this._isBefore(this._endPos(block), this._startPos(block))) {
          block.endLine = block.startLine;
          block.endCol = block.startCol;
        }

        blockIdx++; //no block
      }
    }

    return {
      startLine: block.startLine,
      startCol: block.startCol,
      endLine: block.endLine,
      endCol: block.endCol,
      blockIdx: blockIdx,
    };
  }
  private _getParseRange(blocks: FoldingBlock[], change: Change) {
    const oldRange = change.oldRange,
      changeStart: any = this.getChange_(blocks, oldRange.start),
      removedBlocks: any = {};
    let range = changeStart,
      changeEnd;
    if (
      oldRange.start.line === oldRange.end.line &&
      oldRange.start.column === oldRange.end.column
    ) {
      //no removed
      changeStart.removedBlocks = {
        start: changeStart.blockIdx,
        end: changeStart.blockIdx,
      };
      //return changeStart;
    } else {
      changeEnd = this.getChange_(blocks, oldRange.end); //TODO: May improve some situations
      if (
        changeEnd.startLine > changeStart.startLine &&
        changeEnd.endLine < changeStart.endLine
      ) {
        // end is in start
        changeStart.removedBlocks = {
          start: changeStart.blockIdx,
          end: changeStart.blockIdx,
        };
        //return changeStart;
      } else {
        let startLine, startCol, endLine, endCol;

        if (changeEnd.startLine > changeStart.startLine) {
          //gbl-head -> in-block
          startLine = changeStart.startLine;
          startCol = changeStart.startCol;
        } else if (changeStart.startLine === changeEnd.startLine) {
          //exist, two blocks is in one same line,
          startLine = changeStart.startLine;
          startCol =
            changeStart.startCol > changeEnd.startCol
              ? changeEnd.startCol
              : changeStart.startCol; // the latter does not exist
        } else {
          //exist
          startLine = changeEnd.startLine;
          startCol = changeEnd.startCol;
        }

        if (changeStart.endLine > changeEnd.endLine) {
          //not exist
          endLine = changeStart.endLine;
          endCol = changeStart.endCol;
          //assert('error');
        } else if (changeStart.endLine === changeEnd.endLine) {
          //exist, two blocks is in one same line
          endLine = changeStart.endLine;
          endCol =
            changeStart.endCol > changeEnd.endCol
              ? changeStart.endCol
              : changeEnd.endCol; //the former does not exist
        } else {
          //exist
          endLine = changeEnd.endLine;
          endCol = changeEnd.endCol;
        }

        removedBlocks.start = changeStart.blockIdx;
        removedBlocks.end = changeEnd.blockIdx;

        range = {
          startLine: startLine,
          startCol: startCol,
          endLine: endLine,
          endCol: endCol,
          removedBlocks: removedBlocks,
        };
      }
    }
    return range;
  }
  //API
  getParseRange(change: Change) {
    return this.getParseRangeBySections_(change);
  }
  private getParseRangeBySections_(change: Change) {
    const blocks = this.sections;
    const range = this._getParseRange(blocks, change);
    // include the previous part
    let currBlock = blocks[range.removedBlocks.start - 1],
      prevBlock = null;

    if (currBlock) {
      range.startLine = currBlock.endLine;
      range.startCol = currBlock.endCol;
    } else {
      //if (currBlock && _isBefore(change.oldRange.start, _startPos(range))) {
      range.startLine = 0; //change.oldRange.start.line;
      range.startCol = 0; //change.oldRange.start.column;
    }

    currBlock = blocks[range.removedBlocks.start];

    if (currBlock) {
      prevBlock = blocks[range.removedBlocks.start - 1];
      if (
        prevBlock &&
        ((this._isHeadDestroyed(change, currBlock) && !prevBlock.explicitEnd) ||
          this._isCollapsedPartially(prevBlock))
      ) {
        //check whether re-parse the previous block
        range.startLine = prevBlock.startLine;
        range.startCol = prevBlock.startCol;
        range.removedBlocks.start--;
      } else if (
        !this._isBefore(change.oldRange.start, this._endPos(currBlock)) &&
        currBlock.explicitEnd
      ) {
        // use '!'
        range.removedBlocks.start++;
        range.startLine = currBlock.endLine;
        range.startCol = currBlock.endCol;
      }
    }
    // const, comment
    const sectionToChange = this._checkSpecialChange(change, range);
    if (sectionToChange >= 0) {
      if (sectionToChange === this.sections.length) {
        range.endLine = this.model.getLineCount() - 1;
        range.endCol = this.model.getColumnCount(range.endLine);
        range.removedBlocks.end = blocks.length - 1;
      } else if (sectionToChange > range.removedBlocks.end) {
        range.endLine = this.sections[sectionToChange].endLine;
        range.endCol = this.sections[sectionToChange].endCol;
        range.removedBlocks.end = sectionToChange;
      }
    } else {
      let nextBlockIdx = range.removedBlocks.end,
        nextBlock = null;
      currBlock = blocks[nextBlockIdx];
      if (currBlock && this._isTailDestroyed(change, currBlock)) {
        do {
          nextBlockIdx++;
          nextBlock = blocks[nextBlockIdx];
        } while (nextBlock && nextBlock.type === this.SEC_TYPE.GBL); //we should parse the subsequent global block

        if (nextBlock) {
          nextBlockIdx--;
          if (nextBlockIdx === range.removedBlocks.end) {
            // neighbor
            nextBlockIdx++;
          }
          nextBlock = blocks[nextBlockIdx];
          range.endLine = nextBlock.endLine;
          range.endCol = nextBlock.endCol;
        } else {
          // all are global blocks after the current
          range.endLine = this.model.getLineCount() - 1;
          range.endCol = this.model.getColumnCount(range.endLine);
        }
        range.removedBlocks.end = nextBlockIdx;
      }
    }
    if (range.removedBlocks.end >= blocks.length) {
      range.removedBlocks.end = blocks.length - 1;
    }
    if (
      range.removedBlocks.start >= 0 &&
      range.removedBlocks.start < blocks.length
    ) {
      range.removedBlocks.count =
        range.removedBlocks.end - range.removedBlocks.start + 1;
    } else {
      range.removedBlocks.count = 0;
    }

    // collect blocks
    if (blocks.length > 0 && range.removedBlocks.count > 0) {
      range.removedBlocks.blocks = [];
      for (
        let i = range.removedBlocks.start;
        i >= 0 && i <= range.removedBlocks.end;
        i++
      ) {
        range.removedBlocks.blocks.push(blocks[i]);
      }
    }

    return range;
  }
  private trimRange_(range: { endLine: number; endCol: number }) {
    if (range.endLine > this.model.getLineCount()) {
      range.endLine = this.model.getLineCount() - 1;
      if (range.endLine < 0) {
        range.endCol = 0;
      }
    }
    while (range.endCol <= 0) {
      range.endLine--;
      if (range.endLine < 0) {
        range.endLine = 0;
        range.endCol = 0;
        break;
      } else {
        range.endCol = this.model.getColumnCount(range.endLine); //has problem when deleting
      }
    }
  }

  private start_(change: Change) {
    const parseRange = this.getParseRangeBySections_(change);

    //this.trimRange_(parseRange);
    this._handleTokens(change, parseRange);
    //this._handleStmts(change, parseRange);
    this._handleSections(change, parseRange); // this must be called at last

    this.stack = [{ parse: this.readProg_, state: this.PARSING_STATE.IN_GBL }];
    this.curr = null;
    this.currSection = undefined;
    this.sectionCache.splice(
      parseRange.startLine,
      this.sectionCache.length - parseRange.startLine,
    );
    this.lexer.startFrom(parseRange.startLine, parseRange.startCol);
    return parseRange;
  }

  private _handleSections(change: Change, parseRange: any) {
    // keep the blocks not changed
    this.tailSections = this.sections;
    this.sections = this.tailSections.splice(0, parseRange.removedBlocks.start);
    if (parseRange.removedBlocks !== undefined) {
      this.tailSections.splice(0, parseRange.removedBlocks.count);
    }
    this.changedColCount = 0;
    if (this.tailSections.length) {
      const oldCol = this.tailSections[0].startCol;
      this._adjustBlocksCoord(this.tailSections, change, parseRange);
      this.changedColCount = this.tailSections[0].startCol - oldCol;
    }
  }
  // _handleStmts(
  //   change: any,
  //   parseRange: {
  //     startLine: number;
  //     startCol: number;
  //     endLine: number;
  //     endCol: number;
  //     blockIdx: number;
  //   }
  // ) {
  //   var parseRange = this._getParseRange(stmts, change);
  //   //sas.log.info("changed statement:" + parseRange);
  // }
  _docEndPos() {
    const line = this.model.getLineCount() - 1;
    return { line: line, column: this.model.getColumnCount(line) };
  }
  private _getParseText(change: Change & { type: string }, parseRange: any) {
    const startSection = this.sections[parseRange.removedBlocks.start],
      endSection = this.sections[parseRange.removedBlocks.end],
      tmpBlks = [];
    let start, end, tmpBlk, nextSection;
    if (!startSection) {
      return change.text;
    }

    const prevSection = this.sections[parseRange.removedBlocks.start - 1];
    if (prevSection) {
      start = this._endPos(prevSection);
    } else {
      start = { line: 0, column: 0 };
    }

    if (change.type === "textChanged") {
      nextSection = this.sections[parseRange.removedBlocks.end + 1];
      if (
        nextSection /*&& _isBefore(change.newRange.end, _startPos(nextSection))*/
      ) {
        tmpBlk = new FoldingBlock(nextSection);
        tmpBlks.push(tmpBlk);
        this._adjustBlocksCoord(tmpBlks, change, parseRange);
        end = this._startPos(tmpBlk);
      } else {
        end = this._docEndPos();
      }
      return this.model.getText({ start: start, end: end });
    } else {
      const part1 = this.model.getText({
        start: start,
        end: change.oldRange.start,
      });

      end = endSection ? this._endPos(endSection) : this._docEndPos();
      const part2 = this.model.getText({
        start: change.oldRange.end,
        end: end,
      });

      return part1 + change.text + part2;
    }
  }
  private _getNextComment(startIndex: number) {
    // section index
    let i = this._getNextValidTknBlkIdx(startIndex);
    while (this.tknBlks[i] && this.tknBlks[i].blockComment !== true) {
      i++;
    }
    return this.tknBlks[i];
  }
  private _getNextCards4(startIndex: number) {
    let i = this._getNextValidTknBlkIdx(startIndex);
    while (
      this.tknBlks[i] &&
      !Lexer.isCards4[this.tknBlks[i].name] &&
      !Lexer.isParmcards4[this.tknBlks[i].name]
    ) {
      i++;
    }
    return this.tknBlks[i];
  }
  private _checkSpecialChange(
    change: any,
    parseRange: {
      startLine?: number;
      startCol?: number;
      endLine?: number;
      endCol?: number;
      blockIdx?: number;
      removedBlocks?: any;
    },
  ) {
    const regQuotesStart = /['"]/gim,
      regBlockCommentStart = /\/\*/gim;
    let text = this._getParseText(change, parseRange),
      nextBlockComment = null,
      nextBlockCards4 = null,
      sectionToChange = -1;
    //sas.log.info("changed special tokens:" + tknParseRange);
    // text is of the blocks impacted directly
    // clean up text
    text = this._removeComment(text); //remove normal comments
    text = this._removeConst(text);
    // NOTE:
    // (1) cards contain comment-like data, and matched token is outside
    // (2) cards contain const-like data, and matched token is ourside
    text = this._saveRemoveDataLines(cards, text);
    text = this._saveRemoveDataLines(cards4, text);
    text = this._saveRemoveDataLines(parmcards, text);
    text = this._saveRemoveDataLines(parmcards4, text);
    text = text.replace(/\n/g, " ");
    //text = text.replace(regConst, "x");

    // check comment
    change = regBlockCommentStart.test(text);
    if (change) {
      //if (tknParseRange.removedBlocks) { // the block comment will stop to the next block comment if the current is not end normally
      nextBlockComment = this._getNextComment(parseRange.removedBlocks.end + 1);
      if (nextBlockComment) {
        text += " /**/"; //with a space before /**/
        sectionToChange = nextBlockComment.sectionIdx;
        text = this._removeComment(text);
        regBlockCommentStart.lastIndex = 0;
        change = regBlockCommentStart.test(text);
      }
      //}
      if (change) {
        return this.sections.length; // always reparse all
      }
    }

    // check const
    change = regQuotesStart.test(text);
    if (change) {
      return this.sections.length;
    }

    // check macro
    change = regMacro.test(text);
    if (change) {
      return this.sections.length;
    }

    if (text.lastIndexOf("*") > 0) {
      // S1454652: *comment need following ';'
      sectionToChange = parseRange.removedBlocks.end + 1;
      if (sectionToChange > this.sections.length) {
        return this.sections.length;
      }
    }
    if (sectionToChange > 0) {
      return sectionToChange;
    }

    // check cards
    change = this._checkCards4(cards4, text);
    if (change) {
      if (parseRange.removedBlocks) {
        nextBlockCards4 = this._getNextCards4(parseRange.removedBlocks.end + 1);
        if (nextBlockCards4) {
          text += " \n;;;;\n";
          sectionToChange = nextBlockCards4.sectionIdx;
          text = this._saveRemoveDataLines(cards4, text);
          change = this._checkCards4(cards4, text);
        }
      }
      if (change) {
        return this.sections.length;
      }
    }
    // check parmcards
    change = this._checkCards4(parmcards4, text);
    if (change) {
      if (parseRange.removedBlocks) {
        nextBlockCards4 = this._getNextCards4(parseRange.removedBlocks.end + 1);
        if (nextBlockCards4) {
          text += " \n;;;;\n";
          sectionToChange = nextBlockCards4.sectionIdx;
          text = this._saveRemoveDataLines(parmcards4, text);
          change = this._checkCards4(parmcards4, text);
        }
      }
      if (change) {
        return this.sections.length;
      }
    }
    if (sectionToChange > 0) {
      return sectionToChange;
    }

    return -1;
  }
  private _handleTokens(change: Change, parseRange: any) {
    const ret = this._handleSpecialBlocks(
      change,
      parseRange,
      this._getTknBlkIndex,
      this.tknBlks,
    );
    if (ret) {
      this.tknBlks = ret.blocks;
      this.tailTknBlks = ret.unchangedBlocks;
    }
  }
  //adjustTokenType_(token){//FIX S0891785 : Not all procs color code
  setKeyword_(
    token: {
      type?: any;
      text?: any;
      start?: TextPosition | undefined;
      end?: TextPosition | undefined;
      notCheckKeyword?: any;
    },
    isKeyword: boolean,
  ) {
    //assert(token, "Token must be valid.");
    //assert(SasLexer.isWord[token.type], "Token must be word type.");
    if (token.type === "text") {
      if (isKeyword) {
        token.type = Lexer.TOKEN_TYPES.KEYWORD;
        token.notCheckKeyword = true;
      }
    }
    return token;
  }
  private addTknBlock_(block: FoldingBlock) {
    if (!this.currSection) {
      // unexpected
      return;
    }
    if (!this.currSection.specialBlks) {
      //const with quotes, comment, cards data
      this.currSection.specialBlks = [];
    }
    this.currSection.specialBlks.push(this.tknBlks.length);

    this.tknBlks.push(block);
  }
  private tryToAddTknBlock_(token: Token) {
    if (token && this.isTokenWithScopeMarks[token.type]) {
      const block = new TknBlock(
        token.start.line,
        token.start.column,
        token.end.line,
        token.end.column,
        token.type,
        this.lexer.getText(token),
      );
      block.sectionIdx = this.sections.length; //TODO: Improve this
      block.blockComment =
        this.model.getLine(token.start.line)[token.start.column] === "/"
          ? true
          : false;

      this.addTknBlock_(block);
    }
  }
  private tryToAddCardsBlock_(token: Token) {
    if (token && token.type === Lexer.TOKEN_TYPES.CARDSDATA) {
      const block = new TknBlock(
        token.start.line,
        token.start.column,
        token.end.line,
        token.end.column,
        token.type,
        this.curr.name,
      );
      block.sectionIdx = this.sections.length; //TODO: Improve this

      this.addTknBlock_(block);
    }
  }
  /*this.tryToAddStmtBlock_ = function(token) {
        if (!token) {
            if (!isStmtStart) {
                this.endStmtBlock_();
            }
            return;
        }
        if (isStmtStart) {
            currStmt.startLine = token.start.line;
            currStmt.startCol = token.start.column;
            isStmtStart = false;
        }
        //TODO: Not always do this
        currStmt.endLine = token.end.line;
        currStmt.endCol = token.end.column;
        if (this.isTokenWithScopeMarks[token.type]) {
            if (!currStmt.specialBlks) {
                currStmt.specialBlks = [];
            }
            currStmt.specialBlks.push(token);
        }

        if (token.text ===";") {
            this.endStmtBlock_();
        }
    };
    this.endStmtBlock_ = function() {
        isStmtStart = true;
        stmts.push(new StmtBlock(currStmt));
        currStmt.endLine = -1;
    };*/

  /*
   * public method definitions
   */
  start(change: Change) {
    this.lookAheadTokens = [];
    return this.start_(change);
    //this.stack = [{parse:this.readProg_, state:this.PARSING_STATE.IN_GBL}];
    //this.curr = null;
  }
  end() {
    return this.lexer.end() && this.lookAheadTokens.length === 0;
  }
  reset() {
    this.resetFoldingBlockCache_();
    return this.lexer.reset();
  }
  getNext() {
    this.curr = this.stack[this.stack.length - 1];
    const token = this.curr.parse.apply(this);
    this.curr = this.stack[this.stack.length - 1];
    this.tryToAddCardsBlock_(token);
    if (!token || this.end()) {
      const line = this.model.getLineCount() - 1,
        col = line >= 0 ? this.model.getColumnCount(line) : 0;
      this.tryEndFoldingBlock_({ line: line, column: col });
    }
    this.lastToken = token;
    return token;
  }
  /*
   * private method definitions
   */
  private getNext_() {
    let ret = null;
    if (this.lookAheadTokens.length > 0) {
      ret = this.lookAheadTokens.shift();
    } else {
      const token = this.lexer.getNext();
      ret = token
        ? {
            type: token.type,
            text: token.text,
            start: Object.assign({}, token.start),
            end: Object.assign({}, token.end),
          }
        : token;
    }
    this.tryStop_(ret);
    return ret;
  }
  private cacheToken_(token?: Token) {
    let cache: Token | undefined;
    if (token) {
      cache = {
        type: token.type,
        text: token.text,
        start: Object.assign({}, token.start),
        end: Object.assign({}, token.end),
      };
      this.lookAheadTokens.push(cache);
    }
    return cache;
  }
  prefetch0_(pos: number) {
    // 1, 2, 3,...  not ignore comments
    let next = null;
    if (this.lookAheadTokens.length >= pos) {
      next = this.lookAheadTokens[pos - 1];
    } else {
      const len = pos - this.lookAheadTokens.length;
      for (let i = 0; i < len; i++) {
        next = this.cacheToken_(this.lexer.getNext());
      }
    }
    return next;
  }
  private prefetch_(it: { pos: any }) {
    // it: iterator, it.pos starts from 1, ignore comments
    let next = null;

    do {
      next = this.prefetch0_(it.pos);
      it.pos++;
    } while (next && Lexer.isComment[next.type]);

    return next;
  }
  private isNextTokenColon_() {
    const nextToken = this.prefetch0_(1);
    if (nextToken) {
      if (nextToken.text === ":") {
        return true;
      }
    }
    return false;
  }
  private getWord_(token: Token | undefined) {
    //always uppercase
    return this.lexer.getWord(token).toUpperCase();
  }
  private isLabel_(token?: Token) {
    //ATTENTION: The precondition must be that token is a word, for performance
    const next = this.prefetch_({ pos: 1 });
    return /*SasLexer.isWord[token.type] && */ next && next.text === ":";
  }
  private isAssignment_(token: Token) {
    if (
      token.text === "PROC" ||
      token.text === "PROCEDURE" ||
      token.text === "DATA" ||
      token.text === "RUN" ||
      token.text === "QUIT"
    ) {
      const next = this.prefetch_({ pos: 1 });
      return next && next.text === "=";
    }
    return false;
  }

  private isCustomBlockStart_(token: Token): boolean {
    if (token && isCustomRegionStartComment(token.text)) {
      return true;
    }
    return false;
  }

  private isCustomBlockEnd_(token: Token): boolean {
    if (token && isCustomRegionEndComment(token.text)) {
      return true;
    }
    return false;
  }

  private readProg_() {
    let word = "",
      gbl = true,
      isLabel,
      isAssignment;
    const token = this.getNext_();

    if (!token) return null;
    if (Lexer.isWord[token.type]) {
      isLabel = this.isLabel_(token);
      isAssignment = this.isAssignment_(token);
      if (!isLabel && !isAssignment) {
        word = token.text;
        switch (word) {
          case "PROC":
          case "PROCEDURE": {
            this.startFoldingBlock_(this.SEC_TYPE.PROC, token.start, word);
            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            const procName = this.handleProcName_();
            this.stack.push({
              parse: this.readProc_,
              state: this.PARSING_STATE.IN_PROC,
              name: procName,
            });
            this.stack.push({
              parse: this.readProcDef_,
              state: this.PARSING_STATE.IN_PROC,
              name: procName,
            });
            gbl = false;
            break;
          }
          case "%MACRO":
            this.startFoldingBlock_(this.SEC_TYPE.MACRO, token.start, word);
            token.type = Lexer.TOKEN_TYPES.MSKEYWORD;
            this.stack.push({
              parse: this.readMacro_,
              state: this.PARSING_STATE.IN_MACRO,
            });
            this.stack.push({
              parse: this.readMacroDef_,
              state: this.PARSING_STATE.IN_MACRO,
            });
            gbl = false;
            break;
          case "DATA":
            this.startFoldingBlock_(this.SEC_TYPE.DATA, token.start, word);
            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            this.stack.push({
              parse: this.readData_,
              state: this.PARSING_STATE.IN_DATA,
            });
            this.stack.push({
              parse: this.readDataDef_,
              state: this.PARSING_STATE.IN_DATA,
            });
            gbl = false;
            break;
        }
      }
    }

    if (gbl) {
      if (Lexer.isComment[token.type]) {
        if (this.isCustomBlockStart_(token)) {
          this.startFoldingBlock_(
            this.SEC_TYPE.CUSTOM,
            token.start,
            token.text,
          );
        } else if (this.isCustomBlockEnd_(token)) {
          this.tryEndFoldingBlock_(token.end, this.SEC_TYPE.CUSTOM);
        }
      } else if (!this.hasFoldingBlock_()) {
        this.startFoldingBlock_(this.SEC_TYPE.GBL, token.start, word);
      }
      this.stack.push({
        parse: this.readGbl_,
        state: this.PARSING_STATE.IN_GBL,
      });
      if (isLabel) {
        this.stack.push({
          parse: this.readLabel_,
          state: this.PARSING_STATE.IN_GBL,
        });
      } else if (token.type === Lexer.TOKEN_TYPES.MREF) {
        this.handleMref_(this.PARSING_STATE.IN_GBL);
      } else if (!Lexer.isComment[token.type] && token.text !== ";") {
        // not the start of a statement
        const validName = this._cleanKeyword(word);
        const state: any = {
          parse: this.readGblStmt_,
          state: this.PARSING_STATE.IN_GBL,
          name: validName,
        };
        this.stack.push(state);
        if (
          !isAssignment &&
          Lexer.isWord[token.type] &&
          !this.tryToHandleSectionEnd_(token)
        ) {
          //this.setKeyword_(token, this.langSrv.isStatementKeyword(this._cleanKeyword(word)));
          const obj = this.handleLongStmtName_("", validName);
          state.name = obj.stmtName;
          this.setKeyword_(token, obj.isKeyword);
          state.hasSlashOptionDelimiter = this.syntaxDb.hasOptionDelimiter(
            "",
            obj.stmtName,
          );
        }
      }
    }
    return token;
  }
  static readonly stmtWithDatasetOption_ = arrayToMap([
    //special
    "DATA/SET",
    "DATA/MERGE",
    "DATA/MODIFY",
    "DATA/UPDATE",
    //These are in IF statement, not SET statement. The syntax files are strange.
    //'CALIS/SET','COMPUTAB/SET','DSTRANS/SET','GENMOD/SET','GLIMMIX/SET','HPNLIN/SET','HPNLMOD/SET','IML/SET','MSMC/SET',
    //'MODEL/SET','NLIN/SET','NLMIXED/SET','OPTMODEL/SET','PHREG/SET','TCALIS/SET',
    "DOCUMENT/IMPORT",
    "JSON/EXPORT",
    "SERVER/ALLOCATE SASFILE",
    //'EXPORT','FSBROWSE','FSEDIT','FSLETTER','FSVIEW','HPSUMMARY','SUMMARY'// define option will be handled correctly as options, ignored here.
  ]);
  OptionCheckers_ = {
    "proc-def": {
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureOptionType(this.curr.name, optName);
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isProcedureSubOptKeyword(
          this.curr.name,
          optName,
          subOptName,
        );
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureOptionKeyword(this.curr.name, optName);
      },
    },
    "proc-stmt": {
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureStatementOptionType(
          this.curr.procName,
          this.curr.name,
          optName,
        );
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
        pos: any,
      ) {
        // pos is the relative position of subOptName to optName
        return (
          this.handleLongStmtSubOptionName_(
            this.curr.procName,
            this.curr.name,
            optName,
            subOptName,
            pos,
          ).isKeyword ||
          this.handleLongStmtOptionName_(
            this.curr.procName,
            this.curr.name,
            subOptName,
            pos,
          ).isKeyword ||
          (LexerEx.stmtWithDatasetOption_[
            this.curr.procName + "/" + this.curr.name
          ]
            ? this.syntaxDb.isDatasetKeyword(subOptName)
            : false)
        );
        //e.g. proc sql;    create view proclib.jobs(pw=red) as ....
      },
      checkOption: function (this: LexerEx, optName: string) {
        const obj = this.handleLongStmtOptionName_(
          this.curr.procName,
          this.curr.name,
          optName,
        );
        return obj.isKeyword;
        //return this.langSrv.isProcedureStatementKeyword(this.curr.procName, this.curr.name, optName);
      },
    },
    "data-def": {
      getOptionType: function (optName: string) {
        return "";
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isDatasetKeyword(subOptName);
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureOptionKeyword("DATA", optName);
      },
    },
    "data-stmt": {
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureStatementOptionType(
          "DATA",
          this.curr.name,
          optName,
        );
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        let isKeyword = this.syntaxDb.isProcedureStatementSubOptKeyword(
          "DATA",
          this.curr.name,
          optName,
          subOptName,
        );
        if (!isKeyword) {
          if (LexerEx.stmtWithDatasetOption_["DATA/" + this.curr.name]) {
            isKeyword = this.syntaxDb.isDatasetKeyword(subOptName);
          }
        }
        return isKeyword;
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureStatementKeyword(
          "DATA",
          this.curr.name,
          optName,
        );
      },
    },
    "macro-def": {
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureOptionType("MACRO", optName);
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isProcedureSubOptKeyword(
          "MACRO",
          optName,
          subOptName,
        );
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureOptionKeyword("MACRO", optName);
      },
    },
    "macro-stmt": {
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureStatementOptionType(
          "MACRO",
          this.curr.name,
          optName,
        );
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isProcedureStatementSubOptKeyword(
          "MACRO",
          this.curr.name,
          optName,
          subOptName,
        );
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureStatementKeyword(
          "MACRO",
          this.curr.name,
          optName,
        );
      },
    },
    "gbl-stmt": {
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getStatementOptionType(
          this._cleanKeyword(this.curr.name),
          optName,
        );
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isStatementSubOptKeyword(
          this._cleanKeyword(this.curr.name),
          optName,
          subOptName,
        );
      },
      checkOption: function (this: LexerEx, optName: string) {
        const isGlobal = this.syntaxDb.isStatementKeyword(
          "global",
          this._cleanKeyword(this.curr.name),
          optName,
        );
        if (!isGlobal) {
          return this.syntaxDb.isStatementKeyword(
            "standalone",
            this._cleanKeyword(this.curr.name),
            optName,
          );
        }
        return isGlobal;
      },
    },
    "sg-def": {
      // statgraph
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureStatementOptionType(
          "TEMPLATE",
          "BEGINGRAPH",
          optName,
        );
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isProcedureStatementSubOptKeyword(
          "TEMPLATE",
          "BEGINGRAPH",
          optName,
          subOptName,
        );
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureStatementKeyword(
          "TEMPLATE",
          "BEGINGRAPH",
          optName,
        );
      },
    },
    "sg-stmt": {
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureStatementOptionType(
          "STATGRAPH",
          this.curr.name,
          optName,
        );
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isProcedureStatementSubOptKeyword(
          "STATGRAPH",
          this.curr.name,
          optName,
          subOptName,
        );
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureStatementKeyword(
          "STATGRAPH",
          this.curr.name,
          optName,
        );
      },
    },
    "dt-def": {
      // dt = define tagset
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureStatementOptionType(
          "TEMPLATE",
          "DEFINE TAGSET",
          optName,
        );
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isProcedureStatementSubOptKeyword(
          "TEMPLATE",
          this.curr.name,
          optName,
          subOptName,
        );
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureStatementKeyword(
          "TEMPLATE",
          "DEFINE TAGSET",
          optName,
        );
      },
    },
    "dt-stmt": {
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureStatementOptionType(
          "DEFINE_TAGSET",
          this.curr.name,
          optName,
        );
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isProcedureStatementSubOptKeyword(
          "DEFINE_TAGSET",
          this.curr.name,
          optName,
          subOptName,
        );
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureStatementKeyword(
          "DEFINE_TAGSET",
          this.curr.name,
          optName,
        );
      },
    },
    "de-def": {
      // de = define event
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureStatementOptionType(
          "TEMPLATE",
          "DEFINE EVENT",
          optName,
        );
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isProcedureStatementSubOptKeyword(
          "TEMPLATE",
          "DEFINE EVENT",
          optName,
          subOptName,
        );
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureStatementKeyword(
          "TEMPLATE",
          "DEFINE EVENT",
          optName,
        );
      },
    },
    "de-stmt": {
      getOptionType: function (this: LexerEx, optName: string) {
        return this.syntaxDb.getProcedureStatementOptionType(
          "DEFINE_EVENT",
          this.curr.name,
          optName,
        );
      },
      checkSubOption: function (
        this: LexerEx,
        optName: string,
        subOptName: string,
      ) {
        return this.syntaxDb.isProcedureStatementSubOptKeyword(
          "DEFINE_EVENT",
          this.curr.name,
          optName,
          subOptName,
        );
      },
      checkOption: function (this: LexerEx, optName: string) {
        return this.syntaxDb.isProcedureStatementKeyword(
          "DEFINE_EVENT",
          this.curr.name,
          optName,
        );
      },
    },
  };
  private handleProcName_() {
    const token = this.prefetch_({ pos: 1 });
    let name = "";
    if (token) {
      name = token.text;
      token.type = Lexer.TOKEN_TYPES.PROCNAME; // procedure name
      token.notCheckKeyword = true;
    }
    return name;
  }
  private readProcDef_() {
    return this.handleStatement_(this.OptionCheckers_["proc-def"]);
  }
  private readDataDef_() {
    return this.handleStatement_(this.OptionCheckers_["data-def"]);
  }
  private readMacroDef_() {
    return this.handleStatement_(this.OptionCheckers_["macro-def"]);
  }
  private handleODSStmt_(token: Token) {
    let isKeyword = false;
    const currName = token.text,
      procName = "ODS",
      stmtName = procName;

    if (this.curr.fullName === undefined) {
      const obj = this.handleLongStmtName_(procName, stmtName + " " + currName); //e.g. ODS CHTML
      if (obj.stmtNameLen === 1 && !obj.isKeyword) {
        // try it in general statments
        this.curr.fullName = stmtName;
        isKeyword = this.syntaxDb._isStatementKeyword(stmtName, currName);
      } else {
        this.curr.fullName = obj.stmtName;
        isKeyword = obj.isKeyword;
      }
    } else {
      if (this.curr.fullName === this.curr.name) {
        // "ODS"
        isKeyword = this.syntaxDb._isStatementKeyword(stmtName, currName);
      } else {
        isKeyword = this.syntaxDb.isProcedureStatementKeyword(
          procName,
          this.curr.fullName,
          currName,
        );
      }
    }
    this.setKeyword_(token, isKeyword);

    return isKeyword;
  }
  private handleLongStmtName_(
    procName: string,
    startWord: string,
  ): {
    isKeyword: boolean;
    stmtName: string;
    stmtNameLen: number;
  } {
    const name1 = startWord,
      it = { pos: 1 },
      next1 = this.prefetch_(it);
    let isKeyword = false,
      name2 = null,
      name3 = null,
      name4 = null,
      next2,
      next3,
      stmtNameLen = 1,
      fullStmtName = name1;

    if (next1 && Lexer.isWord[next1.type]) {
      name2 = name1 + " " + next1.text; // the keyword has 2 words
      next2 = this.prefetch_(it);
      if (next2 && Lexer.isWord[next2.type]) {
        name3 = name2 + " " + next2.text; // the keyword has 3 words
        next3 = this.prefetch_(it);
        if (next3 && Lexer.isWord[next3.type]) {
          name4 = name3 + " " + next3.text;
        }
      }
    }

    if (name4) {
      isKeyword = this.syntaxDb.isProcedureStatementKeyword(procName, name4);
      if (isKeyword) {
        stmtNameLen = 4;
        fullStmtName = name4;
        this.setKeyword_(next1, true);
        this.setKeyword_(next2, true);
        this.setKeyword_(next3, true);
      }
    }
    if (!isKeyword && name3) {
      isKeyword = this.syntaxDb.isProcedureStatementKeyword(procName, name3);
      if (isKeyword) {
        stmtNameLen = 3;
        fullStmtName = name3;
        this.setKeyword_(next1, true);
        this.setKeyword_(next2, true);
      }
    }
    if (!isKeyword && name2) {
      isKeyword = this.syntaxDb.isProcedureStatementKeyword(procName, name2);
      if (isKeyword) {
        stmtNameLen = 2;
        fullStmtName = name2;
        this.setKeyword_(next1, true);
      }
    }
    if (!isKeyword) {
      isKeyword = this.syntaxDb.isProcedureStatementKeyword(procName, name1);
    }
    return {
      isKeyword: isKeyword,
      stmtName: fullStmtName,
      stmtNameLen: stmtNameLen,
    };
  }
  private handleLongStmtOptionName_(
    procName: string,
    stmtName: string,
    startWord: string,
    pos?: any,
  ) {
    const context = {
      procName: procName,
      stmtName: stmtName,
      startWord: startWord,
      pos: pos,
      checkKeyword: function (
        this: LexerEx,
        context: { procName: any; stmtName: any },
        name: any,
      ) {
        return this.syntaxDb.isProcedureStatementKeyword(
          context.procName,
          context.stmtName,
          name,
        );
      },
    };
    return this.handleLongOptionName_(context);
  }
  private handleLongStmtSubOptionName_(
    procName: string,
    stmtName: string,
    optName: string,
    startWord: any,
    pos: any,
  ) {
    const context = {
      procName: procName,
      stmtName: stmtName,
      optName: optName,
      startWord: startWord,
      pos: pos,
      checkKeyword: function (
        this: LexerEx,
        context: { procName: any; stmtName: any; optName: any },
        name: any,
      ) {
        return this.syntaxDb.isProcedureStatementSubOptKeyword(
          context.procName,
          context.stmtName,
          context.optName,
          name,
        );
      },
    };
    return this.handleLongOptionName_(context);
  }
  // The pos is the offest of startWord from the current token in the state machine
  private handleLongOptionName_(context: {
    procName?: string;
    stmtName?: string;
    startWord: any;
    pos: any;
    checkKeyword: any;
    optName?: string;
  }) {
    //procName, stmtName, startWord, cb, pos
    let isKeyword = false,
      name1 = context.startWord,
      name2 = null, // longest option names generally include two word, and only occur in Statement Options
      next,
      nameLen = 1,
      fullName = name1,
      it = { pos: 1 }; //option names with 3 words are special situation, they can be covered, so we may ignore them.

    if (context.pos) {
      it.pos = context.pos + 1;
    }
    next = this.prefetch_(it);
    if (next && Lexer.isWord[next.type]) {
      name2 = name1 + " " + next.text; // The keyword has 2 words
    }

    if (name2) {
      isKeyword = context.checkKeyword.call(this, context, name2);
      if (isKeyword) {
        nameLen = 2;
        this.setKeyword_(next, true);
        fullName = name2;
      }
    }
    if (!isKeyword) {
      isKeyword = context.checkKeyword.call(this, context, name1);
    }
    return {
      isKeyword: isKeyword,
      name: fullName,
      nameLen: nameLen,
    };
  }
  sectionEndStmts_: Record<string, 1> = {
    RUN: 1,
    "RUN CANCEL": 1,
    QUIT: 1,
  };
  private tryToHandleSectionEnd_(token: Token) {
    let ret = false;
    if (this.sectionEndStmts_[token.text]) {
      token.type = "sec-keyword"; // Lexer.TOKEN_TYPES.SKEYWORD;
      const next = this.prefetch_({ pos: 1 });
      if (next && next.text === "CANCEL") {
        next.type = Lexer.TOKEN_TYPES.SKEYWORD;
      }
      ret = true;
    }
    return ret;
  }
  private tryToHandleExpr_(
    token: {
      type: any;
      text: any;
      start?: TextPosition;
      end?: TextPosition;
      notCheckKeyword?: any;
    },
    optChecker: { getOptionType: any; checkSubOption: any; checkOption?: any },
  ) {
    if (this.curr.exprTokenCount) {
      // 1, 2, ...
      token.notCheckKeyword = true;
      //this.curr.exprTokenCount--;

      this.curr.exprTokenIndex++;
      if (this.curr.exprTokenIndex > this.curr.exprTokenCount) {
        this.curr.exprTokenCount = 0;
        token.notCheckKeyword = false;
      }
    }
    if (!this.curr.exprTokenCount) {
      let needToHandleExpr = false,
        startPos = 0;
      if (Lexer.isWord[token.type]) {
        const next = this.prefetch_({ pos: 1 }),
          exprBeg: Record<string, 1> = { "=": 1, "(": 1 };
        if (next && exprBeg[next.text]) {
          if (next.text === "=") {
            startPos = 1;
          }
          needToHandleExpr = true;
        }
        if (next && next.text === "(") {
          if (this.syntaxDb.isSasFunction(token.text)) {
            this.setKeyword_(token, true);
          }
        }
      } else if (token.text === "=") {
        needToHandleExpr = true;
      }
      if (needToHandleExpr) {
        const self = this;
        const ret = this.expr.parse(
          this.curr.hasSlashOptionDelimiter,
          startPos,
          function (subOptToken: { text: string }, pos: any) {
            const type = optChecker.getOptionType.call(self, token.text) || "";
            let isKeyword;
            if (self.syntaxDb.isDataSetType(type)) {
              isKeyword = self.syntaxDb.isDatasetKeyword(subOptToken.text);
            } else {
              isKeyword = optChecker.checkSubOption.call(
                self,
                token.text,
                subOptToken.text,
                pos,
              );
            }
            self.setKeyword_(subOptToken, isKeyword);
          },
        );
        this.curr.exprTokenCount = ret.pos;
        this.curr.exprTokenIndex = 0;
      }
    }
  }
  private readGblStmt_() {
    return this.handleStatement_(this.OptionCheckers_["gbl-stmt"]);
  }
  specialStmts_: Record<string, 1> = {
    "DATASETS/IC CREATE": 1,
    "TRANSREG/MODEL": 1, //HTMLCOMMONS-3829
  };
  private readProcStmt_() {
    const token = this.handleStatement_(this.OptionCheckers_["proc-stmt"]);
    if (
      token &&
      Lexer.isWord[token.type] &&
      this.specialStmts_[this.curr.procName + "/" + this.curr.name]
    ) {
      //A simple way to handle this condition :)
      let isKeyword = false;
      //TODO: Imrove this
      if (this.curr.optNameLen !== undefined && this.curr.optNameLen > 1) {
        isKeyword = true;
        this.curr.optNameLen--;
      } else {
        const obj = this.handleLongStmtOptionName_(
          this.curr.procName,
          this.curr.name,
          token.text,
        );
        this.curr.optNameLen = obj.nameLen;
        isKeyword = obj.isKeyword;
      }

      this.setKeyword_(token, isKeyword);
    }
    return token;
  }
  private readDataStmt_() {
    return this.handleStatement_(this.OptionCheckers_["data-stmt"]);
  }
  private readMacroStmt_() {
    return this.handleStatement_(this.OptionCheckers_["macro-stmt"]);
  }
  private popSMTo_(level: number) {
    // SM = state machine, level = 1, 2, 3...
    let deep = this.stack.length - level;
    while (deep > 0) {
      this.stack.pop();
      deep--;
    }
  }
  private handleBlock_(fn: { (token: any): void }) {
    let word = "";
    const token = this.getNext_();
    if (!token) return null;

    if (Lexer.isWord[token.type]) {
      if (this.isLabel_()) {
        this.stack.push({
          parse: this.readLabel_,
          state: this.PARSING_STATE.IN_PROC,
        });
      } else if (this.isAssignment_(token)) {
        fn.call(this, token);
      } else {
        word = token.text;
        switch (word) {
          case "RUN":
          case "QUIT":
            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            this.popSMTo_(2);
            this.stack.push({
              parse: this.readEnd_,
              state: this.PARSING_STATE.IN_PROC,
              start: token,
              name: word,
            });
            break;
          case "PROC":
          case "PROCEDURE": {
            if (this.currSection?.type === this.SEC_TYPE.CUSTOM) {
              this.tryPromoteCustomBlock_();
            } else {
              this.endFoldingBlock_(this.SEC_TYPE.PROC, this.lastToken.end);
            }
            this.startFoldingBlock_(this.SEC_TYPE.PROC, token.start, word);
            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            this.popSMTo_(1);
            const procName = this.handleProcName_();
            this.stack.push({
              parse: this.readProc_,
              state: this.PARSING_STATE.IN_PROC,
              name: procName,
            });
            this.stack.push({
              parse: this.readProcDef_,
              state: this.PARSING_STATE.IN_PROC,
              name: procName,
            });
            break;
          }
          case "DATA":
            if (this.currSection?.type === this.SEC_TYPE.CUSTOM) {
              this.tryPromoteCustomBlock_();
            } else {
              this.endFoldingBlock_(this.SEC_TYPE.PROC, this.lastToken.end);
            }
            this.startFoldingBlock_(this.SEC_TYPE.DATA, token.start, word);
            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            this.popSMTo_(1);
            this.stack.push({
              parse: this.readData_,
              state: this.PARSING_STATE.IN_DATA,
            });
            this.stack.push({
              parse: this.readDataDef_,
              state: this.PARSING_STATE.IN_DATA,
            });
            break;
          case "%MACRO":
            if (this.currSection?.type === this.SEC_TYPE.CUSTOM) {
              this.tryPromoteCustomBlock_();
            } else {
              this.endFoldingBlock_(this.SEC_TYPE.PROC, this.lastToken.end);
            }
            this.startFoldingBlock_(this.SEC_TYPE.MACRO, token.start, word);
            token.type = Lexer.TOKEN_TYPES.MSKEYWORD;
            this.popSMTo_(1);
            this.stack.push({
              parse: this.readMacro_,
              state: this.PARSING_STATE.IN_MACRO,
            });
            this.stack.push({
              parse: this.readMacroDef_,
              state: this.PARSING_STATE.IN_MACRO,
            });
            break;
          default:
            fn.call(this, token);
        }
      }
    }
    return token;
  }
  /*
      OptionInforVisitor {
          getOptionType: function(optName){},
          checkSubOption: function(optName, subOptName){}
      }
    */
  private handleStatement_(optChecker: {
    getOptionType: (optName: any) => any;
    checkSubOption:
      | ((optName: any, subOptName: any) => any)
      | ((optName: any, subOptName: any, pos: any) => any);
    checkOption: any;
  }) {
    const token = this.getNext_();
    if (token) {
      this.tryToHandleExpr_(token, optChecker);

      if (token.text === ";") {
        //statement ends
        this.stack.pop();
      } else if (Lexer.isWord[token.type] && !token.notCheckKeyword) {
        if (this.curr.name === "ODS") {
          this.handleODSStmt_(token);
        } else {
          if (optChecker.checkOption) {
            this.setKeyword_(
              token,
              optChecker.checkOption.call(this, token.text),
            );
          }
        }
      }
    }
    return token;
  }
  private handleEnd_() {
    const token = this.getNext_();
    if (token && token.text === ";") {
      this.stack.pop();
      this.stack.pop();
    }
    return token;
  }
  private handleMref_(state: number) {
    const next = this.prefetch_({ pos: 1 });
    if (next && next.text === "(") {
      this.stack.push({ parse: this.readMRef_, state: state });
    }
  }
  private readLabel_() {
    const token = this.getNext_();
    if (token && token.text === ":") {
      this.stack.pop();
    }
    return token;
  }
  private readMRef_() {
    const token = this.getNext_();
    if (token && token.text === ")") {
      this.stack.pop();
    } else {
      const next = this.prefetch_({ pos: 1 });
      if (next && next.text === "(") {
        this.stack.push(this.curr);
      }
    }
    return token;
  }
  private readComment_() {
    //ignore
  }
  private readStatGraph_() {
    return this.handleBlock_(function (this: LexerEx, token: { text: string }) {
      if (token.text === "ENDGRAPH") {
        this.setKeyword_(token, true);
        this.stack.push({
          parse: this.readStatGraphEnd_,
          state: this.PARSING_STATE.IN_PROC,
          start: token,
          name: token.text,
        });
      } else {
        const state = {
          parse: this.readStatGraphStmt_,
          state: this.PARSING_STATE.IN_PROC,
          name: token.text,
        };
        this.stack.push(state);
        let next = null,
          isKeyword = this.syntaxDb.isProcedureStatementKeyword(
            "STATGRAPH",
            this._cleanKeyword(token.text),
          );
        if (!isKeyword) {
          next = this.prefetch_({ pos: 1 });
          if (next) {
            const word = token.text + " " + next.text;
            isKeyword = this.syntaxDb.isProcedureStatementKeyword(
              "STATGRAPH",
              word,
            );
            if (isKeyword) {
              state.name = word;
              this.setKeyword_(next, true);
            }
          }
        }
        this.setKeyword_(token, isKeyword);
      }
    });
  }
  private readStatGraphDef_() {
    return this.handleStatement_(this.OptionCheckers_["sg-def"]);
  }
  private readStatGraphStmt_() {
    return this.handleStatement_(this.OptionCheckers_["sg-stmt"]);
  }
  private readStatGraphEnd_() {
    return this.handleEnd_();
  }
  private readDefineTagset_() {
    return this.handleBlock_(function (this: LexerEx, token: { text: string }) {
      let word = token.text;
      if (token.text === "END") {
        this.setKeyword_(token, true);
        this.stack.push({
          parse: this.readDefineTagsetEnd_,
          state: this.PARSING_STATE.IN_PROC,
          start: token,
          name: word,
        });
      } else {
        let generalTagsetStmt = true;
        const next = this.prefetch_({ pos: 1 });

        if (next) {
          const fullName = word + " " + next.text;
          if (fullName === "DEFINE EVENT") {
            this.stack.push({
              parse: this.readDefineEvent_,
              state: this.PARSING_STATE.IN_PROC,
              name: fullName,
            });
            this.stack.push({
              parse: this.readDefineEventDef_,
              state: this.PARSING_STATE.IN_PROC,
              name: fullName,
            });
            generalTagsetStmt = false;
            this.setKeyword_(next, true);
            this.setKeyword_(token, true);
          }
        }

        if (generalTagsetStmt) {
          const state = {
            parse: this.readDefineTagsetStmt_,
            state: this.PARSING_STATE.IN_PROC,
            name: word,
          };
          this.stack.push(state);
          // keyword checking
          let isKeyword = this.syntaxDb.isProcedureStatementKeyword(
            "DEFINE_TAGSET",
            this._cleanKeyword(word),
          );
          if (!isKeyword) {
            if (next) {
              word += " " + next.text;
              isKeyword = this.syntaxDb.isProcedureStatementKeyword(
                "DEFINE_TAGSET",
                word,
              );
              if (isKeyword) {
                state.name = word;
                this.setKeyword_(next, true);
              }
            }
          }
          this.setKeyword_(token, isKeyword);
        }
      }
    });
  }
  private readDefineTagsetDef_() {
    return this.handleStatement_(this.OptionCheckers_["dt-def"]);
  }
  private readDefineTagsetStmt_() {
    return this.handleStatement_(this.OptionCheckers_["dt-stmt"]);
  }
  private readDefineTagsetEnd_() {
    return this.handleEnd_();
  }
  private readDefineEvent_() {
    return this.handleBlock_(function (this: LexerEx, token: { text: any }) {
      let word = token.text;
      if (word === "END") {
        this.setKeyword_(token, true);
        this.stack.push({
          parse: this.readDefineEventEnd_,
          state: this.PARSING_STATE.IN_PROC,
          start: token,
          name: word,
        });
      } else {
        const state = {
          parse: this.readDefineEventStmt_,
          state: this.PARSING_STATE.IN_PROC,
          name: word,
        };
        this.stack.push(state);
        let next = null,
          isKeyword = this.syntaxDb.isProcedureStatementKeyword(
            "DEFINE_EVENT",
            this._cleanKeyword(word),
          );
        if (!isKeyword) {
          next = this.prefetch_({ pos: 1 });
          if (next) {
            word += " " + next.text;
            isKeyword = this.syntaxDb.isProcedureStatementKeyword(
              "DEFINE_EVENT",
              word,
            );
            if (isKeyword) {
              this.setKeyword_(next, true);
              state.name = word;
            }
          }
        }
        this.setKeyword_(token, isKeyword);
      }
    });
  }
  private readDefineEventDef_() {
    return this.handleStatement_(this.OptionCheckers_["de-def"]);
  }
  private readDefineEventStmt_() {
    return this.handleStatement_(this.OptionCheckers_["de-stmt"]);
  }
  private readDefineEventEnd_() {
    return this.handleEnd_();
  }
  private readSubmitOrInteractiveBlock_() {
    const token = this.getNext_();
    const next = this.prefetch_({ pos: 1 }); // <embedded code>
    const next2 = this.prefetch_({ pos: 2 }); // endsubmit(endinteractive)
    const next3 = this.prefetch_({ pos: 3 }); // ;
    if (!token) {
      return undefined;
    }
    if (
      next &&
      next2 &&
      next3 &&
      token.end.line <= next.start.line &&
      next.type === "embedded-code" &&
      ["ENDSUBMIT", "ENDINTERACTIVE"].includes(next2.text) &&
      next3.type === "sep" &&
      next3.text === ";"
    ) {
      this.stack.push({
        parse: this.handleEnd_,
        state: this.PARSING_STATE.IN_PROC,
      });
      this.setKeyword_(next2, true);
    } else if (next && ["DATA", "PROC", "%MACRO"].includes(next.text)) {
      this.stack.pop();
    }
    return token;
  }
  /*            readProc_
         *  DATA, %MACRO ----> pop + push
         PROC ----> ignore
         *
         */
  DS2_: Record<string, 1> = {
    DS2: 1,
    HPDS2: 1,
  };

  private readProc_() {
    let word = "";
    const token = this.getNext_(),
      procName = this.curr.name || "";

    if (!token) return;

    if (Lexer.isWord[token.type]) {
      if (this.isLabel_()) {
        this.stack.push({
          parse: this.readLabel_,
          state: this.PARSING_STATE.IN_PROC,
        });
      } else if (this.isAssignment_(token)) {
        const validName = this._cleanKeyword(word);
        this.stack.push({
          parse: this.readProcStmt_,
          state: this.PARSING_STATE.IN_PROC,
          name: validName,
          procName: procName,
        });
      } else {
        word = token.text;
        switch (word) {
          case this.syntaxDb.isInteractiveProc(procName) ? "QUIT" : "RUN":
          case "QUIT":
            //normal section end
            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            this.stack.push({
              parse: this.readEnd_,
              state: this.PARSING_STATE.IN_PROC,
              start: token,
              name: word,
            });
            break;
          case "%MEND":
            //error:
            token.type = Lexer.TOKEN_TYPES.MSKEYWORD;
            if (
              this.stack.length > 2 &&
              this.stack[this.stack.length - 2].state ===
                this.PARSING_STATE.IN_MACRO
            ) {
              this.stack.pop();
              this.stack.push({
                parse: this.readMend_,
                state: this.PARSING_STATE.IN_MACRO,
                start: token,
                name: word,
              });
            }
            //this.stack.push({parse:this.readMend_, state:this.PARSING_STATE.IN_MACRO});
            break;
          case "PROC":
          case "PROCEDURE": {
            //no normal end, and another proc meet, there are syntax errors
            // ignore
            if (this.currSection?.type === this.SEC_TYPE.CUSTOM) {
              this.tryPromoteCustomBlock_();
            } else {
              this.endFoldingBlock_(this.SEC_TYPE.PROC, this.lastToken.end);
            }
            this.startFoldingBlock_(this.SEC_TYPE.PROC, token.start, word);

            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            this.stack.pop();
            const procName = this.handleProcName_();
            this.stack.push({
              parse: this.readProc_,
              state: this.PARSING_STATE.IN_PROC,
              name: procName,
            });
            this.stack.push({
              parse: this.readProcDef_,
              state: this.PARSING_STATE.IN_PROC,
              name: procName,
            });
            break;
          }
          case "%MACRO":
            if (this.currSection?.type === this.SEC_TYPE.CUSTOM) {
              this.tryPromoteCustomBlock_();
            } else {
              this.endFoldingBlock_(this.SEC_TYPE.PROC, this.lastToken.end);
            }
            this.startFoldingBlock_(this.SEC_TYPE.MACRO, token.start, word);

            token.type = Lexer.TOKEN_TYPES.MSKEYWORD;
            this.stack.pop();
            this.stack.push({
              parse: this.readMacro_,
              state: this.PARSING_STATE.IN_MACRO,
            });
            this.stack.push({
              parse: this.readMacroDef_,
              state: this.PARSING_STATE.IN_MACRO,
            });
            break;
          case "DATA":
            if (!this.DS2_[procName]) {
              if (this.currSection?.type === this.SEC_TYPE.CUSTOM) {
                this.tryPromoteCustomBlock_();
              } else {
                this.endFoldingBlock_(this.SEC_TYPE.PROC, this.lastToken.end);
              }
              this.startFoldingBlock_(this.SEC_TYPE.DATA, token.start, word);

              token.type = Lexer.TOKEN_TYPES.SKEYWORD;
              this.stack.pop();
              this.stack.push({
                parse: this.readData_,
                state: this.PARSING_STATE.IN_DATA,
              });
              this.stack.push({
                parse: this.readDataDef_,
                state: this.PARSING_STATE.IN_DATA,
              });
              break;
            } // not break
          default: {
            this.tryToHandleSectionEnd_(token);
            let generalProcStmt = true;
            if (procName === "TEMPLATE") {
              if (word === "BEGINGRAPH") {
                this.stack.push({
                  parse: this.readStatGraph_,
                  state: this.PARSING_STATE.IN_PROC,
                });
                this.stack.push({
                  parse: this.readStatGraphDef_,
                  state: this.PARSING_STATE.IN_PROC,
                });
                this.setKeyword_(token, true);
                generalProcStmt = false;
              } else {
                const next = this.prefetch_({ pos: 1 });
                if (next && next.text === "TAGSET" && word === "DEFINE") {
                  this.stack.push({
                    parse: this.readDefineTagset_,
                    state: this.PARSING_STATE.IN_PROC,
                  });
                  this.stack.push({
                    parse: this.readDefineTagsetDef_,
                    state: this.PARSING_STATE.IN_PROC,
                  });
                  this.setKeyword_(next, true);
                  this.setKeyword_(token, true);
                  generalProcStmt = false;
                }
              }
            } else if (procName === "EXPLODE") {
              // TODO: we must modify block merging algorithm to support this.
              if (Lexer.isParmcards[word]) {
                this.cardsState = this.CARDS_STATE.IN_CMD;
                this.stack.push({
                  parse: this.readCards_,
                  state: this.PARSING_STATE.IN_DATA,
                  name: word,
                  token: token,
                });
                this.setKeyword_(token, true);
                generalProcStmt = false;
              }
            } else if (procName === "LUA" || procName === "PYTHON") {
              if (["SUBMIT", "INTERACTIVE", "I"].includes(word)) {
                const next = this.prefetch_({ pos: 1 });
                if (next && next.text === ";" && next.type === "sep") {
                  this.stack.push({
                    parse: this.readSubmitOrInteractiveBlock_,
                    state: this.PARSING_STATE.IN_PROC,
                  });
                  this.setKeyword_(token, true);
                  generalProcStmt = false;
                }
              }
            } else if (token.type === Lexer.TOKEN_TYPES.MREF) {
              this.handleMref_(this.PARSING_STATE.IN_PROC);
              generalProcStmt = false;
            }
            if (generalProcStmt) {
              const validName = this._cleanKeyword(word);
              const state: any = {
                parse: this.readProcStmt_,
                state: this.PARSING_STATE.IN_PROC,
                name: validName,
                procName: procName,
              };
              this.stack.push(state);
              const obj = this.handleLongStmtName_(procName, validName);
              state.name = obj.stmtName;
              this.setKeyword_(token, obj.isKeyword);
              state.hasSlashOptionDelimiter = this.syntaxDb.hasOptionDelimiter(
                procName,
                obj.stmtName,
              );
            }
          }
        }
      }
    } else if (Lexer.isComment[token.type]) {
      if (this.isCustomBlockStart_(token)) {
        this.startFoldingBlock_(this.SEC_TYPE.CUSTOM, token.start, token.text);
      } else if (this.isCustomBlockEnd_(token)) {
        // only when there's an outer custom block, treat *endregion; as an end of custom region
        if (
          this.searchBlockUpwardOfType_(this.currSection, this.SEC_TYPE.CUSTOM)
        ) {
          this.tryEndFoldingBlock_(
            token.start,
            this.SEC_TYPE.CUSTOM,
            token.end,
          );
        }
      }
    }
    return token;
  }
  private hasRunCancelFollowed_() {
    let next1,
      next2,
      ret = false;
    const it = { pos: 1 };
    do {
      next1 = this.prefetch_(it);
    } while (next1 && next1.text !== ";");
    if (next1) {
      next1 = this.prefetch_(it);
      next2 = this.prefetch_(it);

      if (next1 && next2) {
        if (Lexer.isWord[next1.type] && next2.text === ":") {
          // label
          next1 = this.prefetch_(it);
          next2 = this.prefetch_(it);
        }
        if (next1 && next2 && next1.text === "RUN" && next2.text === "CANCEL") {
          ret = true;
        }
      }
    }
    return ret;
  }
  /*
   *              readData_
   *  %MACRO, PROC  ----> pop + push
   *           DATA ----> ignore
   */
  private readData_() {
    let word = "";
    const token = this.getNext_();

    if (!token) return;

    if (Lexer.isWord[token.type]) {
      if (this.isLabel_()) {
        this.stack.push({
          parse: this.readLabel_,
          state: this.PARSING_STATE.IN_DATA,
        });
      } else if (this.isAssignment_(token)) {
        const validName = this._cleanKeyword(word);
        this.stack.push({
          parse: this.readDataStmt_,
          state: this.PARSING_STATE.IN_DATA,
          name: validName,
        });
      } else {
        word = token.text;
        switch (word) {
          case "%MEND":
            //error
            token.type = Lexer.TOKEN_TYPES.MSKEYWORD;
            if (
              this.stack.length > 2 &&
              this.stack[this.stack.length - 2].state ===
                this.PARSING_STATE.IN_MACRO
            ) {
              this.stack.pop();
              this.stack.push({
                parse: this.readMend_,
                state: this.PARSING_STATE.IN_MACRO,
                start: token,
                name: word,
              });
            }
            //this.stack.push({parse:this.readMend_, state:this.PARSING_STATE.IN_DATA});
            break;
          case "DATA":
            //no normal end, and another data meet, there are syntax errors
            // ignore
            if (this.currSection?.type === this.SEC_TYPE.CUSTOM) {
              this.tryPromoteCustomBlock_();
            } else {
              this.endFoldingBlock_(this.SEC_TYPE.DATA, this.lastToken.end);
            }
            this.startFoldingBlock_(this.SEC_TYPE.DATA, token.start, word);

            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            this.stack.push({
              parse: this.readDataDef_,
              state: this.PARSING_STATE.IN_DATA,
            });
            break;
          case "PROC":
          case "PROCEDURE": {
            if (this.currSection?.type === this.SEC_TYPE.CUSTOM) {
              this.tryPromoteCustomBlock_();
            } else {
              this.endFoldingBlock_(this.SEC_TYPE.DATA, this.lastToken.end);
            }
            this.startFoldingBlock_(this.SEC_TYPE.PROC, token.start, word);

            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            this.stack.pop(); //end data section
            const procName = this.handleProcName_();
            this.stack.push({
              parse: this.readProc_,
              state: this.PARSING_STATE.IN_PROC,
              name: procName,
            });
            this.stack.push({
              parse: this.readProcDef_,
              state: this.PARSING_STATE.IN_PROC,
              name: procName,
            });
            break;
          }
          case "%MACRO":
            if (this.currSection?.type === this.SEC_TYPE.CUSTOM) {
              this.tryPromoteCustomBlock_();
            } else {
              this.endFoldingBlock_(this.SEC_TYPE.DATA, this.lastToken.end);
            }
            this.startFoldingBlock_(this.SEC_TYPE.MACRO, token.start, word);

            token.type = Lexer.TOKEN_TYPES.MSKEYWORD;
            this.stack.pop(); //end data section
            this.stack.push({
              parse: this.readMacro_,
              state: this.PARSING_STATE.IN_MACRO,
            });
            this.stack.push({
              parse: this.readMacroDef_,
              state: this.PARSING_STATE.IN_MACRO,
            });
            break;
          case "RUN":
          case "QUIT":
            //normal section end
            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            if (!this.hasRunCancelFollowed_()) {
              this.tryToHandleSectionEnd_(token);
              this.stack.push({
                parse: this.readEnd_,
                state: this.PARSING_STATE.IN_DATA,
                start: token,
                name: word,
              });
              break;
            } // attention: not break here
          default:
            if (Lexer.isCards[word]) {
              this.cardsState = this.CARDS_STATE.IN_CMD;
              this.stack.push({
                parse: this.readCards_,
                state: this.PARSING_STATE.IN_DATA,
                name: word,
                token: token,
              });
              this.setKeyword_(
                token,
                this.syntaxDb.isProcedureStatementKeyword("DATA", word),
              );
            } else if (token.type === Lexer.TOKEN_TYPES.MREF) {
              this.handleMref_(this.PARSING_STATE.IN_DATA);
            } else {
              //handle the statements in data section
              const validName = this._cleanKeyword(word);
              const state: any = {
                parse: this.readDataStmt_,
                state: this.PARSING_STATE.IN_DATA,
                name: validName,
              };
              this.stack.push(state);
              if (!this.tryToHandleSectionEnd_(token)) {
                //this.setKeyword_(token, this.langSrv.isProcedureStatementKeyword("DATA", validName));
                const obj = this.handleLongStmtName_("DATA", validName);
                state.name = obj.stmtName;
                this.setKeyword_(token, obj.isKeyword);
                state.hasSlashOptionDelimiter =
                  this.syntaxDb.hasOptionDelimiter("DATA", obj.stmtName);
              }
            }
        }
      }
    } else if (Lexer.isComment[token.type]) {
      if (this.isCustomBlockStart_(token)) {
        this.startFoldingBlock_(this.SEC_TYPE.CUSTOM, token.start, token.text);
      } else if (this.isCustomBlockEnd_(token)) {
        // only when there's an outer custom block, treat *endregion; as an end of custom region
        if (
          this.searchBlockUpwardOfType_(this.currSection, this.SEC_TYPE.CUSTOM)
        ) {
          this.tryEndFoldingBlock_(
            token.start,
            this.SEC_TYPE.CUSTOM,
            token.end,
          );
        }
      }
    }
    return token;
  }

  private searchBlockUpwardOfType_(
    startBlock: FoldingBlock | undefined,
    type: number,
  ): FoldingBlock | null {
    let cur: FoldingBlock | undefined = startBlock;
    while (cur) {
      if (cur.type === type) {
        return cur;
      } else {
        cur = cur.outerBlock;
      }
    }
    return null;
  }

  private searchLastConsecutiveBlockUpwardOfType_(
    startBlock: FoldingBlock | undefined,
  ): FoldingBlock | null {
    if (!startBlock) {
      return null;
    }
    let cur: FoldingBlock = startBlock;
    while (cur.outerBlock && cur.outerBlock.type === cur.type) {
      cur = cur.outerBlock;
    }
    return cur;
  }

  private tryPromoteCustomBlock_() {
    const curSec = this.currSection;
    const outermostCustomBlock: FoldingBlock =
      this.searchLastConsecutiveBlockUpwardOfType_(this.currSection)!;
    // custom block promotion
    if (
      [this.SEC_TYPE.DATA, this.SEC_TYPE.PROC].includes(
        outermostCustomBlock?.outerBlock?.type,
      )
    ) {
      const nearestNonCustomBlock: FoldingBlock | undefined =
        outermostCustomBlock.outerBlock;
      if (nearestNonCustomBlock) {
        const pos =
          nearestNonCustomBlock?.innerBlocks.indexOf(outermostCustomBlock);
        nearestNonCustomBlock?.innerBlocks.splice(pos, 1);
        this.currSection = nearestNonCustomBlock;
        this.endFoldingBlock_(nearestNonCustomBlock.type, {
          line: outermostCustomBlock.startLine,
          column: outermostCustomBlock.startCol,
        });
        nearestNonCustomBlock.outerBlock?.innerBlocks.push(
          outermostCustomBlock,
        );
        outermostCustomBlock.outerBlock = nearestNonCustomBlock.outerBlock;
        this.currSection = curSec;
      }
    }
  }

  /*
   *            readMacro_
   *  PROC, DATA %MACRO -----> ignore
   */
  private readMacro_() {
    let word = "";
    const token = this.getNext_();

    if (!token) return;

    if (Lexer.isWord[token.type]) {
      if (this.isLabel_()) {
        this.stack.push({
          parse: this.readLabel_,
          state: this.PARSING_STATE.IN_MACRO,
        });
      } else if (this.isAssignment_(token)) {
        const validName = this._cleanKeyword(word);
        this.stack.push({
          parse: this.readMacroStmt_,
          state: this.PARSING_STATE.IN_MACRO,
          name: validName,
        });
      } else {
        word = token.text;
        switch (word) {
          case "%MEND":
            //normal section end
            token.type = Lexer.TOKEN_TYPES.MSKEYWORD;
            this.stack.push({
              parse: this.readMend_,
              state: this.PARSING_STATE.IN_MACRO,
              start: token,
              name: word,
            });
            break;
          case "%MACRO":
            //no normal end, and another proc meet, there are syntax errors
            // ignore
            this.startFoldingBlock_(this.SEC_TYPE.MACRO, token.start, word);
            token.type = Lexer.TOKEN_TYPES.MSKEYWORD;
            this.stack.push({
              parse: this.readMacro_,
              state: this.PARSING_STATE.IN_MACRO,
            });
            this.stack.push({
              parse: this.readMacroDef_,
              state: this.PARSING_STATE.IN_MACRO,
            });
            break;
          case "PROC":
          case "PROCEDURE": {
            this.startFoldingBlock_(this.SEC_TYPE.PROC, token.start, word);
            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            const procName = this.handleProcName_();
            this.stack.push({
              parse: this.readProc_,
              state: this.PARSING_STATE.IN_PROC,
              name: procName,
            });
            this.stack.push({
              parse: this.readProcDef_,
              state: this.PARSING_STATE.IN_PROC,
              name: procName,
            });
            break;
          }
          case "DATA":
            this.startFoldingBlock_(this.SEC_TYPE.DATA, token.start, word);
            token.type = Lexer.TOKEN_TYPES.SKEYWORD;
            this.stack.push({
              parse: this.readData_,
              state: this.PARSING_STATE.IN_DATA,
            });
            this.stack.push({
              parse: this.readDataDef_,
              state: this.PARSING_STATE.IN_DATA,
            });
            break;
          default:
            if (token.type === Lexer.TOKEN_TYPES.MREF) {
              this.handleMref_(this.PARSING_STATE.IN_MACRO);
            } else {
              const validName = this._cleanKeyword(word);
              const state: any = {
                parse: this.readMacroStmt_,
                state: this.PARSING_STATE.IN_MACRO,
                name: validName,
              };
              this.stack.push(state);
              //this.setKeyword_(token, this.langSrv.isProcedureStatementKeyword("MACRO", validName));
              const obj = this.handleLongStmtName_("MACRO", validName);
              state.name = obj.stmtName;
              this.setKeyword_(token, obj.isKeyword);
              state.hasSlashOptionDelimiter = this.syntaxDb.hasOptionDelimiter(
                "DATA",
                obj.stmtName,
              );
            }
        }
      }
    } else if (Lexer.isComment[token.type]) {
      if (this.isCustomBlockStart_(token)) {
        this.startFoldingBlock_(this.SEC_TYPE.CUSTOM, token.start, token.text);
      } else if (this.isCustomBlockEnd_(token)) {
        // only when there's an outer custom block, treat *endregion; as an end of custom region
        if (
          this.searchBlockUpwardOfType_(this.currSection, this.SEC_TYPE.CUSTOM)
        ) {
          this.tryEndFoldingBlock_(
            token.start,
            this.SEC_TYPE.CUSTOM,
            token.end,
          );
        }
      }
    }
    return token;
  }
  private readGbl_() {
    let word = "";
    const token = this.getNext_();

    if (!token) return;

    if (Lexer.isWord[token.type]) {
      if (this.isLabel_()) {
        this.stack.push({
          parse: this.readLabel_,
          state: this.PARSING_STATE.IN_GBL,
        });
      } else if (this.isAssignment_(token)) {
        const validName = this._cleanKeyword(word);
        this.stack.push({
          parse: this.readGblStmt_,
          state: this.PARSING_STATE.IN_GBL,
          name: validName,
        });
      } else {
        word = token.text;
        if (word === "PROC" || word === "PROCEDURE") {
          if (this.currSection?.type !== this.SEC_TYPE.CUSTOM) {
            this.endFoldingBlock_(this.SEC_TYPE.GBL, this.lastToken.end);
          }
          this.startFoldingBlock_(this.SEC_TYPE.PROC, token.start, word);
          token.type = Lexer.TOKEN_TYPES.SKEYWORD;
          this.stack.pop();
          const procName = this.handleProcName_();
          this.stack.push({
            parse: this.readProc_,
            state: this.PARSING_STATE.IN_PROC,
            name: procName,
          });
          this.stack.push({
            parse: this.readProcDef_,
            state: this.PARSING_STATE.IN_PROC,
            name: procName,
          });
        } else if (word === "%MACRO") {
          if (this.currSection?.type !== this.SEC_TYPE.CUSTOM) {
            this.endFoldingBlock_(this.SEC_TYPE.GBL, this.lastToken.end);
          }
          this.startFoldingBlock_(this.SEC_TYPE.MACRO, token.start, word);
          token.type = Lexer.TOKEN_TYPES.MSKEYWORD;
          this.stack.pop();
          this.stack.push({
            parse: this.readMacro_,
            state: this.PARSING_STATE.IN_MACRO,
          });
          this.stack.push({
            parse: this.readMacroDef_,
            state: this.PARSING_STATE.IN_MACRO,
          });
        } else if (word === "DATA") {
          if (this.currSection?.type !== this.SEC_TYPE.CUSTOM) {
            this.endFoldingBlock_(this.SEC_TYPE.GBL, this.lastToken.end);
          }
          this.startFoldingBlock_(this.SEC_TYPE.DATA, token.start, word);
          token.type = Lexer.TOKEN_TYPES.SKEYWORD;
          this.stack.pop();
          this.stack.push({
            parse: this.readData_,
            state: this.PARSING_STATE.IN_DATA,
          });
          this.stack.push({
            parse: this.readDataDef_,
            state: this.PARSING_STATE.IN_DATA,
          });
        } else if (token.type === Lexer.TOKEN_TYPES.MREF) {
          this.handleMref_(this.PARSING_STATE.IN_GBL);
        } else {
          if (!this.hasFoldingBlock_()) {
            this.startFoldingBlock_(this.SEC_TYPE.GBL, token.start, word);
          }
          const validName = this._cleanKeyword(word);
          const state: any = {
            parse: this.readGblStmt_,
            state: this.PARSING_STATE.IN_GBL,
            name: validName,
          };
          this.stack.push(state);
          if (!this.tryToHandleSectionEnd_(token)) {
            //this.setKeyword_(token, this.langSrv.isStatementKeyword(validName));
            const obj = this.handleLongStmtName_("", validName);
            state.name = obj.stmtName;
            this.setKeyword_(token, obj.isKeyword);
            state.hasSlashOptionDelimiter = this.syntaxDb.hasOptionDelimiter(
              "",
              obj.stmtName,
            );
          }
        }
      }
    } else if (Lexer.isComment[token.type]) {
      if (this.isCustomBlockStart_(token)) {
        if (this.currSection?.type !== this.SEC_TYPE.CUSTOM) {
          this.endFoldingBlock_(this.SEC_TYPE.GBL, this.lastToken.end);
        }
        this.startFoldingBlock_(this.SEC_TYPE.CUSTOM, token.start, token.text);
      } else if (this.isCustomBlockEnd_(token)) {
        this.tryEndFoldingBlock_(token.end, this.SEC_TYPE.CUSTOM);
      }
    }
    return token;
  }
  private readCards_() {
    let word = "",
      totalLines,
      line,
      text,
      token = null;
    const endExp =
      Lexer.isCards4[this.curr.name] || Lexer.isParmcards4[this.curr.name]
        ? /^;;;;/
        : /;/;

    if (this.cardsState === this.CARDS_STATE.IN_CMD) {
      token = this.getNext_();
      if (token && token.type === Lexer.TOKEN_TYPES.SEP) {
        word = token.text;
        if (word === ";") {
          //the data will start from the next line
          this.startLineForCardsData = token.end.line + 1;
          this.cardsState = this.CARDS_STATE.IN_DATA_WAITING;
        }
      }
    } else if (this.cardsState === this.CARDS_STATE.IN_DATA_WAITING) {
      token = this.getNext_();
      if (token && token.start.line >= this.startLineForCardsData) {
        //this line is data
        this.cardsState = this.CARDS_STATE.IN_DATA;
        //get data range
        this.startLineForCardsData = token.start.line; //ignore blank lines
        totalLines = this.model.getLineCount();
        line = token.start.line;
        text = "";
        do {
          text = this.model.getLine(line);
          //find ';;;;' and it must be the start of a line
          // or find ';'
          if (endExp.test(text)) {
            break;
          } else {
            line++;
          }
        } while (line < totalLines);

        // FIXID S0890608: data in "datalines" statement does not change color when I input the SAS code in CE
        // No matter whether found, always returns cardsdata
        line--;
        this.lexer.start.line = this.startLineForCardsData;
        this.lexer.start.column = 0;
        this.lexer.curr.line = line;
        this.lexer.curr.column = this.model.getLine(line).length;
        //TODO: IMPROVE
        return this._changeCardsDataToken({
          type: Lexer.TOKEN_TYPES.CARDSDATA,
          start: this._clonePos(this.lexer.start),
          end: this._clonePos(this.lexer.curr),
        });
      }
    } else if (this.cardsState === this.CARDS_STATE.IN_DATA) {
      token = this.getNext_();
      if (token && token.text === ";") {
        // for datalines4, we also do this even there are 4 ;;;;
        this.cardsState = this.CARDS_STATE.IN_NULL;
        this.stack.pop();
      }
    } else {
      //IN_NULL, error
    }
    return token;
  }
  private readEnd_() {
    const token = this.getNext_();
    if (token && token.text === ";") {
      if (
        this.curr.state === this.PARSING_STATE.IN_PROC ||
        this.curr.state === this.PARSING_STATE.IN_DATA
      ) {
        this.stack.pop();
        this.stack.pop();
        this.endFoldingBlock_(
          this.curr.state === this.PARSING_STATE.IN_PROC
            ? this.SEC_TYPE.PROC
            : this.SEC_TYPE.DATA,
          token.end,
          true,
          this.curr.start,
          this.curr.name,
        );
      }
    }
    return token;
  }
  private readMend_() {
    const token = this.getNext_();
    if (token && token.text === ";") {
      if (this.curr.state === this.PARSING_STATE.IN_MACRO) {
        this.stack.pop();
        this.stack.pop();
        this.tryEndFoldingBlock_(
          this.curr.start.start,
          this.SEC_TYPE.MACRO,
          token.end,
        );
      }
    }
    return token;
  }
}
/*
How to handle this kind of statement?
  scatterplot x=horsepower y=mpg_city / group=origin name="cars";

  '/' is not an operator.

*/
class Expression {
  parse: (
    ignoreDivision: boolean | undefined,
    startPos: number,
    onMeetTarget: any,
  ) => { pos: number };
  constructor(parser: LexerEx) {
    const isScopeBeginMark = arrayToMap(["[", "{", "("]);

    function _copyContext(src: { pos: any }, dst: { pos: any }) {
      dst.pos = src.pos;
    }

    function _cloneContext(src: { pos: any }) {
      return {
        pos: src.pos,
      };
    }

    function _next0(context: { pos: number }) {
      context.pos++;
      let token = parser.prefetch0_(context.pos);
      if (!token) {
        const end = parser._docEndPos();
        token = {
          type: "text",
          text: "",
          start: end,
          end: end,
        };
      }
      return token;
    }

    function _next(context: { pos: any }) {
      let token;
      do {
        token = _next0(context);
      } while (Lexer.isComment[token.type]);
      return token;
    }

    function _tryGetOpr(context: any) {
      const tmpContext = _cloneContext(context),
        token = _next(tmpContext);

      return { token: token, context: tmpContext };
    }
    /*
     *  output out= tmp*ginv((CovVarR-CovVarU),b=a)*tmp*(a+b)*(f(a,b))
     *
     */
    // get the token count in an expression
    function _expr(
      context: { pos: any; onMeetTarget: any },
      ends: { [x: string]: any; ";"?: number },
      optionNameCandidate?: boolean,
    ) {
      let text, ret;

      const tmpContext = _cloneContext(context),
        token = _next(tmpContext);
      if (ends && ends[token.text]) {
        return;
      } else if (isScopeBeginMark[token.text]) {
        // not consume this mark
        _argList(context, ends);
      } else if (Lexer.isUnaryOpr[token.text]) {
        _copyContext(tmpContext, context); // consume this operator
        _expr(context, ends);
      } else {
        _copyContext(tmpContext, context); // consume this token
        if (optionNameCandidate && Lexer.isWord[token.type]) {
          context.onMeetTarget(token, context.pos);
        }
      }

      for (;;) {
        ret = _tryGetOpr(context);
        text = ret.token.text;
        if (Lexer.isBinaryOpr[text]) {
          _copyContext(ret.context, context);
          if (Lexer.isWord[ret.token.type]) {
            //may always be keyword, but we take the general flow (HTMLCOMMONS-3812)
            context.onMeetTarget(ret.token, context.pos);
          }
          _expr(context, ends);
        } else if (isScopeBeginMark[text]) {
          if (Lexer.isWord[token.type] && text === "(") {
            //TODO: Improve this
            //function call
            if (parser.syntaxDb.isSasFunction(token.text)) {
              parser.setKeyword_(token, true);
            }
          }
          _argList(context, ends);
        } else {
          return;
        }
      }
    }

    function _argList(context: any, ends: { [x: string]: number }) {
      let token = _next(context), //consume left mark
        tmpContext = null,
        exit = false;
      const marks: Record<string, string> = { "(": ")", "[": "]", "{": "}" },
        lmark = token.text,
        rmark = marks[lmark];

      ends = { ";": 1 };
      ends[rmark] = 1;
      do {
        _expr(context, ends, true); //complex expression
        tmpContext = _cloneContext(context);
        token = _next(tmpContext);
        switch (token.text) {
          case "":
          case ";":
            exit = true;
            break;
          case rmark:
            _copyContext(tmpContext, context); // consume right mark
            exit = true;
            break;
          case "=":
            _copyContext(tmpContext, context);
            _expr(context, ends); //option value
            break;
          case ",":
            _copyContext(tmpContext, context);
            break;
        }
      } while (!exit);
    }

    this.parse = function (
      ignoreDivision: boolean | undefined,
      startPos: number,
      onMeetTarget: any,
    ) {
      const context = {
          pos: startPos,
          onMeetTarget: onMeetTarget,
        },
        ret = { pos: 0 };
      try {
        if (ignoreDivision === undefined) {
          ignoreDivision = true;
        }
        ignoreDivision
          ? delete Lexer.isBinaryOpr["/"]
          : (Lexer.isBinaryOpr["/"] = 1);
        // Lexer.isBinaryOpr["/"] = !ignoreDivision;
        _expr(context, { ";": 1 });
        ret.pos = context.pos;
        Lexer.isBinaryOpr["/"] = 1;
      } catch (e) {
        //ignore any errors
        //assert('parse expression error'); // eslint-disable-line shikari/sas-i18n-ems
      }
      return ret;
    };
  }
}
