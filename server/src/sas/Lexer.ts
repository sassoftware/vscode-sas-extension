// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable @typescript-eslint/consistent-type-assertions*/
import { Model } from "./Model";
import { SyntaxDataProvider } from "./SyntaxDataProvider";
import { TextPosition, arrayToMap } from "./utils";

let macroKwMap: Record<string, 1> | undefined = undefined;
//TODO
// var unicode = window.ace.require('ace/unicode');
// wordReg = new RegExp("["
//     + unicode.packages.L
//     + unicode.packages.Mn + unicode.packages.Mc
//     + unicode.packages.Nd
//     + unicode.packages.Pc + "\\$_]+$");
const wordReg = /[^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>/?\s]/;

const DAYS = {
  JAN: 31,
  FEB: 29,
  MAR: 31,
  APR: 30,
  MAY: 31,
  JUN: 30,
  JUL: 31,
  AUG: 31,
  SEP: 30,
  OCT: 31,
  NOV: 30,
  DEC: 31,
};
const DATE_DDMMMYY_YYQ_REG =
  /^\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2}|\d{4})|\d{2}q[1234]\b/i;

function checkQuote(current: number, isHead: boolean, text: string) {
  if (current === -1 && isHead) {
    return 0;
  } else if (current === 0 && text !== "(") {
    return -1;
  } else if (current >= 0) {
    if (text === "(") {
      return current + 1;
    } else if (text === ")") {
      if (--current === 0) {
        current = -1;
      }
    }
  }
  return current;
}

export interface Token {
  type:
    | "sep"
    | "keyword"
    | "sec-keyword"
    | "proc-name"
    | "comment"
    | "macro-keyword"
    | "macro-comment"
    | "macro-ref"
    | "macro-sec-keyword"
    | "cards-data"
    | "string"
    | "date"
    | "time"
    | "dt"
    | "bitmask"
    | "namelit"
    | "hex"
    | "numeric"
    | "text"
    | "format"
    | "blank"
    | "embedded-code";
  start: TextPosition;
  end: TextPosition;
  text: string;
}

enum EmbeddedLangState {
  NONE,
  PROC_PYTHON_DEF,
  PROC_PYTHON_SUBMIT_OR_INTERACTIVE,
  PROC_PYTHON_CODE,
  PROC_LUA_DEF,
  PROC_LUA_SUBMIT_OR_INTERACTIVE,
  PROC_LUA_CODE,
}
export class Lexer {
  start = { line: 0, column: 0 };
  curr = { line: 0, column: 0 };
  private quoting = -1;
  private bquoting = -1;
  private ignoreFormat = false;
  private syntaxDb = new SyntaxDataProvider();
  private context: {
    lastNoncommentToken?: Token | null;
    embeddedLangState?: EmbeddedLangState;
  } = { embeddedLangState: EmbeddedLangState.NONE };

  constructor(private model: Model) {
    if (!macroKwMap) {
      const macroStmts = this.syntaxDb
        .getMacroStatements()
        ?.map((name) => name.slice(1));
      const macroFuncs = this.syntaxDb
        .getMacroFunctions()
        ?.map((name) => name.slice(1));
      macroKwMap = arrayToMap(macroStmts?.concat(macroFuncs ?? []) ?? []);
    }
  }

  static readonly TOKEN_TYPES = {
    SEP: "sep",
    KEYWORD: "keyword",
    SKEYWORD: "sec-keyword",
    PROCNAME: "proc-name",
    COMMENT: "comment",
    MKEYWORD: "macro-keyword",
    MCOMMENT: "macro-comment",
    MREF: "macro-ref",
    MSKEYWORD: "macro-sec-keyword",
    CARDSDATA: "cards-data",
    STR: "string",
    DATE: "date",
    TIME: "time",
    DT: "dt",
    BM: "bitmask",
    NL: "namelit",
    HEX: "hex",
    NUM: "numeric",
    WORD: "text",
    FORMAT: "format",
    BLANK: "blank",
  };

  static readonly notSyntaxToken = arrayToMap([
    "comment",
    "macro-comment",
    "blank",
  ]);
  static readonly isComment = arrayToMap(["comment", "macro-comment"]);
  static readonly isLiteral = arrayToMap([
    "string",
    "date",
    "time",
    "dt",
    "bitmask",
    "namelit",
    "hex",
    "numeric",
    "cards-data",
  ]);
  static readonly isWord = arrayToMap([
    "keyword",
    "sec-keyword",
    "macro-sec-keyword",
    "macro-ref",
    "macro-keyword",
    "text",
  ]);
  static readonly isConst = arrayToMap([
    "string",
    "date",
    "time",
    "dt",
    "bitmask",
    "namelit",
    "hex",
    "numeric",
    "format",
  ]);
  static readonly isCards = arrayToMap([
    "CARDS",
    "LINES",
    "DATALINES",
    "DATALINES4",
    "CARDS4",
    "LINES4",
  ]);
  static readonly isCards4 = arrayToMap(["DATALINES4", "CARDS4", "LINES4"]);
  static readonly isParmcards = arrayToMap(["PARMCARDS", "PARMCARDS4"]);
  static readonly isParmcards4 = arrayToMap(["PARMCARDS4"]);
  static readonly isQuoting = arrayToMap([
    "%STR",
    "%NRSTR",
    "%QUOTE",
    "%NRQUOTE",
  ]);
  static readonly isBQuoting = arrayToMap(["%SUPERQ", "%BQUOTE", "%NRBQUOTE"]);
  static readonly isBinaryOpr = arrayToMap([
    "**",
    "+",
    "-",
    "*",
    "/", //arithmetic operators
    "&",
    "|",
    "!",
    "\u00A6",
    "AND",
    "OR",
    //'\u00AC','\u00B0','~','NOT',//boolean operators
    "||", //contatenation operators
    "<>",
    "><", //min and max operators
    "=",
    "EQ",
    "^=",
    "\u00AC=",
    "~=",
    "NE",
    ">",
    "GT",
    "<",
    "LT",
    ">=",
    "GE",
    "<=",
    "LE",
    "=:",
    ">:",
    "<:",
    "^=:",
    "\u00AC=:",
    "~=:",
    ">=:",
    "<=:", //,//comparison
    //'IN' // disable this for HTMLCOMMONS-3847 (height=0.75in ctext=red)
  ]); // operators
  static readonly isUnaryOpr = arrayToMap([
    "\u00AC",
    "\u00B0",
    "~",
    "NOT",
    "+",
    "-",
  ]); //boolean operators

  static readonly longBiOprs =
    /^(\^=:|\u00AC=:|~=:|>=:|<=:|\*\*|<>|\^=|\u00AC=|~=|>=|<=|\|\||=:|>:|<:)/;
  //'**','<>','><','^=','\u00AC=','~=','>=','<=','||','=:','>:','<:',  //len 2
  //'^=:','\u00AC=:','~=:','>=:','<=:'   //len 3

  _readToken(): Token | undefined {
    const token = this.getNext_() as Token | undefined;
    if (!token) {
      this.context.embeddedLangState = EmbeddedLangState.NONE;
      return undefined;
    }
    if (Lexer.isLiteral[token.type]) {
      token.text = this.getText(token);
    } else {
      token.text = this.getWord(token).toUpperCase();
    }
    if (Lexer.isComment[token.type] === undefined) {
      this.quoting = checkQuote(
        this.quoting,
        !!Lexer.isQuoting[token.text],
        token.text,
      );
      this.bquoting = checkQuote(
        this.bquoting,
        !!Lexer.isBQuoting[token.text],
        token.text,
      );
      if (this.quoting === -1 && this.bquoting === -1) {
        if (!this.ignoreFormat && token.text === "%PUT") {
          this.ignoreFormat = true;
        } else if (this.ignoreFormat && token.text === ";") {
          this.ignoreFormat = false;
        }
      }
    }
    return token;
  }

  getNext(): Token | undefined {
    let token: Token | undefined;
    SWITCH: switch (this.context.embeddedLangState) {
      case EmbeddedLangState.NONE: {
        token = this._readToken();
        if (!token) {
          break SWITCH;
        }
        if (
          this.context.lastNoncommentToken?.type === "text" &&
          this.context.lastNoncommentToken.text === "PROC"
        ) {
          if (token.type === "text" && token.text === "PYTHON") {
            this.context.embeddedLangState = EmbeddedLangState.PROC_PYTHON_DEF;
          } else if (token.type === "text" && token.text === "LUA") {
            this.context.embeddedLangState = EmbeddedLangState.PROC_LUA_DEF;
          }
        }
        break SWITCH;
      }
      case EmbeddedLangState.PROC_PYTHON_DEF: {
        token = this._readToken();
        if (!token) {
          break SWITCH;
        }
        if (
          token.type === "text" &&
          ["SUBMIT", "INTERACTIVE", "I"].includes(token.text)
        ) {
          this.context.embeddedLangState =
            EmbeddedLangState.PROC_PYTHON_SUBMIT_OR_INTERACTIVE;
        }
        break SWITCH;
      }
      case EmbeddedLangState.PROC_LUA_DEF: {
        token = this._readToken();
        if (!token) {
          break SWITCH;
        }
        if (
          token.type === "text" &&
          ["SUBMIT", "INTERACTIVE", "I"].includes(token.text)
        ) {
          this.context.embeddedLangState =
            EmbeddedLangState.PROC_LUA_SUBMIT_OR_INTERACTIVE;
        }
        break SWITCH;
      }
      case EmbeddedLangState.PROC_PYTHON_SUBMIT_OR_INTERACTIVE: {
        token = this._readToken();
        if (!token) {
          break SWITCH;
        }
        if (token.type === "sep" && token.text === ";") {
          this.context.embeddedLangState = EmbeddedLangState.PROC_PYTHON_CODE;
        }
        break SWITCH;
      }
      case EmbeddedLangState.PROC_PYTHON_CODE: {
        let multiLineStrState: false | '"""' | "'''" = false;
        for (
          let line = this.curr.line;
          line < this.model.getLineCount();
          line++
        ) {
          const lineContent = this._readEmbeddedCodeLine(this.curr, line);
          let pos = 0;
          let match;
          do {
            if (match) {
              pos += match.index + match[0].length;
            }
            if (multiLineStrState) {
              match = /'''|"""/.exec(lineContent.substring(pos));
              if (match && match[0] === multiLineStrState) {
                multiLineStrState = false;
              }
            } else {
              const stringReg = /'''|"""|("[^"]*?("|$))|('[^']*?('|$))/;
              const commentReg = /#.*$/;
              const secReg =
                /(\b((endsubmit|endinteractive)(\s+|\/\*.*?\*\/)*;|(data|proc|%macro)\b[^'";]*;))/;
              match = new RegExp(
                `${stringReg.source}|${commentReg.source}|${secReg.source}`,
                "m",
              ).exec(lineContent.substring(pos));
              if (match) {
                const matchedText = match[0];
                if (matchedText === "'''" || matchedText === '"""') {
                  multiLineStrState = matchedText;
                } else if (
                  matchedText.startsWith("'") ||
                  matchedText.startsWith('"') ||
                  matchedText.startsWith("#")
                ) {
                  // do nothing to skip string and single line comment
                } else {
                  token = this._foundEmbeddedCodeToken(this.curr, {
                    line: line,
                    column: pos + match.index,
                  });
                  break SWITCH;
                }
              }
            }
          } while (match);
        }
        token = this._foundEmbeddedCodeToken(this.curr);
        break SWITCH;
      }
      case EmbeddedLangState.PROC_LUA_SUBMIT_OR_INTERACTIVE: {
        token = this._readToken();
        if (!token) {
          break SWITCH;
        }
        if (token.type === "sep" && token.text === ";") {
          this.context.embeddedLangState = EmbeddedLangState.PROC_LUA_CODE;
        }
        break SWITCH;
      }
      case EmbeddedLangState.PROC_LUA_CODE: {
        let multiLineStrState: false | "[[" | "--[[" | "/*" = false;
        for (
          let line = this.curr.line;
          line < this.model.getLineCount();
          line++
        ) {
          const lineContent = this._readEmbeddedCodeLine(this.curr, line);
          let pos = 0;
          let match;
          do {
            if (match) {
              pos += match.index + match[0].length;
            }
            if (multiLineStrState) {
              match = /\]\]|--\]\]|\*\//.exec(lineContent.substring(pos));
              if (match) {
                if (multiLineStrState === "[[" && match[0] === "]]") {
                  multiLineStrState = false;
                } else if (
                  multiLineStrState === "--[[" &&
                  (match[0] === "--]]" || match[0] === "]]")
                ) {
                  multiLineStrState = false;
                } else if (multiLineStrState === "/*" && match[0] === "*/") {
                  multiLineStrState = false;
                }
              }
            } else {
              const stringReg = /("[^"]*("|$))|('[^']*('|$))|\[\[/;
              const commentReg = /--[^[].*$|--\[\[|\/\*/;
              const secReg =
                /(\b((endsubmit|endinteractive)(\s+|\/\*.*?\*\/)*;|(data|proc|%macro)\b[^'";]*;))/;
              const reg = new RegExp(
                `${stringReg.source}|${commentReg.source}|${secReg.source}`,
                "m",
              );
              match = reg.exec(lineContent.substring(pos));
              if (match) {
                const matchedText = match[0];
                if (matchedText.startsWith("[[")) {
                  multiLineStrState = "[[";
                } else if (matchedText.startsWith("--[[")) {
                  multiLineStrState = "--[[";
                } else if (matchedText.startsWith("/*")) {
                  multiLineStrState = "/*";
                } else if (
                  matchedText.startsWith("'") ||
                  matchedText.startsWith('"') ||
                  matchedText.startsWith("--")
                ) {
                  // do nothing to skip string or single line comment
                } else {
                  token = this._foundEmbeddedCodeToken(this.curr, {
                    line: line,
                    column: pos + match.index,
                  });
                  break SWITCH;
                }
              }
            }
          } while (match);
        }
        token = this._foundEmbeddedCodeToken(this.curr);
        break SWITCH;
      }
    }
    if (token) {
      if (Lexer.isComment[token.type] === undefined) {
        this.context.lastNoncommentToken = {
          ...token,
          start: { ...token.start },
          end: { ...token.end },
        };
      }
    }
    return token;
  }

  private _readEmbeddedCodeLine(
    startPos: TextPosition,
    curLine: number,
  ): string {
    let lineContent = this.model.getLine(curLine);
    if (curLine === startPos.line) {
      lineContent =
        " ".repeat(startPos.column) + lineContent.slice(startPos.column);
    }
    return lineContent;
  }

  private _foundEmbeddedCodeToken(
    startPos: TextPosition,
    endPos?: TextPosition,
  ): Token {
    const start = { ...startPos };
    let end;
    if (endPos) {
      end = { ...endPos };
    } else {
      const lastLine = this.model.getLineCount() - 1;
      end = {
        line: lastLine,
        column: this.model.getColumnCount(lastLine),
      };
    }
    const token: Token = {
      type: "embedded-code",
      start,
      end,
      text: this.model.getText({ start, end }).trim(),
    };
    this.curr = { ...token.end };
    this.context.embeddedLangState = EmbeddedLangState.NONE;
    return token;
  }

  /**
   * @returns {object}
   * type: 'sep', 'comment', 'keyword', 'date', 'time', 'dt', 'normaltext',
   *       'numeric', 'string',
   *       'macro-sec', 'macro-keyword', 'macro-text', 'macro-def',
   * start: start position
   * end: end position
   *
   */
  private getNext_(): Omit<Token, "text"> | undefined {
    let j = 0,
      type: Token["type"],
      i,
      text,
      qm,
      //word,
      ch,
      len;
    const totalLines = this.model.getLineCount();
    //loop1:
    while (this.curr.line < totalLines) {
      this.start.line = this.curr.line;
      this.start.column = this.curr.column;
      i = this.curr.column;
      text = this.model.getLine(this.curr.line);
      len = text.length;
      switch (text[i]) {
        case "/":
          i++;
          if (i < len && text[i] === "*") {
            //this is comment
            //find the end of this comment
            i++;
            for (;;) {
              j = text.indexOf("*/", i);
              if (j >= 0) {
                this.curr.column = j + 2;
                break;
              }
              this.curr.line++;
              if (this.curr.line >= totalLines) {
                this.curr.line--;
                this.curr.column = text.length;
                break;
              } else {
                this.curr.column = 0;
                i = 0;
                text = this.model.getLine(this.curr.line);
              }
            }
            //this.curr.column++;
            return {
              type: "comment",
              start: this.start,
              end: this.curr,
            };
          } else {
            this.curr.column = i;
            return {
              type: "sep",
              start: this.start,
              end: this.curr,
            }; //
          }
        case "%":
          //macro,
          i++;
          if (i < len && /[A-Za-z_]/.test(text[i])) {
            //the first char
            i++;
            while (i < len && /[\w_]/.test(text[i])) {
              i++;
            }
            this.curr.column = i;
            //check macro section keyword
            type = "text";
            if (
              this.isMacroKeyword(
                text.substr(this.start.column + 1, i - this.start.column - 1),
              )
            ) {
              type = "macro-keyword";
            } else {
              type = "macro-ref";
            }
            return {
              type: type, //SasLexer.TOKEN_TYPES.MKEYWORD,
              start: this.start,
              end: this.curr,
            };
          } else if (i < len && text[i] === "*") {
            //macro comment
            for (;;) {
              i++;
              if (i >= len) {
                this.curr.line++;
                i = 0;
                if (this.curr.line < totalLines) {
                  text = this.model.getLine(this.curr.line);
                  len = text.length;
                } else {
                  this.curr.line--;
                  this.curr.column = text.length;
                  break;
                }
              }
              if (text[i] === ";") {
                this.curr.column = i + 1;
                break;
              }
            }

            return {
              type: "macro-comment",
              start: this.start,
              end: this.curr,
            };
          } else if (
            this.quoting > 0 &&
            i < len &&
            (text[i] === "'" ||
              text[i] === '"' ||
              text[i] === "(" ||
              text[i] === ")" ||
              text[i] === "%")
          ) {
            this.curr.column++;
          }
          this.curr.column++;
          return {
            type: "sep",
            start: this.start,
            end: this.curr,
          };
        case '"':
        case "'": // string constants
          // string constant, date, time, datetime,
          if (this.bquoting > 0) {
            this.curr.column++;
            break;
          }
          qm = text[i]; //qm = qutation mark
          type = "string";
          //over multi lines
          //escape??
          i++;
          while (this.curr.line < totalLines) {
            if (i < len) {
              if (qm === text[i]) {
                //found end mark
                i++;
                if (this.quoting > 0 && text[i - 2] === "%") {
                  // for escape, e.g. %str('Jim%'s office');
                } else if (qm === text[i]) {
                  i++; // for escape, e.g. name='Tom''s'; name="Tom""s";
                } else {
                  //check if this is date, time, datatime
                  if (i < len) {
                    switch (text[i]) {
                      case "d":
                      case "D":
                        type = "date";
                        i++;
                        if (i < len && (text[i] === "t" || text[i] === "T")) {
                          type = "dt";
                          i++;
                        }
                        break;
                      case "t":
                      case "T":
                        type = "time";
                        i++;
                        break;
                      case "b":
                      case "B":
                        type = "bitmask";
                        i++;
                        break; //bit mask
                      case "n":
                      case "N":
                        type = "namelit";
                        i++;
                        break; //name literal
                      case "x":
                      case "X":
                        type = "hex";
                        i++;
                        break; //hexadecimal notation
                    }
                  }
                  this.curr.column = i;
                  return {
                    type: type,
                    start: this.start,
                    end: this.curr,
                  };
                }
              } else {
                i++;
              }
            } else {
              this.curr.line++;
              if (this.curr.line >= totalLines) {
                this.curr.line--;
                this.curr.column = i;
                return {
                  type: type,
                  start: this.start,
                  end: this.curr,
                };
              }
              i = 0;
              text = this.model.getLine(this.curr.line);
              len = text.length;
            }
          }
          break;
        case "\t": /*
          this.curr.column++;
          return {
            type: SasLexer.TOKEN_TYPES.WORD,
            start: this.start,
            end: this.curr
          };*/
        // eslint-disable-next-line no-fallthrough
        case " ": //space
        case "\u00a0":
          this.curr.column++;
          break;
        case ".":
          this.curr.column = this.readNum(i, 10);
          if (this.curr.column === i) {
            this.curr.column++;
            type = "sep";
          } else {
            type = "numeric";
          }
          return {
            type: type,
            start: this.start,
            end: this.curr,
          };
        //break;
        case "$":
          this.curr.column++;
          type = "sep";
          i++;
          if (i < len) {
            ch = text[i];
            if (/[a-zA-Z_0-9]/.test(ch)) {
              i++;
              while (i < len && /[\w_]/.test(text[i])) {
                i++;
              }
              if (i < len && text[i] === ".") {
                //format or informat
                this.curr.column = this.readNum(i, 10);
                if (this.curr.column === i) {
                  this.curr.column++;
                }
                type = "format";
              }
            }
          }
          return {
            type: type,
            start: this.start,
            end: this.curr,
          };
        //break;
        case "*": //comment
          // this kind of comment must follow ';' , may exists spaces between them
          // may be multi lines
          if (
            this.context.lastNoncommentToken !== null &&
            this.getWord(this.context.lastNoncommentToken) !== ";"
          ) {
            i++;
            this.curr.column = i;
            return {
              type: "sep",
              start: this.start,
              end: this.curr,
            };
          }
          //
          //this is comment
          while (/*(this.curr.line < totalLines) &&*/ text[i] !== ";") {
            i++;
            if (i >= len) {
              //continue to handle the next line
              this.curr.line++;
              if (this.curr.line >= totalLines) {
                //FIXID S0965730:Commenting and then uncommenting code in code editor causes code editor to be unusable.
                i--;
                this.curr.line--;
                break;
              }
              i = 0;
              text = this.model.getLine(this.curr.line);
              len = text.length;
            }
          }
          this.curr.column = i + 1;
          return {
            type: "comment",
            start: this.start,
            end: this.curr,
          };
        //break;
        case "\n":
        case "\r":
        case "\u2028":
        case "\u2029":
        case undefined:
          this.curr.line++;
          this.curr.column = 0;
          i = 0;
          //if (this.end()){
          //    return null;
          //}
          //continue loop1;
          break;
        //return null;
        default: {
          type = "text";
          //word = '';
          ch = text[i];
          if (wordReg.test(ch) && !/\d/.test(ch)) {
            //the first char
            i++;
            while (i < len && wordReg.test(text[i])) {
              i++;
            }
            //format or informat
            if (
              this.quoting === -1 &&
              this.bquoting === -1 &&
              !this.ignoreFormat &&
              text[i] === "."
            ) {
              this.curr.column = this.readNum(i, 10);
              if (this.curr.column === i) {
                this.curr.column++;
              }
              i++;
              if (
                this.curr.column > i || // has digital after .
                (i < len && wordReg.test(text[i]) === false) || //format like abc.#
                (this.curr.column === i && i === len)
              ) {
                //format is the end of line
                return {
                  type: "format",
                  start: this.start,
                  end: this.curr,
                };
              } else {
                // aaaa.bbb is token
                while (i < len && wordReg.test(text[i])) {
                  i++;
                }
              }
            }
            this.curr.column = i;
            //TODO: check if it's keyword
            //word = text.substr(this.start.column, i - this.start.column);
            //if (this.isSectionWord(word)){
            //    type = SasLexer.TOKEN_TYPES.SKEYWORD;
            //}else
            //if (this.isKeyword(word)) {
            //    type = SasLexer.TOKEN_TYPES.KEYWORD;
            //}

            //end
            return {
              type: type,
              start: this.start,
              end: this.curr,
            }; //TODO: hex
          } else if (
            ch <= "9" &&
            ch >= "0"
            //|| ch === '+'
            //|| ch === '-'
          ) {
            // numeric
            i++;
            type = "numeric";
            //FIXID S1300279
            //REFERENCE: http://support.sas.com/documentation/cdl/en/lrcon/65287/HTML/default/viewer.htm#p1wj0wt2ebe2a0n1lv4lem9hdc0v.htm
            DATE_DDMMMYY_YYQ_REG.lastIndex = 0;
            text = this.model.getLine(this.curr.line);
            let matched = DATE_DDMMMYY_YYQ_REG.exec(
              text.substring(this.curr.column),
            );
            if (matched) {
              const q = matched[0][2];
              if (q !== "q" && q !== "Q") {
                //not check YYQ
                const day = parseInt(matched[0].substr(0, 2));
                if (
                  day < 1 ||
                  day > DAYS[matched[1].toUpperCase() as keyof typeof DAYS]
                ) {
                  matched = null;
                }
              }
            }
            if (ch === "+" || ch === "-") {
              if (text[i] <= "9" && text[i] >= "0") {
                //this.curr.column = i;
                i = this.readNum(i);
              } else {
                //seperator
                this.curr.column = i;
                return {
                  type: "sep",
                  start: this.start,
                  end: this.curr,
                };
              }
            } else if (matched) {
              i = matched[0].length + this.curr.column;
              type = "date"; //same as normal SAS date
            } else {
              i = this.readNum(this.curr.column);
            }
            //i++;//test
            this.curr.column = i;
            return {
              type: type,
              start: this.start,
              end: this.curr,
            };
          } else {
            if (ch !== ";" || (this.quoting < 1 && this.bquoting < 1)) {
              type = "sep";
              const matches = Lexer.longBiOprs.exec(
                text.substring(this.curr.column),
              );
              if (matches) {
                this.curr.column += matches[0].length;
              } else {
                this.curr.column++;
              }
            } else {
              this.curr.column++;
            }
            return {
              type,
              start: this.start,
              end: this.curr,
            };
          }
        } //end default
      } //end switch
    } //end while(1)
  }
  end(): boolean {
    if (this.curr.line < this.model.getLineCount()) {
      return false;
    }
    return true;
  }
  reset(): void {
    this.curr.line = 0;
    this.curr.column = 0;
  }
  startFrom(line: number, col: number): void {
    this.curr.line = line;
    this.curr.column = col;
    this.context.lastNoncommentToken = null;
    this.context.embeddedLangState = EmbeddedLangState.NONE;
    this.quoting = -1;
    this.bquoting = -1;
    this.ignoreFormat = false;
  }
  readNum(col: number, radix?: number): number {
    const text = this.model.getLine(this.curr.line);
    let end = col,
      reg =
        /^\b0?[0-9a-fA-F]+[xX]\b|^(?!0\d)\d+(\.\d{1,})(E([-+])?(\d+)?)?|^\d+\.|^(?!0\d)\d+(\.\d{1,})?(E([-+])?(\d+)?)?|^\d+\.?\d*|\.\d+/gi;
    // Pay attention to the duplication, it is necessary.
    if (radix === 10) {
      reg = /^\d+\.?\d*|^\.\d+/;
    }

    //reg.lastIndex = col;
    //matched = reg.exec(text);
    const matched = reg.exec(text.substring(col));
    if (matched) {
      end = matched[0].length + col;
    }
    return end;
  }
  isMacroKeyword(word: string): boolean {
    return macroKwMap?.[word.toUpperCase()] ? true : false;
  }
  getWord(token: Token | undefined): string {
    //token must be related to a word
    if (token) {
      return this.model
        .getLine(token.end.line)
        .substr(token.start.column, token.end.column - token.start.column);
    }
    return "";
  }
  getText(token: Token): string {
    return this.model.getText(token);
  }
}
