// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-non-null-assertion,
@typescript-eslint/no-unused-vars,@typescript-eslint/no-explicit-any, @typescript-eslint/dot-notation, @typescript-eslint/consistent-type-assertions */
import { arrayToMap } from "./utils";
import { LexerEx } from "./LexerEx";
import { Lexer, Token } from "./Lexer";
import { Model } from "./Model";
import { SyntaxProvider } from "./SyntaxProvider";
import { SyntaxDataProvider } from "./SyntaxDataProvider";

interface TokenEx extends Pick<Token, "type" | "text"> {
  line: number;
  col: number;
  endLine?: number;
  endCol?: number;
}
interface TokenWithPos extends TokenEx {
  pos: number;
}

interface Context {
  line: number;
  col: number;
  syntaxIdx: number;
  block?: any;
  cursor?: any;
  tokens?: any;
  tokenIdx?: any;
  lastStmtEnd?: any;
  scopes?: any;
}

interface Zone {
  type: number;
}

const SEC_TYPE = LexerEx.SEC_TYPE,
  _isBlockEnd: Record<string, 1> = { RUN: 1, QUIT: 1, "%MEND": 1 },
  _secStarts: Record<string, 1> = { PROC: 1, DATA: 1 },
  _secEnds: Record<string, 1> = { "%MACRO": 1, RUN: 1, QUIT: 1 },
  _secType: Record<string, string | number> = {
    PROC: SEC_TYPE.PROC,
    DATA: SEC_TYPE.DATA,
    "%MACRO": SEC_TYPE.MACRO,
    BEGINGRAPH: "statgraph",
  },
  _isScopeBeginMark: Record<string, 1> = { "[": 1, "{": 1, "(": 1 },
  _tagsets = arrayToMap([
    "CHTML",
    "CORE",
    "CSV",
    "CSVALL",
    "CVSBYLINE",
    "DEFAULT",
    "DOCBOOK",
    "ExcelXP",
    "HTML4",
    "HTMLCSS",
    "HTMLPANEL",
    "HTMLSCROLL",
    "IMODE",
    "MSOFFICE2K",
    "MVSHTML",
    "PHTML",
    "PYX",
    "RTF",
    "SASREPORT",
    "SQL",
    "SUPERMAP",
    "TABLEEDITOR",
    "WML",
    "WMLOLIST",
    "XBRL",
    "XHTML",
    "EVENT_HTML",
    "NAMEDHTML",
    "SHORT_MAP",
    "STYLE_DISPLAY",
    "STYLE_POPUP",
    "TEXT_MAP",
    "TPL_STYLE_LIST",
    "TPL_STYLE_MAP",
  ]);

export class CodeZoneManager {
  private _lexer;

  private _procName = "";
  private _stmtName = "";
  private _optName = "";
  private _subOptName = "";

  private _topZone = 0;
  private _sectionMode: {
    secType: number;
    procName: string;
  } | null = null;
  //_typeWithArgs = Utils.arrayToMap([ZONE_TYPE.OBJECT, ZONE_TYPE.MACRO_FUNC, ZONE_TYPE.SAS_FUNC]),
  private _specialStmt: any = {
    STYLE: this._style,
    ODS: this._ods,
    IF: this._if,
    WHERE: this._where,
  };
  private _stmtCache: Record<string, Record<string, 1>> = {};
  private _stmtWithOptionDelimiter: Record<string, Record<string, boolean>> =
    {};

  private _dummyToken = { line: 0, col: 0, type: "text", pos: -1 };

  constructor(
    private _model: Model,
    private _syntaxDb: SyntaxDataProvider,
    private _syntaxProvider: SyntaxProvider
  ) {
    this._lexer = new Lexer(_model);
  }
  // private functions
  private _reset() {
    this._procName = "";
    this._stmtName = "";
    this._optName = "";
    this._subOptName = "";
  }
  private _needOptionDelimiter() {
    if (!this._stmtWithOptionDelimiter[this._procName]) {
      this._stmtWithOptionDelimiter[this._procName] = {};
    }

    if (
      this._stmtWithOptionDelimiter[this._procName][this._stmtName] ===
      undefined
    ) {
      this._stmtWithOptionDelimiter[this._procName][this._stmtName] =
        this._syntaxDb.hasOptionDelimiter(this._procName, this._stmtName);
    }
    return this._stmtWithOptionDelimiter[this._procName][this._stmtName];
  }
  private _isDatasetOpt(name: string) {
    let type = null;
    if (this._topZone === CodeZoneManager.ZONE_TYPE.PROC_DEF) {
      type = this._syntaxDb.getProcedureOptionType(this._procName, name);
    } else if (this._topZone === CodeZoneManager.ZONE_TYPE.PROC_STMT) {
      type = this._syntaxDb.getProcedureStatementOptionType(
        this._procName,
        this._stmtName,
        name
      );
    }
    if (type && this._syntaxDb.isDataSetType(type)) {
      return true;
    }
    return false;
  }
  private _getStmts(procName: string) {
    let stmts, setCache;

    if (!this._stmtCache[procName]) {
      stmts = this._syntaxDb.getProcedureStatements(procName);
      setCache = (stmts?: string[]) => {
        if (stmts && stmts.length > 0) {
          this._stmtCache[procName] = arrayToMap(stmts);
        }
      };
      //if (!stmts) {
      //    _syntaxDb.getProcedureStatements(procName,function(stmts){
      //        setCache(stmts);
      //    });
      //}
      setCache(stmts);
    }
    return this._stmtCache[procName];
  }
  private _getFullStmtName(
    context: Context,
    procName: string,
    stmt: TokenWithPos
  ) {
    const stmts = this._getStmts(procName),
      tmpContext2 = this._cloneContext(context),
      token2 = this._getNextEx(tmpContext2),
      tmpContext3 = this._cloneContext(tmpContext2),
      token3 = this._getNextEx(tmpContext3),
      tmpContext4 = this._cloneContext(tmpContext3),
      token4 = this._getNextEx(tmpContext4),
      name2 = stmt.text.toUpperCase() + " " + token2.text,
      name3 = name2 + " " + token3.text,
      name4 = name3 + " " + token4.text;
    if (stmts) {
      if (stmts[name4]) {
        this._copyContext(tmpContext4, context);
        stmt.text = name4;
        stmt.pos = token4.pos > 0 ? 1 : token4.pos;
      } else if (stmts[name3]) {
        this._copyContext(tmpContext3, context);
        stmt.text = name3;
        stmt.pos = token3.pos > 0 ? 1 : token3.pos;
      } else if (stmts[name2]) {
        this._copyContext(tmpContext2, context);
        stmt.text = name2;
        stmt.pos = token2.pos > 0 ? 1 : token2.pos;
      }
    }
    if (procName === "ODS" && _tagsets[token2.text.replace("TAGSETS.", "")]) {
      this._copyContext(tmpContext2, context);
      stmt.text = name2;
      stmt.pos = token2.pos > 0 ? 1 : token2.pos;
    }
  }
  private _ended(token: TokenEx) {
    let line,
      start,
      end,
      ret = true,
      reg = null;
    const regs: Record<string, RegExp> = {
      comment: /(^\*.*;$|^\/\*.*\*\/$)/i,
      "macro-comment": /(^%\*.*;$)/i,
      string: /(^'.*'$|^".*"$)/i,
      date: /(^'.*'d$|^".*"d$)/i,
      time: /(^'.*'t$|^".*"t$)/i,
      dt: /(^'.*'dt$|^".*"dt$)/i,
      bitmask: /(^'.*'b$|^".*"b$)/i,
      namelit: /(^'.*'n$|^".*"n$)/i,
      hex: /(^'.*'x$|^".*"x$)/i,
    };
    if (token.endLine) {
      start = this._model.getLine(token.line).substr(token.col, 2);
      end = this._model.getLine(token.endLine).substring(0, token.endCol);
    } else {
      start = token.text;
      end = token.text;
    }
    line = start.substr(0, 2);
    if (end.length <= 2) {
      line += end;
    } else {
      line += end.substr(end.length - 2, 2);
    }

    if (Lexer.isComment[token.type] || Lexer.isLiteral[token.type]) {
      reg = regs[token.type];
      if (reg && !reg.test(line)) {
        ret = false;
      }
    }
    return ret;
  }
  private _token(line: number, col: number): TokenEx | null {
    let syntax = this._syntaxProvider.getSyntax(line);
    const len = syntax.length;
    let i = 1,
      j = -1,
      type: Token["type"] = "text",
      currLine = line;
    for (; i < len; i++) {
      if (syntax[i].start >= col) {
        if (syntax[i - 1].start <= col) {
          j = i - 1;
          type = syntax[j].style;
          break;
        } else {
          break; //not found, not continue
        }
      }
    }

    if (Lexer.isComment[type] || Lexer.isLiteral[type]) {
      while (currLine >= 0) {
        if (syntax[j].state instanceof Object) {
          return {
            type: type,
            text: "",
            line: currLine,
            col: syntax[j].start,
            endLine: syntax[j].state.line,
            endCol: syntax[j].state.col,
          };
        } else if (syntax[j].state === 1) {
          //met the start of the node
          break;
        } else {
          j--;
          if (j < 0) {
            do {
              currLine--;
              syntax = this._syntaxProvider.getSyntax(currLine); //skip the line without syntax
            } while (currLine >= 0 && syntax.length === 0);
            j = syntax.length - 1;
          }
        }
      }
    }
    if (i > 0) {
      const lineText = this._model.getLine(line);
      let endCol = 0,
        startCol = 0;
      syntax = this._syntaxProvider.getSyntax(line);
      if (syntax.length !== 0) {
        endCol = syntax[i] ? syntax[i].start : lineText.length;
        startCol = syntax[i - 1].start;
      }
      return {
        type: type,
        text: lineText.substring(startCol, endCol),
        line: line,
        col: startCol,
      };
    }
    return null;
  }
  private _getPrev(context: Context): TokenEx | null {
    let line = "",
      lineLen = 0,
      syntax = [],
      syntaxLen = 0,
      text = "",
      col = 0,
      type: Token["type"] = "text",
      i = 0,
      token = null;
    const lineCount = this._model.getLineCount();

    if (context.line >= lineCount) {
      context.line = lineCount - 1;
      context.col = this._model.getLine(context.line).length;
    }
    line = this._model.getLine(context.line);
    lineLen = line.length;
    syntax = this._syntaxProvider.getSyntax(context.line);
    syntaxLen = syntax.length;
    // syntaxIdx is used to cache the index of syntax node in syntax table,
    // if syntaxIdx is less than 0, we must initialize it
    if (context.syntaxIdx < 0) {
      context.syntaxIdx =
        this._syntaxProvider.getSyntax(context.line).length - 2;
    }
    do {
      // skip backward
      while (context.col < 0 || syntax.length === 0) {
        context.line--; // the previous line
        if (context.line < 0) {
          return null; // no any token
        }
        line = this._model.getLine(context.line);
        lineLen = line.length;
        context.col = lineLen - 1;
        syntax = this._syntaxProvider.getSyntax(context.line);
        syntaxLen = syntax.length;
        context.syntaxIdx = syntaxLen - 2;
      }

      // find the node
      if (
        /*syntax[syntaxLen-1].state !== 0 && */ // for the line without normal end mark.
        syntax[syntaxLen - 1].start <= context.col &&
        lineLen >= context.col
      ) {
        i = syntaxLen - 1;
      } else {
        for (i = context.syntaxIdx; i >= 0; i--) {
          if (
            syntax[i].start <= context.col &&
            syntax[i + 1].start >= context.col
          ) {
            break;
          }
        }
      }
      // get the text and type
      if (context.syntaxIdx < 0 || i < 0) {
        //this line is special, no normal end mark,
        col = 0;
        type = syntax[0].style;
        text = line.substring(0, lineLen);
      } else {
        col = syntax[i].start;
        type = syntax[i].style;
        text = line.substring(
          col,
          syntax[i + 1] ? syntax[i + 1].start : lineLen
        );
      }
      // adjust pointer
      if (i < 1) {
        context.col = -1;
        context.syntaxIdx = -1;
      } else {
        context.col = syntax[i - 1].start;
        context.syntaxIdx = i - 1;
      }
    } while (/^\s*$/.test(text));

    if (Lexer.isComment[type] || Lexer.isLiteral[type]) {
      token = this._token(context.line, col + 1)!;
      if (
        token.endLine &&
        (token.line !== context.line || token.col !== context.col)
      ) {
        context.col = token.col - 1;
        context.line = token.line;
        context.syntaxIdx = -1;
      }
      if (Lexer.isComment[type]) {
        return this._getPrev(context);
      }
      return token;
    }

    return {
      type: type,
      text: text,
      line: context.line,
      col: col,
    };
  }
  private _getNext(context: Context): TokenEx | null {
    let token,
      tmpToken: TokenEx | null = null,
      pos;
    if (context.tokens) {
      if (context.tokenIdx < context.tokens.length) {
        tmpToken = context.tokens[context.tokenIdx] as TokenEx;
        if (tmpToken.endLine) {
          context.line = tmpToken.endLine;
          context.col = tmpToken.endCol!;
        } else {
          context.line = tmpToken.line;
          context.col = tmpToken.col + tmpToken.text.length;
        }
        context.tokenIdx++;
      }
    } else {
      pos = this._normalize(context.line, context.col);
      this._lexer.startFrom(pos.line, pos.col);
      token = this._lexer.getNext();
      if (token) {
        context.line = token.end.line;
        context.col = token.end.column;
        tmpToken = this._transToken(token);
      }
    }
    while (tmpToken && Lexer.isComment[tmpToken.type]) {
      //skip comments
      tmpToken = this._getNext(context);
    }
    if (tmpToken && tmpToken.type === Lexer.TOKEN_TYPES.MREF) {
      // skip macro-ref S1405245
      const mRefToken = tmpToken;
      tmpToken = this._getNext(context);
      if (tmpToken && tmpToken.text === "(") {
        while (
          tmpToken &&
          tmpToken.text !== ")" &&
          this._pos(context.cursor, tmpToken) === -1
        ) {
          tmpToken = this._getNext(context);
        }
        if (this._pos(context.cursor, tmpToken!) === -1) {
          tmpToken = this._getNext(context);
        } else {
          tmpToken = mRefToken;
        }
      }
    }
    return tmpToken;
  }
  private _getNextEx(context: Context): TokenWithPos {
    let token = this._getNext(context),
      lc,
      tmpContext,
      next;

    if (token && token.text === "&") {
      tmpContext = this._cloneContext(context);
      next = this._getNext(tmpContext);
      if (next && next.text !== "" && Lexer.isWord[next.type]) {
        //macro variables
        token.text = "&" + next.text;
        token.type = "text";
        this._copyContext(tmpContext, context);
      }
    }
    if (!token) {
      lc = this._model.getLineCount() - 1;
      token = {
        type: "text",
        text: "",
        line: lc,
        col: this._model.getColumnCount(lc),
      };
    }
    return {
      ...token,
      pos: this._pos(context.cursor, token),
      text: token.text.toUpperCase(),
    };
  }
  private _transToken(token: Token) {
    if (token) {
      const nToken: TokenEx = {
        type: token.type,
        line: token.start.line,
        col: token.start.column,
        text: token.text,
      };
      if (token.start.line !== token.end.line) {
        nToken["endLine"] = token.end.line;
        nToken["endCol"] = token.end.column;
      }
      return nToken;
    }
    return token;
  }
  private _tokenizeStmt(line: number, col: number) {
    let token;
    const tokens = [];
    this._lexer.startFrom(line, col);
    do {
      token = this._lexer.getNext();
      if (token) {
        token = this._transToken(token);
        tokens.push(token);
        if (token.text === ";") {
          break;
        }
      }
    } while (token);
    return tokens;
  }
  private _emit(token: any, zone: number, force?: boolean) {
    //if (force || !_typeWithArgs[token.zone]) {
    // NOTE: bigger zone indicates it should be used.
    if (force || !token.zone || zone > token.zone) {
      token.zone = zone;
    }
  }
  private _emit1(token: any, lZone: number, rZone: number) {
    if (token.pos === 0) {
      token.zone = rZone;
    } else if (token.pos >= 2) {
      token.zone = lZone;
    }
  }
  private _blockName(block: { startLine: number; startCol: number }) {
    let token = null;
    const context = {
      line: block.startLine,
      col: block.startCol,
      syntaxIdx: 0,
    };
    this._getNext(context); //section keyword
    token = this._getNext(context);
    return token ? token.text.toUpperCase() : "";
  }
  /* return values:
     c c[c]c c
     3 2 1 0 -1
    */
  private _pos(cursor: { line: number; col: number }, token: TokenEx) {
    const l1 = token.line,
      c1 = token.col;
    let l2, c2;
    if (token.endLine === undefined) {
      l2 = l1;
      c2 = c1 + token.text.length;
    } else {
      l2 = token.endLine;
      c2 = token.endCol!;
    }
    if (cursor.line > l2) {
      return -1;
    } else if (cursor.line < l1) {
      return 3;
    } else if (l2 === l1) {
      // token in a line
      if (cursor.col < c1) {
        return 3;
      } else if (cursor.col === c1) {
        return 2;
      } else if (cursor.col === c2) {
        return 0;
      } else if (cursor.col > c2) {
        return -1;
      } else {
        return 1;
      }
    } else {
      // token cross multiple lines
      if (cursor.line === l1) {
        //start line
        if (cursor.col < c1) {
          return 3;
        } else if (cursor.col === c1) {
          return 2;
        } else {
          return 1;
        }
      } else if (cursor.line === l2) {
        //end line
        if (cursor.col > c2) {
          return -1;
        } else if (cursor.col === c2) {
          return 0;
        } else {
          return 1;
        }
      } else {
        return 1;
      }
    }
  }
  /*
   * return value:
   * 1: overlap
   * 0: token in block
   * -1: token outside of block
   */
  private _inBlock(
    block: {
      endLine: number;
      endCol: number;
      startLine: number;
      startCol: number;
    },
    token: TokenEx
  ) {
    if (token.endLine && token.endLine !== token.line) {
      //multiple line token
      //TODO: not implemented
    } else {
      //token in a line
      //TODO: not implement all conditions
      if (
        (token.line === block.endLine && token.col >= block.endCol) ||
        (token.line === block.startLine &&
          token.col + token.text.length <= block.startCol) ||
        token.line > block.endLine ||
        token.line < block.startLine
      ) {
        return -1;
      } else {
        return 0; //TODO: include overlap
      }
    }
  }
  private _isBlockStart(
    block: { startLine: number; startCol: number },
    token: TokenEx
  ) {
    /* FOR S1182067*/
    return block.startLine === token.line && block.startCol === token.col;
  }
  private _endedReally(block: { endLine: number; endCol: number }) {
    let token = null,
      word = null;
    const context = {
      line: block.endLine,
      col: block.endCol,
      syntaxIdx: -1,
    };

    do {
      token = this._getPrev(context);
    } while (token && token.text !== ";");
    if (token) {
      token = this._getPrev(context);
      if (token && token.text) {
        word = token.text.toUpperCase();
        if (_isBlockEnd[word]) {
          return true;
        } else if (word === "CANCEL") {
          token = this._getPrev(context);
          if (token && token.text && _isBlockEnd[token.text.toUpperCase()]) {
            return true;
          }
        }
      }
    }
    return false;
  }
  private _skipToStmtStart(context: Context, tokenizing: boolean) {
    let token = null,
      len = 0;
    const tokens = [];

    context.syntaxIdx = -1;
    context.tokens = null;
    do {
      token = this._getPrev(context);
      tokens.push(token);
    } while (token && token.text !== ";");
    if (token) {
      context.line = token.line;
      context.col = token.col + 1;
      context.syntaxIdx = -1;
      context.lastStmtEnd = { line: token.line, col: token.col };
    } else {
      context.line = 0;
      context.col = 0;
      context.syntaxIdx = -1;
      context.lastStmtEnd = null;
    }
    // ignore label
    len = tokens.length;
    if (
      len > 3 &&
      Lexer.isWord[tokens[len - 2]!.type] &&
      tokens[len - 3]!.text === ":"
    ) {
      this._getNext(context);
      this._getNext(context);
    }
    if (tokenizing) {
      context.tokens = this._tokenizeStmt(context.line, context.col);
    }
    context.tokenIdx = 0;
  }
  private _isStatgraph(
    parentBlock: { startLine: number; startCol: number },
    cursor: { line: number; col: number },
    stmtName: string
  ) {
    const block = this._findEmbeddedBlock(
      parentBlock,
      cursor,
      { BEGINGRAPH: 1 },
      { ENDGRAPH: 1 }
    );
    if (block && block.type === "statgraph" && stmtName !== "BEGINGRAPH") {
      return true;
    }
    return false;
  }
  private _embeddedBlock(
    parentBlock: { startLine: number; startCol: number },
    cursor: { line: number; col: number }
  ) {
    return this._findEmbeddedBlock(parentBlock, cursor, _secStarts, _secEnds);
  }
  private _findEmbeddedBlock(
    parentBlock: { startLine: number; startCol: number },
    cursor: { line: number; col: number },
    starts: Record<string, 1>,
    ends: Record<string, 1>
  ) {
    let token = null,
      secName = null,
      stmtCount = 0;
    const context: Context = {
      //'block': block,
      line: cursor.line,
      col: cursor.col,
      syntaxIdx: -1,
      cursor: cursor,
    };
    do {
      this._skipToStmtStart(context, false);
      stmtCount++;
      token = this._getNext(context);

      if (token) {
        secName = token.text.toUpperCase();
        if (starts[secName]) {
          return {
            startLine: token.line,
            startCol: token.col,
            endLine: cursor.line,
            endCol:
              token.col + 4 > cursor.col && token.line === cursor.line
                ? token.col + 4
                : cursor.col, // not real in most conditions
            type: _secType[secName],
          };
        } else if (ends[secName]) {
          if (stmtCount > 1) {
            return null;
          }
        }
      } else {
        token = { line: context.line, col: context.col };
      }
      if (context.lastStmtEnd) {
        context.col = context.lastStmtEnd.col - 1;
        context.line = context.lastStmtEnd.line;
        context.lastStmtEnd = null;
      }
    } while (
      token.line > parentBlock.startLine ||
      (token.line === parentBlock.startLine && token.col > parentBlock.startCol)
    );
    return null;
  }
  private _globalStmt(context: Context) {
    let tmpContext = null,
      block = null;
    this._skipToStmtStart(context, true);
    tmpContext = {
      line: context.line,
      col: context.col,
      cursor: context.cursor,
      syntaxIdx: -1,
    };
    const token = this._getNextEx(context); // procedure name
    if (token.pos >= 0) {
      block = this._syntaxProvider.getFoldingBlock(
        tmpContext.line,
        tmpContext.col
      );
      if (block) {
        if (this._inBlock(block, token)! < 0 && !this._endedReally(block)) {
          //not in block
          if (token.text === "%MACRO") {
            return CodeZoneManager.ZONE_TYPE.MACRO_STMT;
          }
          switch (block.type) {
            case SEC_TYPE.PROC:
              if (this._isStatgraph(block, context.cursor, token.text)) {
                this._procName = "STATGRAPH";
              } else {
                this._procName = this._blockName(block);
                this._stmtName = token.text;
              }
              return CodeZoneManager.ZONE_TYPE.PROC_STMT;
            case SEC_TYPE.DATA:
              return CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT;
            //case SEC_TYPE.MACRO: return ZONE_TYPE.GBL_STMT;
          }
        }
      }
      if (token.text[0] === "%") {
        return CodeZoneManager.ZONE_TYPE.MACRO_STMT; //TODO: need to differ among ARM macro, autocall macro, macro function, macro statement
      } else {
        return CodeZoneManager.ZONE_TYPE.GBL_STMT;
      }
    }

    switch (token.text.toUpperCase()) {
      case "PROC":
      case "PROCEDURE":
        return this._procDef(context);
      case "DATA":
        return this._dataDef(context, token);
      case "%MACRO":
        return this._macroDef(context);
    }
    this._stmtName = token.text.toUpperCase();
    this._topZone = CodeZoneManager.ZONE_TYPE.GBL_STMT;
    const zone = this._stmtEx(context, token);
    if (this._isCall(zone)) {
      return CodeZoneManager.ZONE_TYPE.RESTRICTED;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.OPT_NAME) {
      return CodeZoneManager.ZONE_TYPE.GBL_STMT_OPT;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.OPT_VALUE) {
      return CodeZoneManager.ZONE_TYPE.GBL_STMT_OPT_VALUE;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.SUB_OPT_NAME) {
      if (
        this._syntaxDb.isStatementSubOptKeyword(
          this._stmtName,
          this._optName,
          this._subOptName
        ) ||
        this._subOptName
      ) {
        return CodeZoneManager.ZONE_TYPE.GBL_STMT_SUB_OPT_NAME;
      }
    } else if (
      this._stmtName === "%SYSCALL" &&
      /^%SYSCALL\b/.test(token.text)
    ) {
      return this._callStmt(context);
    }
    return zone.type;
  }
  private _procSec(context: Context) {
    let token = null,
      text = null,
      inBlock = false;
    this._skipToStmtStart(context, true);
    token = this._getNextEx(context);
    if (Lexer.isWord[token.type]) {
      text = token.text.toUpperCase();
      if (token.pos >= 0) {
        //the token has been right side of the cursor
        inBlock = this._inBlock(context.block, token)! >= 0;
        if (
          (inBlock && text !== "PROC") ||
          (!inBlock && //not in block
            !this._endedReally(context.block))
        ) {
          //not really end the last block
          this._procName = this._blockName(context.block);
          if (text[0] === "%") {
            return CodeZoneManager.ZONE_TYPE.MACRO_STMT;
          } else {
            if (this._isStatgraph(context.block, context.cursor, text)) {
              this._procName = "STATGRAPH";
            }
            const zone = this._procStmt(context, token); //some procedure statments' name includes several words.
            return zone === CodeZoneManager.ZONE_TYPE.ODS_STMT
              ? zone
              : CodeZoneManager.ZONE_TYPE.PROC_STMT;
          }
        } else {
          return CodeZoneManager.ZONE_TYPE.GBL_STMT;
        }
      } else {
        switch (text) {
          case "PROC":
          case "PROCEDURE":
            return this._procDef(context);
          case "DATA":
            return this._dataDef(context, token);
          default: {
            if (this._isStatgraph(context.block, context.cursor, text)) {
              this._procName = "STATGRAPH";
            } else {
              this._procName = this._blockName(context.block);
            }
            return this._procStmt(context, token);
          }
        }
      }
    } else {
      this._procName = this._blockName(context.block);
      return this._procStmt(context, token);
    }
  }
  private _procDef(context: Context) {
    let token = null;
    token = this._getNextEx(context); // procedure name
    if (token.pos >= 0 && token.text !== "=") {
      return CodeZoneManager.ZONE_TYPE.PROC_DEF;
    }
    this._procName = token.text.toUpperCase();
    this._topZone = CodeZoneManager.ZONE_TYPE.PROC_DEF;
    const zone = this._stmtEx(context, token);
    if (this._isCall(zone)) {
      return CodeZoneManager.ZONE_TYPE.RESTRICTED;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.OPT_NAME) {
      return CodeZoneManager.ZONE_TYPE.PROC_OPT;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.OPT_VALUE) {
      return CodeZoneManager.ZONE_TYPE.PROC_OPT_VALUE;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.SUB_OPT_NAME) {
      if (
        this._syntaxDb.isProcedureSubOptKeyword(
          this._procName,
          this._optName,
          this._subOptName
        )
      ) {
        return CodeZoneManager.ZONE_TYPE.PROC_SUB_OPT_NAME;
      }
    }
    return zone.type;
  }
  /*
   * e.g.
   * root stmt_name arglist argitem ...
   */
  private _context(
    root: any,
    stack: any[],
    obj?: { type?: string; argIndex?: number; value?: any }
  ): any {
    let i,
      len,
      found = false;
    if (!obj) {
      obj = { type: "root" };
    }
    obj.value = root;
    stack.push(obj);
    if (root instanceof Array) {
      //options
      i = 0;
      len = root.length;
      for (; i < len; i++) {
        found = this._context(root[i], stack, { type: "argitem", argIndex: i });
        if (found) {
          break;
        }
        stack.pop();
      }
    } else if (root instanceof Object) {
      //operation
      if (root.op2 !== undefined) {
        found = this._context(root.op1, stack, { type: "lvalue" });
        if (!found) {
          found = this._context(root.op, stack, { type: "operator" });
          if (!found) {
            found = this._context(root.op2, stack, { type: "rvalue" });
            if (!found) {
              stack.pop();
              stack.pop();
              stack.pop();
            }
          }
        }
      } else if (root.op1 !== undefined) {
        found = this._context(root.op, stack, { type: "obj" });
        if (!found) {
          found = this._context(root.op1, stack, { type: "arglist" });
          if (!found) {
            stack.pop();
            stack.pop();
          }
        }
      } else {
        if (root.pos >= 0) {
          found = true;
        }
      }
    }
    return found;
  }

  private _setOptName(node: {
    op: { text: string } | undefined;
    text: string;
    op2: any;
    op1: any;
  }) {
    if (node.op === undefined) {
      this._optName = node.text;
    } else if (node.op && node.op2 === undefined) {
      this._optName = node.op.text;
    } else {
      this._setOptName(node.op1);
    }
  }

  private _zone(stack: any[], context: Context): Zone {
    let type, text;

    // stack.length must be > 0
    const curr = stack[stack.length - 1].value;
    type = curr.zone;
    text = curr.text;
    this._optName = curr.text;
    this._subOptName = curr.text;

    // a
    // a=
    // a=b
    // a=b(...)

    const MAIN_OPT_INDEX = 3;

    if (stack.length > MAIN_OPT_INDEX) {
      this._setOptName(stack[MAIN_OPT_INDEX].value);
    }

    if (curr.pos !== 1) {
      this._subOptName = undefined as any; //NOTE: must be undefined for _syntaxDb query.
    }

    if (type === CodeZoneManager.ZONE_TYPE.OBJECT /* && text === 'STYLE'*/) {
      type = CodeZoneManager.ZONE_TYPE.OPT_NAME;
    }
    if (type === CodeZoneManager.ZONE_TYPE.SIMPLE_ITEM) {
      type = CodeZoneManager.ZONE_TYPE.OPT_VALUE; //!
    }
    // "nofcout(where=(substr(_var_,1,6)='Assign' and round(_value_) = 1)) as p " in 'create table ' statement
    // the 'and' keyword should be treated as speical.
    // maybe we should have another checking mechanism.
    if (!type && stack[stack.length - 1].type === "operator") {
      type = CodeZoneManager.ZONE_TYPE.SUB_OPT_NAME; //if we set SUB_OPT_NAME, the _procStmt will check whether it is an OPT_NAME
    }

    if (
      this._stmtName.match(/ODS TAGSETS.\w*/gi) ||
      (this._stmtName === "ODS" && this._optName.match(/TAGSETS.\w*/gi))
    ) {
      text = this._model.getLine(context.cursor.line);
      text = text.substring(0, context.cursor.col);
      if (text.match(/TAGSETS.\w*$/gi)) {
        type = CodeZoneManager.ZONE_TYPE.TAGSETS_NAME;
      } else if (
        text.match(/ods\s+\w+$/gi) ||
        (text.match(/((^\s*$)|(^\s*\w+$))/) &&
          type === CodeZoneManager.ZONE_TYPE.STMT_NAME) ||
        text.match(/ods\s+$/gi)
      ) {
        type = CodeZoneManager.ZONE_TYPE.ODS_STMT;
      }
    }

    if (this._stmtName[0] === "%") {
      if (
        type === CodeZoneManager.ZONE_TYPE.OPT_NAME ||
        type === CodeZoneManager.ZONE_TYPE.OPT_VALUE
      ) {
        type = CodeZoneManager.ZONE_TYPE.MACRO_STMT_BODY;
      }
    }

    return { type };
  }
  private _isCall(zone: any) {
    /*if (zone.callName && (zone.type === ZONE_TYPE.OPT_NAME || zone.type === ZONE_TYPE.OPT_VALUE)) {
          return true;
      }*/ // S1224156
    return false;
  }
  private _procStmt(context: Context, stmt: TokenWithPos) {
    let type;
    this._topZone = CodeZoneManager.ZONE_TYPE.PROC_STMT;
    this._getFullStmtName(context, this._procName, stmt);
    const zone = this._stmtEx(context, stmt);
    type = zone.type;
    if (this._isCall(zone)) {
      type = CodeZoneManager.ZONE_TYPE.RESTRICTED;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.STMT_NAME) {
      type = CodeZoneManager.ZONE_TYPE.PROC_STMT;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.OPT_NAME) {
      if (this._stmtName === "CALL" && /^CALL\b/.test(stmt.text)) {
        return this._callStmt(context);
      }
      type = CodeZoneManager.ZONE_TYPE.PROC_STMT_OPT;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.OPT_NAME_REQ) {
      type = CodeZoneManager.ZONE_TYPE.PROC_STMT_OPT_REQ;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.OPT_VALUE) {
      type = CodeZoneManager.ZONE_TYPE.PROC_STMT_OPT_VALUE;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.SUB_OPT_NAME) {
      const stmtWithDatasetOption = LexerEx.prototype.stmtWithDatasetOption_;
      if (stmtWithDatasetOption[this._procName + "/" + stmt.text]) {
        type = CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_NAME;
      } else if (
        this._syntaxDb.isProcedureStatementSubOptKeyword(
          this._procName,
          this._stmtName,
          this._optName,
          this._subOptName
        )
      ) {
        type = CodeZoneManager.ZONE_TYPE.PROC_STMT_SUB_OPT;
      } else if (
        this._syntaxDb.isProcedureStatementKeyword(
          this._procName,
          this._stmtName,
          this._subOptName
        )
      ) {
        type = CodeZoneManager.ZONE_TYPE.PROC_STMT_OPT;
      }
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.SUB_OPT_VALUE) {
      type = CodeZoneManager.ZONE_TYPE.PROC_STMT_SUB_OPT_VALUE;
    }
    return type;
  }
  private _stmtEx(context: Context, stmt: TokenWithPos) {
    const tokens = this._stmt(context, stmt),
      stack: any[] = [];
    this._context(tokens, stack);
    return this._zone(stack, context);
  }
  private _emit3(context: Context, tree: any, type: any) {
    this._traverse(tree, (i: { type: string }) => {
      if (Lexer.isWord[i.type] || i.type === "text") {
        this._emit(i, type);
      }
    });
  }
  private _if(context: Context, stmt: { text: string }, type: number) {
    const opts = [];
    let expr = this._expr(context),
      token,
      token2;

    token = this._getNextEx(context);
    if (token.text === "IN") {
      //special case IN operator, because we ignore IN always in _expr
      expr = { op: token, op1: expr, op2: this._expr(context) };
      token = this._getNextEx(context);
    }
    this._emit3(context, expr, type);
    opts.push(expr);

    this._emit(token, type);
    if (
      (token.text === "THEN" &&
        type === CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT) ||
      (token.text === "%THEN" &&
        type === CodeZoneManager.ZONE_TYPE.MACRO_STMT_OPT)
    ) {
      token2 = this._getNextEx(context);
      //adjust statement name
      opts.push({ op: token, op1: this._stmt(context, token2) });
      if (token.pos >= 0) {
        this._stmtName = stmt.text;
      }
    } else {
      opts.push(token);
    }
    return { op: stmt, op1: opts };
  }

  private _where(context: Context, stmt: TokenWithPos) {
    return { op: stmt, op1: this._expr(context) };
  }

  private _style(context: Context, stmt: TokenWithPos) {
    const ret: any = { op: stmt },
      styleElemNames = [];
    let from = null,
      existing,
      op1,
      token;
    /*
        STYLE style-element-name(s)
        <FROM existing-style-element-name | _SELF_ ><"text">
        </ style-attribute-specification(s)>;
        style-attribute-specification(s):
        style-attribute-name=<|>style-attribute-value
         */
    // style element names
    do {
      token = this._getNextEx(context);
      this._emit(token, CodeZoneManager.ZONE_TYPE.STYLE_ELEMENT);
      styleElemNames.push(token);
      token = this._getNextEx(context);
    } while (token.text === ",");
    //ret['op1'] = styleElemNames;

    if (token.text === "FROM") {
      from = token;
      //this._emit(token, "from"); //TODO: ??
      existing = this._getNextEx(context);
      //this._emit(existing, "existing"); //TODO: ??
      //ret['op1'] = {'op':token, 'op1': styleElemNames, 'op2':_getNextEx(context)};
      token = this._getNextEx(context);
      if (token.text === '"text"' || token.text === "'text'") {
        //this._emit(token, "text"); //TODO: ??
        token = this._getNextEx(context); //ignore
      }
    }
    if (token.text === "/") {
      if (from) {
        op1 = { op: from, op1: styleElemNames, op2: existing };
      } else {
        op1 = styleElemNames;
      }
      this._emit1(
        token,
        CodeZoneManager.ZONE_TYPE.RESTRICTED,
        CodeZoneManager.ZONE_TYPE.STYLE_ATTR
      );
      ret["op1"] = {
        op: token,
        op1: op1,
        op2: this._stmtOptions(
          context,
          null,
          CodeZoneManager.ZONE_TYPE.STYLE_ATTR,
          CodeZoneManager.ZONE_TYPE.RESTRICTED
        ),
      };
    } else {
      ret["op1"] = styleElemNames;
    }
    return ret;
  }
  private _ods(context: Context, stmt: TokenWithPos) {
    let nameType, optType;
    this._getFullStmtName(context, "ODS", stmt);
    this._stmtName = stmt.text.toUpperCase();
    this._emit(stmt, CodeZoneManager.ZONE_TYPE.ODS_STMT);
    if (this._stmtName === "ODS") {
      nameType = CodeZoneManager.ZONE_TYPE.RESTRICTED;
      optType = CodeZoneManager.ZONE_TYPE.RESTRICTED;
    } else {
      nameType = CodeZoneManager.ZONE_TYPE.ODS_STMT_OPT;
      optType = CodeZoneManager.ZONE_TYPE.ODS_STMT_OPT_VALUE;
    }
    const opts = this._stmtOptions(context, stmt, nameType, optType);
    const opt = this._firstToken(opts);
    if (this._stmtName === "ODS" && opt.pos >= 0) {
      this._emit(opt, CodeZoneManager.ZONE_TYPE.ODS_STMT);
    }
    return { op: stmt, op1: opts };
  }
  private _traverse(
    top: {
      forEach: (arg0: (i: any) => void) => void;
      op: any;
      op2: any;
      op1: any;
    },
    cb: { (i: any): void }
  ) {
    if (top instanceof Array) {
      top.forEach((i) => {
        this._traverse(i, cb);
      });
    } else if (top.op === undefined) {
      cb(top);
    } else if (top.op2 === undefined) {
      this._traverse(top.op, cb);
      this._traverse(top.op1, cb);
    } else {
      this._traverse(top.op1, cb);
      this._traverse(top.op, cb);
      this._traverse(top.op2, cb);
    }
  }
  private _firstToken(opt: any): any {
    if (opt instanceof Array) {
      return this._firstToken(opt[0]);
    } else if (opt.op === undefined) {
      return opt;
    } else if (opt.op2 === undefined) {
      return this._firstToken(opt.op);
    } else {
      return this._firstToken(opt.op1);
    }
  }
  private _isNormalStmt(stmt: { text: string }) {
    //TODO: we should improve this when we get enough information about SAS language
    const _normalStmts: Record<string, 1> = {
      SELECT: 1,
    };
    return _normalStmts[stmt.text];
  }
  private _checkFuncType(token: { text: string }) {
    return token.text[0] === "%"
      ? CodeZoneManager.ZONE_TYPE.MACRO_FUNC
      : this._syntaxDb.isSasFunction(token.text)
      ? CodeZoneManager.ZONE_TYPE.SAS_FUNC
      : CodeZoneManager.ZONE_TYPE.OBJECT;
  }
  private _stmt(context: Context, stmt: { text: string }) {
    const ret = this._tryGetOpr(context);
    let token;
    if (ret.token.text === "/") {
      this._copyContext(ret.context, context); //ignore '/'
    } else if (Lexer.isBinaryOpr[ret.token.text]) {
      //This statement is only a expression.
      this._copyContext(ret.context, context);
      if (!this._isNormalStmt(stmt)) {
        //S1224156
        this._emit(stmt, CodeZoneManager.ZONE_TYPE.SIMPLE_ITEM);
        this._stmtName = stmt.text;
        return { op: ret.token, op1: stmt, op2: this._expr(context) };
      }
    }
    this._emit(stmt, CodeZoneManager.ZONE_TYPE.STMT_NAME);
    this._stmtName = stmt.text;
    if (this._specialStmt[this._stmtName]) {
      return this._specialStmt[this._stmtName].call(
        this,
        context,
        stmt,
        CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT
      );
    } else if (this._needOptionDelimiter()) {
      token = ret.token;
      if (token.text === "/") {
        this._emit1(
          token,
          CodeZoneManager.ZONE_TYPE.OPT_NAME_REQ,
          CodeZoneManager.ZONE_TYPE.OPT_NAME
        );
        return {
          op: stmt,
          op1: [token].concat(
            this._stmtOptions(
              context,
              stmt,
              CodeZoneManager.ZONE_TYPE.OPT_NAME
            ) as any
          ),
        };
      }
    }
    return { op: stmt, op1: this._stmtOptions(context, stmt) };
  }
  private _startScope(context: Context, scope: number, obj?: any) {
    if (!context.scopes) {
      context.scopes = [];
    }
    context.scopes.push({ t: scope, o: obj });
  }
  private _endScope(context: Context) {
    context.scopes.pop();
  }
  private _styleOptionAllowed() {
    if (
      this._procName === "PRINT" ||
      this._procName === "REPORT"
      /*|| _stmtName.match(/^ODS/gi)*/
    ) {
      return true;
    }
    return false;
  }
  /* list is array
   * e.g. : (a=b,b=c,d=e)
   * e.g. : stmtname a1 b(c=d e(f=g h=i)=j(k=l m=n))=o(p=q r(s=t u=v) w(x=y aa)=bb(cc=dd ee=ff));
   */
  private _emitArgList(list: any[], ltype: number, rtype: number) {
    let i = 1;
    const count = list.length - 1;
    if (list[0].pos === 0) {
      this._emit(list[0], ltype);
    }
    if (list[count].pos >= 2) {
      this._emit(list[count], ltype);
    }
    for (; i < count; i++) {
      if (list[i].op === undefined) {
        //only a token, no value
        this._emit(list[i], ltype);
      } else if (list[i].op2 === undefined) {
        //complicated, call or config
        this._emit(list[i].op, ltype);
      } else {
        //with value
        if (list[i].op1.op1 instanceof Array) {
          this._emit(list[i].op1.op, ltype); // e(f=g h=i)=j(k=l m=n), ignore the nested
        } else {
          this._emit(list[i].op1, ltype);
        }
        this._emit1(list[i].op, ltype, rtype);
        if (list[i].op2.op1 instanceof Array) {
          this._emit(list[i].op2.op, rtype);
        } else {
          if (list[i].op1.text && list[i].op1.text.match(/color/gi)) {
            rtype = CodeZoneManager.ZONE_TYPE.COLOR;
          }
          this._emit(list[i].op2, rtype);
        }
      }
    }
  }
  /*
   * e.g.:
   * (1) a
   * (2) (a=b,b=c,d=e)
   * (3) a(a=b,b=c,d=e)
   */
  private _emitTree(context: Context, expr: any, type?: any) {
    let subOpts;
    if (!context.scopes || context.scopes.length <= 0) {
      return;
    }
    const deep = context.scopes.length;
    const opt = context.scopes[0];
    const curr = context.scopes[deep - 1];
    if (
      (opt.o && opt.o.text === "STYLE") ||
      (opt.o && opt.o.op && opt.o.op.text === "STYLE")
    ) {
      // special for style
      if (!this._styleOptionAllowed()) {
        return;
      }
      if (curr.t === CodeZoneManager.ZONE_TYPE.OPT_ITEM) {
        if (expr.op1) {
          //having options
          this._emit(expr.op, type);
          if (expr.op1 instanceof Array) {
            this._emitArgList(
              expr.op1,
              CodeZoneManager.ZONE_TYPE.STYLE_LOC,
              CodeZoneManager.ZONE_TYPE.RESTRICTED
            );
          }
        } else {
          this._emit(expr, type);
        }
      } else if (curr.t === CodeZoneManager.ZONE_TYPE.OPT_VALUE) {
        if (expr.op1 || expr instanceof Array) {
          if (expr.op1) {
            subOpts = expr.op1;
            this._emit(expr.op, CodeZoneManager.ZONE_TYPE.STYLE_ELEMENT);
          } else {
            subOpts = expr;
          }
          if (subOpts instanceof Array) {
            this._emitArgList(
              subOpts,
              CodeZoneManager.ZONE_TYPE.STYLE_ATTR,
              CodeZoneManager.ZONE_TYPE.RESTRICTED
            );
          }
        } else {
          this._emit(expr, CodeZoneManager.ZONE_TYPE.STYLE_ELEMENT);
        }
      }
    } else if (this._stmtName === "DATA" && opt.o) {
      if (curr.t === CodeZoneManager.ZONE_TYPE.OPT_ITEM) {
        if (expr.op === undefined) {
          this._emit(expr, CodeZoneManager.ZONE_TYPE.DATA_STEP_OPT_NAME);
        }
      } else if (curr.t === CodeZoneManager.ZONE_TYPE.OPT_VALUE) {
        if (opt.o.text === "VIEW" || opt.o.text === "PGM") {
          if (expr.op) {
            this._emit(expr.op, CodeZoneManager.ZONE_TYPE.VIEW_OR_PGM_NAME);
            if (expr.op1 instanceof Array) {
              this._emitArgList(
                expr.op1,
                CodeZoneManager.ZONE_TYPE.VIEW_OR_PGM_OPT_NAME,
                CodeZoneManager.ZONE_TYPE.VIEW_OR_PGM_OPT_VALUE
              );
            }
          } else {
            this._emit(expr, CodeZoneManager.ZONE_TYPE.VIEW_OR_PGM_NAME);
          }
        } else {
          if (expr.op === undefined) {
            this._emit(expr, CodeZoneManager.ZONE_TYPE.DATA_STEP_OPT_VALUE);
          }
        }
      }
    } else if (opt.o && opt.o.text && opt.o.text.match(/color/gi)) {
      if (
        curr.t === CodeZoneManager.ZONE_TYPE.OPT_VALUE &&
        expr instanceof Array
      ) {
        this._emitArgList(
          expr,
          CodeZoneManager.ZONE_TYPE.COLOR,
          CodeZoneManager.ZONE_TYPE.RESTRICTED
        );
      }
    } else if (expr.op1 instanceof Array) {
      this._emitArgList(
        expr.op1,
        CodeZoneManager.ZONE_TYPE.SUB_OPT_NAME,
        CodeZoneManager.ZONE_TYPE.SUB_OPT_VALUE
      );
    }
  }
  private _stmtOptions(
    context: Context,
    stmt: any,
    nameType?: number,
    valType?: number
  ) {
    let name: any,
      next: any,
      tmpContext,
      val,
      exit = false;
    const opts = [];

    if (!nameType) {
      nameType = this._needOptionDelimiter()
        ? CodeZoneManager.ZONE_TYPE.OPT_NAME_REQ
        : CodeZoneManager.ZONE_TYPE.OPT_NAME;
    }
    if (!valType) {
      valType = CodeZoneManager.ZONE_TYPE.OPT_VALUE;
    }
    for (;;) {
      // option name
      tmpContext = this._cloneContext(context);
      name = this._getNextEx(tmpContext);
      if (name.text === "") {
        this._emit(name, nameType);
        opts.push(name);
        exit = true;
      } else if (name.text === ";") {
        if (name.pos >= 2) {
          this._emit(name, nameType);
        }
        opts.push(name);
        exit = true;
      } else {
        if (
          nameType === CodeZoneManager.ZONE_TYPE.OPT_NAME_REQ &&
          name.text === "/"
        ) {
          nameType = CodeZoneManager.ZONE_TYPE.OPT_NAME;
        }
        this._emit(name, nameType);
        this._copyContext(tmpContext, context);
        tmpContext = this._cloneContext(context);
        next = this._getNextEx(tmpContext);
        if (name.text === "(" || next.text === "(") {
          this._emit(name, this._checkFuncType(name));
          name = { op: name, op1: this._argList(context, name) };
          tmpContext = this._cloneContext(context);
          next = this._getNextEx(tmpContext);
        }
      }
      this._startScope(context, CodeZoneManager.ZONE_TYPE.OPT_ITEM, name);
      this._emitTree(context, name, nameType);
      if (exit) {
        this._endScope(context);
        break;
      }
      switch (next.text) {
        case "{":
          break; // TODO:
        case "=":
          this._emit1(next, nameType, valType);
          this._copyContext(tmpContext, context);
          this._startScope(context, CodeZoneManager.ZONE_TYPE.OPT_VALUE);
          if (
            name.text === "DATA" ||
            this._isDatasetOpt(name.op === undefined ? name.text : name.op.text)
          ) {
            val = this._dsExpr(context);
          } else {
            val = this._expr(context, {}, true);
          }
          // The first part after '=' is always treated as option value
          if (val.type) {
            //TODO: need to be improved
            this._emit(val, valType);
          } else if (
            val.op &&
            val.op.zone === CodeZoneManager.ZONE_TYPE.OBJECT
          ) {
            // FIXID S1271196
            val.op.zone = valType; // Not use _emit, we force to set valType
          }
          this._emitTree(context, val);
          opts.push({ op: next, op1: name, op2: val });
          this._endScope(context);
          break;
        default: {
          opts.push(name);
        }
      }
      this._endScope(context);
    }
    return opts;
  }
  private _dsExpr(context: Context) {
    const token1 = this._getNextEx(context),
      tmpContext = this._cloneContext(context),
      token2 = this._getNextEx(tmpContext);
    if (token2.text === "(") {
      this._emit(token1, CodeZoneManager.ZONE_TYPE.OBJECT);
      return { op: token1, op1: this._datasetOptions(context) };
    } else {
      this._emit(token1, CodeZoneManager.ZONE_TYPE.OPT_VALUE);
      return token1;
    }
  }
  private _argList(
    context: Context,
    obj?: any,
    nameType?: number,
    valType?: number
  ) {
    let token = this._getNextEx(context),
      tmpContext = null,
      lopd,
      exit = false,
      val;
    const items = [],
      marks: Record<string, string> = { "(": ")", "[": "]", "{": "}" },
      lmark = token.text,
      rmark = marks[lmark],
      ends: Record<string, 1> = {};

    if (!nameType) {
      nameType = CodeZoneManager.ZONE_TYPE.SUB_OPT_NAME;
    }
    if (!valType) {
      valType = CodeZoneManager.ZONE_TYPE.SUB_OPT_VALUE;
    }
    ends[rmark] = 1;
    this._emit1(
      token,
      obj ? obj.zone : CodeZoneManager.ZONE_TYPE.RESTRICTED,
      nameType
    );
    this._startScope(context, CodeZoneManager.ZONE_TYPE.ARG_LIST, obj);
    items.push(token);
    do {
      lopd = this._expr(context, ends); //complex expression
      if (lopd.op === undefined) {
        //token
        this._emit(lopd, nameType);
      } else if (lopd.op.text === "=") {
        if (lopd.op1.op === undefined) {
          this._emit(lopd.op1, nameType);
        }
        this._emit1(lopd.op, nameType, valType);
        if (lopd.op2.op === undefined) {
          this._emit(lopd.op2, valType);
        }
      }
      //tmpContext = _cloneContext(context);
      //lopd = _getNextEx(tmpContext);//simple name
      //_emit(lopd, nameType);
      exit = true;
      switch (lopd.text) {
        case rmark:
          if (lopd.pos < 2) {
            this._emit(lopd, CodeZoneManager.ZONE_TYPE.RESTRICTED);
          }
          this._copyContext(tmpContext, context);
          break;
        case ";":
          if (lopd.pos < 2) {
            this._emit(lopd, CodeZoneManager.ZONE_TYPE.RESTRICTED);
          }
          break;
        case "":
          break;
        default: {
          exit = false;
        }
      }
      if (exit) {
        items.push(lopd);
        break;
      }

      //_copyContext(tmpContext, context);
      tmpContext = this._cloneContext(context);
      token = this._getNextEx(tmpContext);
      switch (token.text) {
        case "":
          this._emit(token, nameType);
          items.push(lopd, token); // the '' token
          exit = true;
          break;
        case ";":
          if (token.pos >= 2) {
            this._emit(token, nameType);
          }
          items.push(lopd, token);
          exit = true;
          break;
        case rmark:
          this._emit1(token, nameType, CodeZoneManager.ZONE_TYPE.RESTRICTED);
          items.push(lopd, token);
          this._copyContext(tmpContext, context);
          exit = true;
          break;
        case "=":
          this._copyContext(tmpContext, context);
          this._emit1(token, nameType, valType);
          val = this._expr(context);
          if (val.op === undefined) {
            this._emit(val, valType);
          }
          items.push({
            op: token,
            op1: lopd,
            op2: val,
          });
          break;
        case ",":
          items.push(lopd);
          this._copyContext(tmpContext, context);
          break;
        default:
          items.push(lopd);
      }
    } while (!exit);
    this._endScope(context);
    return items;
  }
  private _tryGetOpr(context: Context) {
    const tmpContext = this._cloneContext(context),
      token = this._getNextEx(tmpContext);

    return { token: token, context: tmpContext };
  }

  private _expr(
    context: Context,
    ends?: Record<string, 1>,
    one?: boolean
  ): any {
    let text,
      ret,
      item = null;
    const tmpContext = this._cloneContext(context);
    //e.g.: left(symget('dmktdesopts'));
    const token1 = this._getNextEx(tmpContext);
    if (ends && ends[token1.text]) {
      return this._dummyToken;
    } else if (_isScopeBeginMark[token1.text]) {
      //item = {'op': token1,'op1':_argList(context,null)};// complicated expression
      item = this._argList(context, null);
      //return item; //not return
    } else if (Lexer.isUnaryOpr[token1.text]) {
      this._copyContext(tmpContext, context);
      item = { op: token1, op1: this._expr(context, ends, true) }; //not return
    } else {
      item = token1;
      this._emit(
        token1,
        token1.text[0] === "%"
          ? CodeZoneManager.ZONE_TYPE.MACRO_FUNC
          : CodeZoneManager.ZONE_TYPE.SIMPLE_ITEM
      );
      this._copyContext(tmpContext, context);
    }
    for (;;) {
      ret = this._tryGetOpr(context);
      text = ret.token.text;
      if (Lexer.isBinaryOpr[text] && !one /*|| SasLexer.isUnaryOpr[text]*/) {
        //ATTENTION: not concern the priority
        this._copyContext(ret.context, context);
        item = { op: ret.token, op1: item, op2: this._expr(context, ends) };
      } else if (_isScopeBeginMark[text]) {
        this._emit(token1, this._checkFuncType(token1)); //call or config
        item = { op: token1, op1: this._argList(context, token1) };
      } else {
        return item;
      }
    }
  }
  //function _func(context,name) {
  //TODO:
  //}
  private _dataSec(context: Context) {
    let token = null,
      text = null,
      inBlock = false;
    this._skipToStmtStart(context, true);
    token = this._getNextEx(context);

    if (Lexer.isWord[token.type]) {
      text = token.text.toUpperCase();
      if (token.pos >= 0) {
        inBlock = this._inBlock(context.block, token)! >= 0;
        if (
          (inBlock && text !== "DATA") ||
          (!inBlock && //not in block
            !this._endedReally(context.block))
        ) {
          //not really end the last block
          this._procName = this._blockName(context.block);
          if (text[0] === "%") {
            return CodeZoneManager.ZONE_TYPE.MACRO_STMT;
          } else {
            return CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT;
          }
        } else {
          return CodeZoneManager.ZONE_TYPE.GBL_STMT;
        }
      } else {
        this._stmtName = text;
        switch (text) {
          case "PROC":
          case "PROCEDURE":
            return this._procDef(context);
          case "DATA":
            return this._dataDef(context, token);
          //case '%SYSCALL':
          //case 'CALL': return _callStmt(context);
          case "SET":
          case "MERGE":
          case "MODIFY":
          case "UPDATE":
            return this._setStmt(context, token);
          default:
            return this._dataStmt(context, token);
        }
      }
    } else {
      return this._dataStmt(context, token);
    }
  }
  private _dataDef(context: Context, stmt: TokenWithPos) {
    let token1, token2, tmpContext, viewOrPrg: any, name;
    const opts = [],
      stack: any[] = [];

    this._topZone = CodeZoneManager.ZONE_TYPE.DATA_STEP_DEF;
    token1 = this._getNextEx(context);
    tmpContext = this._cloneContext(context);
    token2 = this._getNextEx(tmpContext);
    if (Lexer.isWord[token1.type] || token1.type === "string") {
      switch (token2.text) {
        case "/": //data step option
          this._emit(
            token1,
            token1.text === "_NULL_"
              ? CodeZoneManager.ZONE_TYPE.DATA_STEP_DEF_OPT
              : CodeZoneManager.ZONE_TYPE.DATA_SET_NAME
          );
          this._emit1(
            token2,
            CodeZoneManager.ZONE_TYPE.DATA_SET_NAME,
            CodeZoneManager.ZONE_TYPE.DATA_STEP_OPT_NAME
          );
          this._copyContext(tmpContext, context);
          opts.push(token1, token2, this._datastepOptions(context));
          break;
        case "=": // view name or program name
          this._emit(token1, CodeZoneManager.ZONE_TYPE.DATA_STEP_DEF_OPT);
          this._emit1(
            token2,
            CodeZoneManager.ZONE_TYPE.DATA_STEP_DEF_OPT,
            CodeZoneManager.ZONE_TYPE.VIEW_OR_PGM_NAME
          );
          name = token1.text;
          viewOrPrg = { op: token2, op1: token1 };
          opts.push(viewOrPrg);
          this._copyContext(tmpContext, context);
          token1 = this._getNextEx(context); // view name or program name
          viewOrPrg["op2"] = token1;
          if (Lexer.isWord[token1.type]) {
            this._emit(token1, CodeZoneManager.ZONE_TYPE.VIEW_OR_PGM_NAME);
            tmpContext = this._cloneContext(context);
            token2 = this._getNextEx(tmpContext);
            if (token2.text === "(") {
              this._emit(token1, CodeZoneManager.ZONE_TYPE.OBJECT);
              viewOrPrg["op2"] = {
                op: token1,
                op1: this._argList(
                  context,
                  token1,
                  CodeZoneManager.ZONE_TYPE.VIEW_OR_PGM_OPT_NAME,
                  CodeZoneManager.ZONE_TYPE.VIEW_OR_PGM_OPT_VALUE
                ),
              };
              token2 = this._getNextEx(context);
            }
            if (
              (token2.text === ";" || Lexer.isWord[token2.type]) &&
              (name === "VIEW" || name === "PGM")
            ) {
              this._emit(
                token2,
                CodeZoneManager.ZONE_TYPE.VIEW_OR_PGM_SUB_OPT_NAME
              ); //NOLIST
              opts.push(token2);
            }
          }
          break;
        case "":
          this._emit(token1, CodeZoneManager.ZONE_TYPE.DATA_STEP_DEF_OPT);
          opts.push(token1);
          break;
        default: {
          for (;;) {
            this._emit(
              token1,
              token1.text === "_NULL_"
                ? CodeZoneManager.ZONE_TYPE.DATA_STEP_DEF_OPT
                : CodeZoneManager.ZONE_TYPE.VIEW_OR_DATA_SET_NAME
            );
            if (token2.text === "(") {
              // data set option
              this._emit(token1, CodeZoneManager.ZONE_TYPE.DATA_SET_NAME);
              opts.push({ op: token1, op1: this._datasetOptions(context) });
            } else {
              opts.push(token1);
            }
            token1 = this._getNextEx(context);
            tmpContext = this._cloneContext(context);
            token2 = this._getNextEx(tmpContext);
            if (token1.text === "") {
              this._emit(
                token1,
                CodeZoneManager.ZONE_TYPE.VIEW_OR_DATA_SET_NAME
              );
              opts.push(token1);
              break;
            } else if (token1.text === "/") {
              this._emit1(
                token1,
                CodeZoneManager.ZONE_TYPE.VIEW_OR_DATA_SET_NAME,
                CodeZoneManager.ZONE_TYPE.DATA_STEP_OPT_NAME
              );
              opts.push(token1, this._datastepOptions(context));
              break;
            } else if (token1.text === ";") {
              break;
            }
          }
        }
      }
    } else if (token1.text === "/") {
      this._emit1(
        token1,
        CodeZoneManager.ZONE_TYPE.STMT_NAME,
        CodeZoneManager.ZONE_TYPE.DATA_STEP_OPT_NAME
      );
      opts.push(token1, this._datastepOptions(context));
    } else {
      // error
    }

    this._context({ op: "DATA", op1: opts }, stack);
    const zone = this._zone(stack, context);
    return zone.type;
  }
  //only for debug
  //function _getZoneName(zone) {
  //    for(var attr in ZONE_TYPE) {
  //        if (ZONE_TYPE.hasOwnProperty(attr)) {
  //            if (ZONE_TYPE[attr] === zone) {
  //                return attr;
  //            }
  //        }
  //    }
  //}
  private _datasetOptions(context: Context) {
    let token1 = this._getNextEx(context),
      equal,
      tmpContext,
      optVal,
      simpleVal,
      moreVals = [];
    const opts = []; // ignore '('
    this._emit1(
      token1,
      CodeZoneManager.ZONE_TYPE.VIEW_OR_DATA_SET_NAME,
      CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_NAME
    );
    opts.push(token1);
    for (;;) {
      tmpContext = this._cloneContext(context);
      token1 = this._getNextEx(tmpContext); //optiona name
      this._emit(token1, CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_NAME);
      switch (token1.text) {
        case "":
        case ";":
          opts.push(token1);
          return opts;
        case ")":
          this._emit1(
            token1,
            CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_NAME,
            CodeZoneManager.ZONE_TYPE.RESTRICTED
          );
          opts.push(token1);
          this._copyContext(tmpContext, context);
          return opts;
        default:
          if (Lexer.isWord[token1.type] === undefined) {
            return opts;
          }
      }
      this._copyContext(tmpContext, context);
      //tmpContext = _cloneContext(context);
      equal = this._getNextEx(tmpContext);

      if (equal.text !== "=") {
        opts.push(token1);
        continue;
      }
      this._copyContext(tmpContext, context);
      this._emit1(
        equal,
        CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_NAME,
        CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_VALUE
      );

      switch (token1.text) {
        case "INDEX":
        case "RENAME":
        case "WHERE":
          //token2 = _getNextEx(tmpContext);
          //if (token2.text === '(') {
          //    optVal = _argList(context, token1);
          //}
          optVal = this._expr(context);
          break;
        case "SORTEDBY":
          optVal = this._expr(context);
          if (optVal.op === undefined) {
            this._emit(optVal, CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_VALUE);
          }
          break;
        default: {
          //optVal = _getNextEx(context);
          optVal = this._expr(context);
          simpleVal = this._firstToken(optVal);
          if (simpleVal.pos >= 0) {
            this._emit(simpleVal, CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_VALUE);
          }
          if (token1.text === "DROP" || token1.text === "KEEP") {
            moreVals = this._tryGetMoreVals(
              context,
              CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_VALUE
            );
            if (moreVals.length) {
              optVal = [optVal].concat(moreVals);
            }
          }
        }
      }
      opts.push({ op: equal, op1: token1, op2: optVal });
      if (optVal.text === ")") {
        break;
      }
    }
    return opts;
  }
  private _tryGetMoreVals(context: Context, emitType: number) {
    let token1, tmpContext2, token2;
    const tmpContext1 = this._cloneContext(context),
      vals = [],
      notExpected = /[/);]/;
    for (;;) {
      token1 = this._getNextEx(tmpContext1);
      tmpContext2 = this._cloneContext(tmpContext1);
      token2 = this._getNextEx(tmpContext2);
      if (
        token2.text === "=" ||
        notExpected.test(token1.text) ||
        token1.text === ""
      ) {
        return vals;
      } else {
        this._emit(token1, emitType);
        vals.push(token1);
        this._copyContext(tmpContext1, context);
      }
    }
  }
  private _datastepOptions(context: Context) {
    return this._stmtOptions(
      context,
      null,
      CodeZoneManager.ZONE_TYPE.DATA_STEP_OPT_NAME,
      CodeZoneManager.ZONE_TYPE.DATA_STEP_OPT_VALUE
    );
  }
  private _dataStmt(context: Context, stmt: TokenWithPos) {
    let token = null,
      text = null;
    const newContext = {
      block: context.block,
      line: context.cursor.line,
      col: context.cursor.col,
      syntaxIdx: -1,
      cursor: context.cursor,
    };
    this._topZone = CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT;
    this._stmtName = stmt.text.toUpperCase();
    //special for call statement, and ignore others currently
    token = this._getPrev(newContext); // current
    text = token!.text.toUpperCase();
    if (
      (this._stmtName === "IF" || this._stmtName === "CALL") &&
      /^CALL\b/.test(text)
    ) {
      return this._callStmt(newContext);
    }
    const zone = this._stmtEx(context, stmt);
    if (this._isCall(zone)) {
      return CodeZoneManager.ZONE_TYPE.RESTRICTED;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.STMT_NAME) {
      return CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.OPT_NAME) {
      return CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT;
    } else if (zone.type === CodeZoneManager.ZONE_TYPE.OPT_VALUE) {
      return CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT_VALUE;
    }
    return zone.type;
  }
  private _callStmt(context: Context) {
    return CodeZoneManager.ZONE_TYPE.CALL_ROUTINE;
  }
  private _setStmt(context: Context, stmt: TokenWithPos) {
    let item,
      next,
      tmpContext,
      allowOption = false,
      exit = false;
    const opts = [],
      stack: any[] = [];

    this._stmtName = stmt.text;
    do {
      item = this._getNextEx(context);
      if (item.text === "") {
        //if (!allowOption) _emit(item, ZONE_TYPE.RESTRICTED);
        //else {
        this._emit(item, CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT);
        //}
        exit = true;
      } else if (item.text === ";") {
        if (item.pos >= 2 && allowOption) {
          this._emit(item, CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT);
        }
        exit = true;
      } else if (Lexer.isWord[item.type]) {
        tmpContext = this._cloneContext(context);
        next = this._getNextEx(tmpContext);
        if (next.text === "(") {
          //data set options
          item = { op: item, op1: this._datasetOptions(context) };
        } else if (next.text === "=") {
          //set options
          this._emit(item, CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT);
          this._emit1(
            next,
            CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT,
            CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT_VALUE
          );
          this._copyContext(tmpContext, context);
          item = { op: next, op1: item, op2: this._expr(context) };
        } else {
          this._emit(item, CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT);
        }
        allowOption = true;
      }
      opts.push(item);
    } while (!exit);
    this._context({ op: stmt, op1: opts }, stack);
    const zone = this._zone(stack, context);
    if (zone.type === CodeZoneManager.ZONE_TYPE.OPT_VALUE) {
      zone.type = CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT_VALUE;
    } else if (zone.type === undefined) {
      // dataset
      zone.type = CodeZoneManager.ZONE_TYPE.DATA_STEP_STMT_OPT;
    }
    return zone.type;
  }
  private _macroSec(context: Context) {
    let token = null,
      text = null,
      embeddedBlock = null;
    this._skipToStmtStart(context, true);
    token = this._getNextEx(context);
    this._stmtName = token.text;
    if (Lexer.isWord[token.type]) {
      text = token.text;
      if (token.pos >= 0) {
        if (this._inBlock(context.block, token)! >= 0) {
          // in block
          embeddedBlock = this._embeddedBlock(context.block, {
            line: token.line,
            col: token.col - 1,
          });
          if (embeddedBlock) {
            context.block = embeddedBlock;
            context.line = context.cursor.line;
            context.col = context.cursor.col - 1;
            if (embeddedBlock.type === SEC_TYPE.PROC) {
              return this._procSec(context);
            } else {
              return this._dataSec(context);
            }
          }
        }
        if (text[0] === "%") {
          return CodeZoneManager.ZONE_TYPE.MACRO_STMT;
        } else {
          return CodeZoneManager.ZONE_TYPE.GBL_STMT;
        }
      } else {
        switch (text) {
          case "%MACRO":
            return this._macroDef(context);
          case "PROC":
            return this._procDef(context);
          case "DATA":
            return this._dataDef(context, token);
          default: {
            embeddedBlock = this._embeddedBlock(context.block, {
              line: token.line,
              col: token.col - 1,
            });
            if (embeddedBlock) {
              context.block = embeddedBlock;
              context.line = context.cursor.line;
              context.col = context.cursor.col - 1;
              if (embeddedBlock.type === SEC_TYPE.PROC) {
                return this._procSec(context);
              } else {
                return this._dataSec(context);
              }
            } else {
              return this._macroStmt(context, token);
            }
          }
        }
      }
    } else {
      return this._macroStmt(context, token);
    }
  }
  private _macroDef(context: Context) {
    let token;
    const name = this._getNextEx(context),
      opts = [],
      stack: any[] = [];

    this._emit(name, CodeZoneManager.ZONE_TYPE.RESTRICTED); // macro name

    const tmpContext = this._cloneContext(context);
    token = this._getNextEx(tmpContext);
    if (token.text === "(") {
      opts.push({ op: name, op1: this._argList(context) });
      token = this._getNextEx(context);
    } else {
      this._copyContext(tmpContext, context);
      opts.push(name);
    }
    if (token.text === "/") {
      this._emit1(
        token,
        CodeZoneManager.ZONE_TYPE.RESTRICTED,
        CodeZoneManager.ZONE_TYPE.MACRO_DEF_OPT
      );
      opts.push(
        token,
        this._stmtOptions(
          context,
          null,
          CodeZoneManager.ZONE_TYPE.MACRO_DEF_OPT,
          CodeZoneManager.ZONE_TYPE.RESTRICTED
        )
      );
    }
    this._context({ op: "%MACRO", op1: opts }, stack);
    const zone = this._zone(stack, context);
    return zone.type;
  }
  private _macroStmt(context: Context, stmt: TokenWithPos) {
    let tokens, zone, name;
    const embeddedBlock = this._embeddedBlock(context.block, context.cursor),
      stack: any[] = [];

    if (embeddedBlock) {
      if (this._isStatgraph(context.block, context.cursor, stmt.text)) {
        this._procName = "STATGRAPH";
      } else {
        this._procName = this._blockName(context.block);
      }
      return this._procStmt(context, stmt);
    } else if (stmt.text[0] === "%") {
      name = stmt.text.substring(1);
      if (this._specialStmt[name]) {
        tokens = this._specialStmt[name].call(
          this,
          context,
          stmt,
          CodeZoneManager.ZONE_TYPE.MACRO_STMT_OPT
        );
      } else if (
        this._stmtName === "%SYSCALL" &&
        /^%SYSCALL\b/.test(stmt.text)
      ) {
        return this._callStmt(context);
      } else {
        const tmpContext = this._cloneContext(context);
        const next = this._getNextEx(tmpContext);
        if (next.text === "%WHILE" || next.text === "%UNTIL") {
          //adjust statement name
          //_stmtName += " ";
          //_stmtName += next.text;
          this._stmtName = next.text;
          this._copyContext(tmpContext, context);
          tokens = { op: next, op1: this._expr(context) }; //ignore %do
          this._emit(next, CodeZoneManager.ZONE_TYPE.MACRO_STMT);
        } else {
          tokens = {
            op: stmt,
            op1: this._stmtOptions(
              context,
              null,
              CodeZoneManager.ZONE_TYPE.MACRO_STMT_OPT,
              CodeZoneManager.ZONE_TYPE.MACRO_STMT_OPT_VALUE
            ),
          };
        }
      }
      this._context(tokens, stack);
      zone = this._zone(stack, context);
      if (zone.type === CodeZoneManager.ZONE_TYPE.STMT_NAME) {
        return this._stmtName[0] === "%"
          ? CodeZoneManager.ZONE_TYPE.MACRO_STMT
          : CodeZoneManager.ZONE_TYPE.GBL_STMT;
      }
      return zone.type;
    }

    return this._globalStmt(context);
  }
  private _normalize(line: number, col: number) {
    if (col < 0) {
      if (line < 1) {
        line = 0;
        col = 0;
      } else {
        line--;
        col = this._model.getLine(line).length;
      }
    }
    return { line: line, col: col };
  }
  private _cloneContext(context: Context): Context {
    // var obj = {};
    // for (var attr in context) {
    //   if (context.hasOwnProperty(attr)) {
    //     obj[attr] = context[attr]; //not deep clone
    //   }
    // }
    return Object.assign({}, context);
  }
  private _copyContext(src: any, dst: any) {
    for (const attr in src) {
      // eslint-disable-next-line no-prototype-builtins
      if (src.hasOwnProperty(attr)) {
        dst[attr] = src[attr];
      }
    }
  }
  private _currentZone(line: number, col: number) {
    const newToken = this._token(line, col)!,
      type = newToken.type; //self.type(line,col),
    let context = null,
      pos: any = this._normalize(line, col - 1);
    const tmpLine = pos.line,
      tmpCol = pos.col;
    let token = this._token(tmpLine, tmpCol)!;
    const block = this._syntaxProvider.getFoldingBlock(tmpLine, tmpCol);
    /* first check type to determine zone, some special conditions
     * 1) for bringing up auto completion popup by shortcut,
     * 2) input at the end of a line in comment or literal
     */
    pos = this._pos({ line: line, col: col }, token);
    const newPos = this._pos({ line: line, col: col }, newToken);
    if (pos === 1 || newPos === 1 || !this._ended(token)) {
      //&& (SasLexer.isComment[type] || SasLexer.isLiteral[type])
      ///*|| SasLexer.isComment[type] || SasLexer.isLiteral[type]*/) {
      //return ZONE_TYPE.RESTRCITED;
      if (Lexer.isComment[type]) {
        return CodeZoneManager.ZONE_TYPE.COMMENT;
      }
      if (type === "string") {
        return CodeZoneManager.ZONE_TYPE.QUOTED_STR;
      }
      if (type === "cards-data") {
        return CodeZoneManager.ZONE_TYPE.DATALINES;
      }
      if (Lexer.isLiteral[type]) {
        return CodeZoneManager.ZONE_TYPE.LITERAL;
      }
    }
    context = {
      block: block,
      line: line,
      col: col - 1, //
      syntaxIdx: -1,
      cursor: { line: line, col: col },
    };
    this._reset();
    //_skipToStmtStart(context,true);
    if (this._sectionMode) {
      if (this._sectionMode.secType === SEC_TYPE.PROC) {
        this._skipToStmtStart(context, true);
        token = this._getNextEx(context);
        this._procName = this._sectionMode.procName.toUpperCase();
        return this._procStmt(context, token as TokenWithPos);
      }
    }
    if (!block || this._isBlockStart(block, token)) {
      return this._globalStmt(context);
    } else if (block.type === SEC_TYPE.PROC) {
      return this._procSec(context);
    } else if (block.type === SEC_TYPE.DATA) {
      return this._dataSec(context);
    } else if (block.type === SEC_TYPE.MACRO) {
      return this._macroSec(context);
    }
    return CodeZoneManager.ZONE_TYPE.RESTRICTED;
  }
  /* The followings are the APIs for code zone manager.*/
  getProcName(): string {
    return this._procName;
  }
  getStmtName(): string {
    return this._stmtName;
  }
  getOptionName(): string {
    return this._optName;
  }
  getSubOptionName(): string {
    return this._subOptName;
  }
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  getCurrentZone(line: number, col: number) {
    try {
      return this._currentZone(line, col);
    } catch (e) {
      return CodeZoneManager.ZONE_TYPE.RESTRICTED;
    }
  }
  setSectionMode(secType: number, procName: string): void {
    this._sectionMode = {
      secType: secType,
      procName: procName,
    };
  }

  static readonly ZONE_TYPE = {
    RESTRICTED: 10,
    SIMPLE_ITEM: 11,
    STMT_NAME: 12,
    OPT_ITEM: 13,
    OPT_NAME: 14,
    OPT_NAME_REQ: 114,
    OPT_VALUE: 15,
    CALL_OR_CONFIG: 16,
    OBJECT: 17,
    SUB_OPT_NAME: 18,
    SUB_OPT_VALUE: 19,
    // global statement related
    GBL_STMT: 500,
    GBL_STMT_OPT: 501,
    GBL_STMT_OPT_VALUE: 502,
    GBL_STMT_SUB_OPT_NAME: 503,
    // procedure related
    PROC_DEF: 510,
    PROC_OPT: 511,
    PROC_OPT_VALUE: 512,
    PROC_SUB_OPT_NAME: 509, //
    PROC_STMT: 515,
    PROC_STMT_OPT: 516,
    PROC_STMT_OPT_REQ: 514,
    PROC_STMT_OPT_VALUE: 517,
    PROC_STMT_SUB_OPT: 518,
    PROC_STMT_SUB_OPT_VALUE: 519,
    // data step related
    DATA_STEP_DEF: 520,
    DATA_STEP_DEF_OPT: 521,
    DATA_STEP_OPT_NAME: 522,
    DATA_STEP_OPT_VALUE: 523,
    DATA_SET_NAME: 524,
    VIEW_OR_DATA_SET_NAME: 525,
    DATA_SET_OPT_NAME: 526,
    DATA_SET_OPT_VALUE: 530,
    VIEW_OR_PGM_NAME: 531,
    VIEW_OR_PGM_OPT_NAME: 532,
    VIEW_OR_PGM_OPT_VALUE: 533,
    VIEW_OR_PGM_SUB_OPT_NAME: 534,
    DATA_STEP_STMT: 540,
    DATA_STEP_STMT_OPT: 541,
    DATA_STEP_STMT_OPT_VALUE: 542,
    // macro related
    MACRO_DEF: 545,
    MACRO_DEF_OPT: 546,
    MACRO_STMT: 547,
    MACRO_STMT_OPT: 548,
    MACRO_STMT_OPT_VALUE: 549,
    MACRO_STMT_BODY: 550,
    // style related
    STYLE_LOC: 555,
    STYLE_ELEMENT: 556,
    STYLE_ATTR: 557,
    // literals or comment
    QUOTED_STR: 600,
    COMMENT: 601,
    LITERAL: 602,
    COLOR: 605,
    FORMAT: 606,
    INFORMAT: 607,
    MACRO_FUNC: 608,
    SAS_FUNC: 609,
    STAT_KW: 610,
    AUTO_MACRO_VAR: 611,
    MACRO_VAR: 612,
    DATALINES: 613,
    LIB: 614,
    // misc
    CALL_ROUTINE: 700,
    ARG_LIST: 701,
    ARG_LIST_START: 702,
    ARG_LIST_END: 703,
    TAGSETS_NAME: 704,
    ODS_STMT: 705,
    ODS_STMT_OPT: 706,
    ODS_STMT_OPT_VALUE: 707,
  };
}
