// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions */
import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  CompletionParams,
  Hover,
  MarkupKind,
  SignatureHelp,
  SignatureInformation,
  uinteger,
} from "vscode-languageserver";
import { Position } from "vscode-languageserver-textdocument";

import { CodeZoneManager } from "./CodeZoneManager";
import { Model } from "./Model";
import { HelpData, LibCompleteItem, OptionValues } from "./SyntaxDataProvider";
import { SyntaxProvider } from "./SyntaxProvider";
import { arrayToMap, getText } from "./utils";

const ZONE_TYPE = CodeZoneManager.ZONE_TYPE;

//TODO: please improve tagsets, that's dup.
const tagsets = arrayToMap([
  "CHTML",
  "CORE",
  "CSV",
  "CSVALL",
  "CVSBYLINE",
  "DEFAULT",
  "DOCBOOK",
  "EXCELXP",
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

function _buildKwMap() {
  const KW_MAP = [
    [ZONE_TYPE.FORMAT, "formats"],
    [ZONE_TYPE.INFORMAT, "informats"],
    [ZONE_TYPE.MACRO_FUNC, "macro-func"],
    [ZONE_TYPE.MACRO_STMT, "macro-stmt"],
    [ZONE_TYPE.AUTO_MACRO_VAR, "auto-var"],
    [ZONE_TYPE.MACRO_VAR, "auto-var"],
    [ZONE_TYPE.CALL_ROUTINE, "call-routines"],
    [ZONE_TYPE.SAS_FUNC, "func"],
    [ZONE_TYPE.STAT_KW, "stat-kw"],
    [ZONE_TYPE.STYLE_LOC, "style-loc"],
    [ZONE_TYPE.STYLE_ELEMENT, "style-ele"],
    [ZONE_TYPE.STYLE_ATTR, "style-att"],
    [ZONE_TYPE.GBL_STMT, "gbl-stmt"],
    [ZONE_TYPE.DATA_STEP_STMT, "ds-stmt"],
    [ZONE_TYPE.DATA_SET_OPT_NAME, "ds-option"],
    [ZONE_TYPE.DATA_SET_OPT_VALUE, "ds-option"],
    [ZONE_TYPE.TAGSETS_NAME, "ods-tagsets"],
  ];
  const map: any = {};
  KW_MAP.forEach(function (item) {
    map[item[0]] = item[1];
  });
  return map;
}
const KW_MAP = _buildKwMap();

const possibleFuncZones = [
  ZONE_TYPE.DATA_STEP_STMT_OPT,
  ZONE_TYPE.DATA_STEP_STMT_OPT_VALUE,
  ZONE_TYPE.GBL_STMT_OPT,
  ZONE_TYPE.GBL_STMT_OPT_VALUE,
  ZONE_TYPE.GBL_STMT_SUB_OPT_NAME,
  ZONE_TYPE.MACRO_STMT,
  ZONE_TYPE.MACRO_STMT_OPT,
  ZONE_TYPE.MACRO_STMT_OPT_VALUE,
  ZONE_TYPE.MACRO_STMT_BODY,
  ZONE_TYPE.ODS_STMT_OPT_VALUE,
  ZONE_TYPE.PROC_STMT_OPT,
  ZONE_TYPE.PROC_STMT_OPT_REQ,
  ZONE_TYPE.PROC_STMT_OPT_VALUE,
  ZONE_TYPE.PROC_STMT_SUB_OPT,
  ZONE_TYPE.PROC_STMT_SUB_OPT_VALUE,
  ZONE_TYPE.SAS_FUNC,
  ZONE_TYPE.MACRO_FUNC,
  ZONE_TYPE.OPT_VALUE,
  ZONE_TYPE.SUB_OPT_NAME,
  ZONE_TYPE.SUB_OPT_VALUE,
];

function _distinctList(list: string[]) {
  const newList = [],
    obj: Record<string, true> = {};
  for (let i = 0; i < list.length; i++) {
    const item = list[i].toUpperCase();
    if (!obj[item]) {
      newList.push(list[i]);
      obj[item] = true;
    }
  }
  return newList;
}

function _notify<T>(cb: (data: T) => void, data: T) {
  if (cb) {
    setTimeout(function () {
      cb(data);
    }, 0);
  }
}

function _cleanUpODSStmts(oldStmts: string[]) {
  const stmts: string[] = [];
  if (oldStmts) {
    oldStmts.forEach(function (item) {
      if (item.indexOf("ODS ") !== -1) {
        stmts.push(item.replace("ODS ", ""));
      }
    });
  }
  return stmts;
}

function _cleanUpODSStmtName(name: string) {
  name = name.replace(/(ODS\s*)/gi, "");
  if (name.indexOf("TAGSETS.") !== -1 && name.indexOf("TAGSETS.RTF") === -1) {
    name = name.replace("TAGSETS.", "");
    if (tagsets[name]) {
      name = "MARKUP";
    }
  }
  return name === "" ? "ODS" : "ODS " + name;
}

function _cleanUpKeyword(keyword: string) {
  if (keyword === undefined) {
    //TODO: this check will be removed in the future.
    return keyword;
  }
  keyword = keyword.replace(/(^\s+|\s+$)/g, "");
  if (/^(TITLE|FOOTNOTE|AXIS|LEGEND|PATTERN|SYMBOL)\d{0,}$/i.test(keyword)) {
    const results = keyword.match(
      /^(TITLE|FOOTNOTE|AXIS|LEGEND|PATTERN|SYMBOL)|\d{0,}$/gi,
    )!;
    let nbr = 0,
      upperLimit = 0;
    nbr = parseInt(results[1], 10);
    switch (results[0].toUpperCase()) {
      case "TITLE":
      case "FOOTNOTE":
        upperLimit = 10;
        break;
      case "AXIS":
      case "LEGEND":
        upperLimit = 99;
        break;
      case "PATTERN":
      case "SYMBOL":
        upperLimit = 255;
        break;
    }
    if (nbr > 0 && nbr <= upperLimit) {
      keyword = results[0];
    }
  }
  return keyword.toUpperCase();
}

function _getContextMain(zone: number, keyword: string) {
  let context;
  const wd = keyword.toUpperCase();
  switch (zone) {
    case ZONE_TYPE.GBL_STMT:
    case ZONE_TYPE.DATA_STEP_STMT:
    case ZONE_TYPE.PROC_STMT:
    case ZONE_TYPE.MACRO_STMT:
    case ZONE_TYPE.ODS_STMT:
      context = getText("ce_ac_statement.fmt", wd);
      break;
    case ZONE_TYPE.PROC_DEF:
      context = getText("ce_ac_proc.fmt", wd);
      break;
    case ZONE_TYPE.GBL_STMT_OPT_VALUE:
    case ZONE_TYPE.PROC_OPT_VALUE:
    case ZONE_TYPE.PROC_STMT_OPT_VALUE:
    case ZONE_TYPE.VIEW_OR_PGM_OPT_VALUE:
    case ZONE_TYPE.DATA_STEP_OPT_VALUE:
    case ZONE_TYPE.DATA_STEP_STMT_OPT_VALUE:
    case ZONE_TYPE.DATA_SET_OPT_VALUE:
    case ZONE_TYPE.MACRO_STMT_OPT_VALUE:
    case ZONE_TYPE.ODS_STMT_OPT_VALUE:
    case ZONE_TYPE.OPT_VALUE:
      context = wd;
      break;
    default:
      context = getText("ce_ac_option.fmt", wd);
  }
  return context;
}

function _cleanArg(arg = "", trimEndNum = false) {
  return trimEndNum
    ? arg
        ?.replace(/[-_\s]?\d$/, "")
        .replace(/[-_]n$/, "")
        .replace(/(?<=.)\s?n$/, "")
        .trim()
    : arg
        ?.replace(/\([snk\d]\)/g, "")
        .replace(/['"‘’,<>()|.…]/g, "")
        .trim()
        .toLowerCase();
}

function getItemKind(zone: number | LibCompleteItem["type"]) {
  if (zone === ZONE_TYPE.COLOR) {
    return CompletionItemKind.Color;
  }
  if (zone === ZONE_TYPE.MACRO_VAR) {
    return CompletionItemKind.Variable;
  }
  if (zone === "LIBRARY") {
    return CompletionItemKind.Folder;
  }
  if (zone === ZONE_TYPE.SAS_FUNC || zone === ZONE_TYPE.MACRO_FUNC) {
    return CompletionItemKind.Function;
  }
  return CompletionItemKind.Keyword;
}

function processLabelCase(label: string, prefix: string): string {
  const validPrefix = prefix.indexOf("&") === 0 ? prefix.substring(1) : prefix;

  if (validPrefix.length === 0) {
    return label.toLowerCase();
  } else if (label.indexOf(validPrefix) === 0) {
    return label;
  } else if (validPrefix === validPrefix.toUpperCase()) {
    return label.toUpperCase();
  } else {
    return label.toLowerCase();
  }
}

export class CompletionProvider {
  private czMgr;
  private loader;
  private popupContext: any = {};

  constructor(
    private model: Model,
    private syntaxProvider: SyntaxProvider,
  ) {
    this.loader = syntaxProvider.lexer.syntaxDb;
    this.czMgr = new CodeZoneManager(model, this.loader, syntaxProvider);
  }

  getCodeZoneManager(): CodeZoneManager {
    return this.czMgr;
  }

  getHelp(position: Position): Promise<Hover | undefined> | undefined {
    const line = this.model.getLine(position.line);
    const tokens = this.syntaxProvider.getSyntax(position.line);
    for (let j = 0; j < tokens.length; j++) {
      const start = tokens[j].start;
      const end = j === tokens.length - 1 ? line.length : tokens[j + 1].start;
      if (end > position.character) {
        const keyword = this.model.getText({
          start: { line: position.line, column: start },
          end: { line: position.line, column: end },
        });
        const zone = this.czMgr.getCurrentZone(
          position.line,
          position.character,
        );
        return new Promise((resolve) => {
          if (keyword.trim() === "") {
            resolve(undefined);
            return;
          }
          this._loadHelp({
            keyword: keyword,
            type: "hint",
            zone,
            procName: this.czMgr.getProcName(),
            stmtName: this.czMgr.getStmtName(),
            optName: this.czMgr.getOptionName(),
            cb: (data) => {
              if (data && data.data) {
                resolve({
                  contents: {
                    kind: MarkupKind.Markdown,
                    value: this._addLinkContext(zone, data),
                  },
                  range: {
                    start: { line: position.line, character: start },
                    end: { line: position.line, character: end },
                  },
                });
              } else {
                resolve(undefined);
              }
            },
          });
        });
      }
    }
  }

  getSignatureHelp(
    position: Position,
    activeSignature?: uinteger,
  ): Promise<SignatureHelp | undefined> {
    const line = this.model.getLine(position.line);
    const tokens = this.syntaxProvider.getSyntax(position.line);
    let keyword: string;
    let zone: number | undefined;
    let activeParameter = 0;
    let bracketLevel = 0;
    for (let j = tokens.length - 1; j >= 0; j--) {
      const start = tokens[j].start;
      const end = j === tokens.length - 1 ? line.length : tokens[j + 1].start;
      if (end <= position.character) {
        if (
          tokens[j].style !== "sep" &&
          tokens[j].style !== "keyword" &&
          tokens[j].style !== "macro-keyword"
        ) {
          continue;
        }
        const _keyword = this.model.getText({
          start: { line: position.line, column: start },
          end: { line: position.line, column: end },
        });
        if (bracketLevel === -1) {
          if (_keyword === ")") {
            bracketLevel = 1;
            activeParameter = 0;
            continue;
          }
          if (_keyword === "(") {
            continue;
          }
          if (_keyword === ",") {
            bracketLevel = 0;
            activeParameter = 1;
            continue;
          }

          zone = this.czMgr.getCurrentZone(position.line, start + 1);
          if (possibleFuncZones.includes(zone)) {
            keyword = _keyword;
            break;
          }
        } else if (_keyword === ")") {
          bracketLevel++;
        } else if (_keyword === "(") {
          bracketLevel--;
        } else if (_keyword === "," && bracketLevel === 0) {
          activeParameter++;
        }
      }
    }

    return new Promise((resolve) => {
      if (!keyword || !zone) {
        resolve(undefined);
      } else {
        zone = keyword.startsWith("%")
          ? ZONE_TYPE.MACRO_FUNC
          : ZONE_TYPE.SAS_FUNC;
        this._loadHelp({
          keyword,
          type: "hint",
          zone,
          procName: this.czMgr.getProcName(),
          stmtName: this.czMgr.getStmtName(),
          optName: this.czMgr.getOptionName(),
          cb: (data) => {
            if (data && data.key && data.syntax && data.data) {
              // splice function document link address
              const docLink = this._genKeywordLink(data, zone!);

              // solve function overloading
              const regexp = new RegExp(
                `.*?${data.key}.*?\\(((?!${data.key}).)*\\)`,
                "g",
              );
              const syntaxArr: string[] = (
                data.syntax.replace(/\s+/g, " ").match(regexp) ?? [
                  data.syntax.replace(/\s+/g, " "),
                ]
              ).map((syntax) =>
                syntax
                  .replace(/&lt;/g, "<")
                  .replace(/&gt;/g, ">")
                  .replace(/;|\*|<\/?sub>/g, "")
                  .replace(/\s*Form \d:\s*/gi, ""),
              );
              // match arguments in syntax
              const allArgs: string[] = []; // allArgs include all arguments from all functions (function overloading)
              const syntaxArgArr = syntaxArr.map((syntax) =>
                syntax
                  .match(/\((.*)\)/)?.[1]
                  ?.split(",")
                  .map<[string, string, boolean]>((initSyntaxArg) => {
                    let cleanedSyntaxArgs = [_cleanArg(initSyntaxArg)];
                    // match like time|datetime, interval <multiple><.shift-index> etc.
                    if (
                      initSyntaxArg.includes("|") ||
                      (initSyntaxArg.includes(">") &&
                        initSyntaxArg.includes("<") &&
                        (initSyntaxArg.indexOf(">") > 0 ||
                          initSyntaxArg.indexOf("<") > 0))
                    ) {
                      cleanedSyntaxArgs = initSyntaxArg
                        .split(/[<>\\|]/g)
                        .map((arg) => _cleanArg(arg))
                        .filter((item) => item);
                    }
                    cleanedSyntaxArgs = [...new Set(cleanedSyntaxArgs)];

                    const argsInData = data.arguments?.map((item) =>
                      _cleanArg(item.name),
                    );
                    let descriptions = cleanedSyntaxArgs
                      .map((cleanedSyntaxArg) => {
                        let argInData = data.arguments?.find((item, index) => {
                          if (cleanedSyntaxArg === argsInData?.[index]) {
                            // args in allArgs are not cleaned
                            allArgs.push(item.name);
                            return true;
                          }
                        });
                        if (!argInData) {
                          argInData = data.arguments?.find((item, index) => {
                            if (
                              _cleanArg(cleanedSyntaxArg, true) ===
                                _cleanArg(argsInData?.[index], true) ||
                              cleanedSyntaxArg.split(" ")?.[0] ===
                                argsInData?.[index].split(" ")?.[0] ||
                              cleanedSyntaxArg.split("_")?.[0] ===
                                argsInData?.[index].split("_")?.[0] ||
                              cleanedSyntaxArg.split("-")?.[0] ===
                                argsInData?.[index].split("-")?.[0] ||
                              cleanedSyntaxArg.split("–")?.[0] ===
                                argsInData?.[index].split("–")?.[0]
                            ) {
                              // args in allArgs are not cleaned
                              allArgs.push(item.name);
                              return true;
                            }
                          });
                        }
                        if (argInData) {
                          // use not cleaned name in data.arguments
                          return `**${argInData.name}:** ${argInData.description}`;
                        }
                        return "";
                      })
                      .filter((item) => item);
                    descriptions = [...new Set(descriptions)];

                    if (cleanedSyntaxArgs.length === 1) {
                      return [
                        initSyntaxArg.match(/\(.*?\)/)
                          ? initSyntaxArg
                              .trim()
                              .replace(/^[<>]/g, "")
                              .replace(/[<>]$/g, "")
                              .trim()
                          : initSyntaxArg.replace(/[<>()]/g, "").trim(),
                        descriptions[0],
                        true,
                      ];
                    }
                    return [
                      initSyntaxArg.trim(),
                      descriptions.join("\n\n"),
                      descriptions.length === cleanedSyntaxArgs.length, // no exact match
                    ];
                  }),
              );

              // switch to the function with enough arguments
              if (activeParameter > 0 && syntaxArgArr.length > 1) {
                const curArgLength =
                  syntaxArgArr[activeSignature || 0]?.length || 0;
                if (activeParameter > curArgLength - 1) {
                  syntaxArgArr.some((item, index) => {
                    if (item && item.length - 1 >= activeParameter) {
                      activeSignature = index;
                      return true;
                    }
                  });
                }
              }

              const signatures: SignatureInformation[] = [];
              syntaxArr.forEach((syntax, index) => {
                const argsInSyntax = syntaxArgArr[index];
                // match like the N in DIM <N> (array-name)
                const outerArgs = syntax
                  .match(new RegExp(`${keyword}\\s+([^(]*?)\\s+\\(`, "i"))?.[1]
                  ?.replace(/[<>]/g, "")
                  .split(",")
                  .map((argument) => argument.trim());
                const outerArgsDocumentation = data.arguments
                  ?.filter((item) => outerArgs?.includes(item.name))
                  .map((item) => `**${item.name}:** ${item.description}`)
                  .join("\n\n");
                // the unmatched arguments in data.arguments but not in syntax
                let unmatchedArgsDocumentation = "";
                if (
                  argsInSyntax &&
                  !argsInSyntax.every((item) => item[1] && item[2])
                ) {
                  const unmatchedArgs = data.arguments
                    ?.filter(
                      (item) =>
                        ![...allArgs, ...(outerArgs || [])].some(
                          (_argument) =>
                            _argument === item.name ||
                            _cleanArg(_argument) === _cleanArg(item.name) ||
                            _cleanArg(_argument, true) ===
                              _cleanArg(item.name, true),
                        ) && item.description,
                    )
                    .map((item) => `**${item.name}:** ${item.description}`);
                  if (unmatchedArgs) {
                    unmatchedArgsDocumentation = [
                      ...new Set(unmatchedArgs),
                    ].join("\n\n");
                  }
                }

                signatures.push({
                  label: syntax,
                  documentation: data.data,
                  parameters: argsInSyntax?.map(
                    ([label, syntaxArgDocumentation, allMatched]) => {
                      const argsDocument = (
                        syntaxArgDocumentation
                          ? allMatched
                            ? outerArgsDocumentation
                              ? `${syntaxArgDocumentation}\n\n${outerArgsDocumentation}`
                              : syntaxArgDocumentation
                            : unmatchedArgsDocumentation
                              ? outerArgsDocumentation
                                ? `${syntaxArgDocumentation}\n\n${unmatchedArgsDocumentation}\n\n${outerArgsDocumentation}`
                                : `${syntaxArgDocumentation}\n\n${unmatchedArgsDocumentation}`
                              : syntaxArgDocumentation
                          : unmatchedArgsDocumentation
                            ? outerArgsDocumentation
                              ? `${unmatchedArgsDocumentation}\n\n${outerArgsDocumentation}`
                              : unmatchedArgsDocumentation
                            : outerArgsDocumentation
                              ? outerArgsDocumentation
                              : ""
                      ).replace(/<script .*?>/gi, "");
                      const documentLink = `${getText(
                        "ce_ac_sas_function_doc_txt",
                      )} ${docLink}`;
                      return {
                        label,
                        documentation: {
                          kind: MarkupKind.Markdown,
                          value: ["...", "…"].includes(
                            label.replace(/['"‘’<>()|]/g, ""),
                          )
                            ? documentLink
                            : argsDocument
                              ? `${argsDocument}\n\n${documentLink}`
                              : documentLink,
                        },
                      };
                    },
                  ),
                });
              });
              resolve({ signatures, activeSignature, activeParameter });
            } else {
              resolve(undefined);
            }
          },
        });
      }
    });
  }

  getCompleteItems(
    params: CompletionParams,
  ): Promise<CompletionList | undefined> {
    return new Promise((resolve) => {
      this._getZone(params.position);
      const prefix = this.popupContext.prefix;

      this._loadAutoCompleteItems(this.popupContext.zone, (data) => {
        if (
          params.context?.triggerCharacter === "." &&
          data &&
          data[0] &&
          (typeof data[0] === "string" ||
            (data[0].type !== "DATA" && data[0].type !== "VIEW"))
        ) {
          // only data list can be triggered by "."
          resolve(undefined);
          return;
        }
        const items = data?.map((item) => ({
          label: processLabelCase(
            typeof item === "string" ? item : item.name,
            prefix,
          ),
          kind: getItemKind(
            typeof item === "string" ? this.popupContext.zone : item.type,
          ),
          insertText:
            typeof item === "string" ||
            !/\W/.test(item.name) ||
            (this.popupContext.datasetList &&
              this.popupContext.datasetList.some((i: LibCompleteItem) => {
                return item.name.toLowerCase() === i.name.toLowerCase();
              }))
              ? undefined
              : `'${item.name.replace(/'/g, "''")}'n`,
        }));

        if (
          prefix.length > 1 &&
          (items === undefined ||
            items.length === 0 ||
            !items.find((item) => item.label.startsWith(prefix))) &&
          possibleFuncZones.includes(this.popupContext.zone)
        ) {
          const loader = prefix.startsWith("%")
            ? this.loader.getMacroFunctions
            : this.loader.getFunctions;
          loader((data) => {
            const match = data.filter((name) =>
              name.startsWith(prefix.toUpperCase()),
            );
            if (match.length > 0) {
              const matchedItems = match.map((name) => ({
                label: processLabelCase(name, prefix),
                kind: CompletionItemKind.Function,
              }));
              this.popupContext.zone = prefix.startsWith("%")
                ? ZONE_TYPE.MACRO_FUNC
                : ZONE_TYPE.SAS_FUNC;
              resolve({
                isIncomplete: true,
                items: matchedItems,
              });
              return;
            }
            resolve(undefined);
          });
          return;
        }

        resolve(
          items === undefined
            ? undefined
            : {
                isIncomplete: true,
                items,
              },
        );
      });
    });
  }

  getCompleteItemHelp(item: CompletionItem): Promise<CompletionItem> {
    return new Promise((resolve) => {
      if (["endsubmit", "endinteractive"].includes(item.label?.toLowerCase())) {
        this.loader.getProcedureStatementHelp(
          "PYTHON",
          item.label.toUpperCase(),
          (data) => {
            if (data && data.data) {
              item.documentation = {
                kind: MarkupKind.Markdown,
                value: this._addLinkContext(515, data),
              };
            }
            resolve(item);
          },
        );
      } else {
        this._loadHelp({
          keyword: item.label,
          type: "tooltip",
          ...this.popupContext,
          cb: (data) => {
            if (data && data.data) {
              item.documentation = {
                kind: MarkupKind.Markdown,
                value: this._addLinkContext(this.popupContext.zone, data),
              };
            }
            resolve(item);
          },
        });
      }
    });
  }

  private _loadAutoCompleteItems(
    zone: number,
    cb: (data?: (string | LibCompleteItem)[]) => void,
  ) {
    let stmtName = _cleanUpKeyword(this.czMgr.getStmtName());
    const optName = _cleanUpKeyword(this.czMgr.getOptionName()),
      procName = _cleanUpKeyword(this.czMgr.getProcName());

    this.popupContext.procName = procName;
    this.popupContext.stmtName = stmtName;
    this.popupContext.optName = optName;
    this.popupContext.zone = zone;
    switch (zone) {
      case ZONE_TYPE.PROC_DEF:
        this.loader.getProcedures(cb);
        break;
      case ZONE_TYPE.PROC_OPT:
        this.loader.getProcedureOptions(procName, cb);
        break;
      case ZONE_TYPE.PROC_OPT_VALUE:
        this.loader.getProcedureOptionValues(
          procName,
          optName + "=",
          (data) => {
            this._notifyOptValue(cb, data, optName);
          },
        );
        break;
      case ZONE_TYPE.PROC_SUB_OPT_NAME:
        this.loader.getProcedureSubOptions(procName, optName, cb);
        break;
      case ZONE_TYPE.PROC_STMT:
        this.loader.getProcedureStatements(procName, false, (data) => {
          if (procName === "ODS") {
            cb(_cleanUpODSStmts(data));
          } else {
            cb(data);
          }
        });
        break;
      case ZONE_TYPE.EMBEDDED_LANG:
        this.loader.getProcedureStatements(procName, true, cb);
        break;
      case ZONE_TYPE.PROC_STMT_OPT:
      case ZONE_TYPE.PROC_STMT_OPT_REQ:
        if (procName === "ODS") {
          stmtName = "ODS " + stmtName;
        }
        this.loader.getProcedureStatementOptions(
          procName,
          stmtName,
          cb,
          zone === ZONE_TYPE.PROC_STMT_OPT_REQ,
        );
        break;
      case ZONE_TYPE.PROC_STMT_OPT_VALUE:
        if (procName === "ODS") {
          stmtName = "ODS " + stmtName;
        }
        this.loader.getProcedureStatementOptionValues(
          procName,
          stmtName,
          optName,
          (data) => {
            this._notifyOptValue(cb, data, optName);
          },
        );
        break;
      case ZONE_TYPE.PROC_STMT_SUB_OPT:
        if (procName === "ODS") {
          stmtName = "ODS " + stmtName;
        }
        this.loader.getProcedureStatementSubOptions(
          procName,
          stmtName,
          optName,
          function (data) {
            cb(_distinctList(data));
          },
        );
        break;
      case ZONE_TYPE.STYLE_ELEMENT:
        this.loader.getStyleElements(cb);
        break;
      case ZONE_TYPE.STYLE_ATTR:
        this.loader.getStyleAttributes(cb);
        break;
      case ZONE_TYPE.STYLE_LOC:
        this.loader.getStyleLocations(cb);
        break;
      case ZONE_TYPE.DATA_STEP_STMT:
        this.loader.getDSStatements(cb);
        break;
      case ZONE_TYPE.DATA_STEP_DEF_OPT:
        //case ZONE_TYPE.VIEW_OR_DATA_SET_NAME:
        _notify(cb, ["_NULL_", "VIEW=", "PGM="]);
        break;
      case ZONE_TYPE.DATA_SET_OPT_NAME:
        this.loader.getDSOptions(cb);
        break;
      case ZONE_TYPE.DATA_SET_OPT_VALUE:
        this.loader.getDataSetOptionValues(optName, function (data) {
          cb(data ? data.values : undefined);
        });
        break;
      case ZONE_TYPE.DATA_STEP_OPT_NAME:
        _notify(cb, [
          "DEBUG",
          "NESTING",
          "STACK=",
          "VIEW=",
          "SOURCE=",
          "NOLIST",
          "PGM=",
        ]);
        break;
      case ZONE_TYPE.VIEW_OR_PGM_OPT_NAME:
        _notify(cb, ["ALTER=", "READ=", "PW=", "SOURCE="]);
        break;
      case ZONE_TYPE.VIEW_OR_PGM_OPT_VALUE:
      case ZONE_TYPE.DATA_STEP_OPT_VALUE:
        if (optName === "SOURCE") {
          _notify(cb, ["SAVE", "ENCRYPT", "NOSAVE"]);
        }
        break;
      case ZONE_TYPE.VIEW_OR_PGM_SUB_OPT_NAME:
        _notify(cb, ["NOLIST"]);
        break;
      case ZONE_TYPE.OPT_NAME:
        break;
      case ZONE_TYPE.OPT_VALUE:
        break;
      case ZONE_TYPE.DATA_STEP_STMT_OPT:
        if (stmtName === "SET") {
          const pos = this.popupContext.position;
          const lineText = this.model.getLine(pos.line);
          const firstOptForSET = /^\s+\S*$/.test(
            lineText.slice(
              lineText.toUpperCase().indexOf("SET") + 3,
              pos.character,
            ),
          );
          const libref = this._findLibRef();
          if (firstOptForSET || libref) {
            this.loader.getLibraryList((data: OptionValues) => {
              this._notifyOptValue(cb, data, optName);
            }, "DV");
            break;
          }
        }
        this.loader.getStatementOptions("datastep", stmtName, (data) => {
          if (!data) {
            this.loader.getProcedureStatementOptions("DATA", stmtName, cb);
          } else {
            cb(data);
          }
        });
        break;
      case ZONE_TYPE.DATA_STEP_STMT_OPT_VALUE:
        this.loader.getStatementOptionValues(
          "datastep",
          stmtName,
          optName,
          (data) => {
            if (data) {
              this._notifyOptValue(cb, data, optName);
            } else {
              this.loader.getProcedureStatementOptionValues(
                "DATA",
                stmtName,
                optName,
                (data) => {
                  this._notifyOptValue(cb, data, optName);
                },
              );
            }
          },
        );
        break;
      case ZONE_TYPE.MACRO_STMT:
        this.loader.getMacroStatements((macroStmts) => {
          this.loader.getARMMacros(function (armMacros) {
            //if (macroDefList) macroStmts = macroStmts.concat(macroDefList);
            cb(_distinctList(armMacros.concat(macroStmts)));
          });
        });
        //_getMacroDef();
        break;
      case ZONE_TYPE.MACRO_DEF:
        this.loader.getMacroDefinitions();
        break;
      case ZONE_TYPE.MACRO_DEF_OPT:
        this.loader.getProcedureOptions("MACRO", cb);
        break;
      case ZONE_TYPE.MACRO_STMT_OPT:
        this.loader.getStatementOptions("macro", stmtName, cb);
        break;
      case ZONE_TYPE.MACRO_STMT_OPT_VALUE:
        this.loader.getStatementOptionValues(
          "macro",
          stmtName,
          optName,
          (data) => {
            this._notifyOptValue(cb, data, optName);
          },
        );
        break;
      case ZONE_TYPE.CALL_ROUTINE:
        this.loader.getCallRoutines(cb);
        break;
      case ZONE_TYPE.GBL_STMT:
        this.loader.getGlobalStatements((data) => {
          if (this.popupContext.prefix.startsWith("%")) {
            this.popupContext.zone = ZONE_TYPE.MACRO_STMT;
            this.loader.getMacroStatements((macroStmt: any) => {
              cb(_distinctList(macroStmt.concat(data)));
            });
          } else {
            cb(data);
          }
        });
        break;
      case ZONE_TYPE.GBL_STMT_OPT:
        this.loader.getStatementOptions("global", stmtName, (data) => {
          if (!data) {
            this.loader.getStatementOptions("standalone", stmtName, cb);
          } else {
            cb(data);
          }
        });
        break;
      case ZONE_TYPE.GBL_STMT_OPT_VALUE:
        this.loader.getStatementOptionValues(
          "global",
          stmtName,
          optName,
          (data) => {
            if (!data) {
              this.loader.getStatementOptionValues(
                "standalone",
                stmtName,
                optName,
                (data) => {
                  this._notifyOptValue(cb, data, optName);
                },
              );
            } else {
              this._notifyOptValue(cb, data, optName);
            }
          },
        );
        break;
      case ZONE_TYPE.GBL_STMT_SUB_OPT_NAME:
        this.loader.getStatementSubOptions(
          "global",
          stmtName,
          optName,
          (data) => {
            if (!data) {
              this.loader.getStatementSubOptions(
                "standalone",
                stmtName,
                optName,
                cb,
              );
            } else {
              cb(data);
            }
          },
        );
        break;
      case ZONE_TYPE.COLOR:
        this.loader.getSasColors(cb);
        break;
      case ZONE_TYPE.DATA_SET_NAME:
        //TODO:
        break;
      case ZONE_TYPE.FORMAT:
        this.loader.getFormats(cb);
        break;
      case ZONE_TYPE.INFORMAT:
        this.loader.getInformats(cb);
        break;
      case ZONE_TYPE.TAGSETS_NAME:
        this.loader.getODSTagsets(cb);
        break;
      case ZONE_TYPE.ODS_STMT:
        this.loader.getGlobalStatements(function (data) {
          cb(_cleanUpODSStmts(data));
        });
        break;
      case ZONE_TYPE.ODS_STMT_OPT:
        this.loader.getStatementOptions(
          "global",
          _cleanUpODSStmtName(stmtName),
          cb,
        );
        break;
      case ZONE_TYPE.ODS_STMT_OPT_VALUE:
        this.loader.getStatementOptionValues(
          "global",
          _cleanUpODSStmtName(stmtName),
          optName,
          (data) => {
            this._notifyOptValue(cb, data, optName);
          },
        );
        break;
      case ZONE_TYPE.LIB:
        //TODO:
        break;
      case ZONE_TYPE.MACRO_FUNC:
        this.loader.getMacroFunctions(cb);
        break;
      case ZONE_TYPE.SAS_FUNC:
        this.loader.getFunctions(cb);
        break;
      case ZONE_TYPE.STAT_KW:
        this.loader.getStatisticsKeywords(cb);
        break;
      case ZONE_TYPE.AUTO_MACRO_VAR:
        this.loader.getAutoVariables(cb);
        break;
      case ZONE_TYPE.MACRO_VAR:
        this.loader.getAutoVariables((autoVar) => {
          const macroVarList = this._getMacroVar();
          if (macroVarList.length) {
            autoVar = _distinctList(autoVar.concat(macroVarList));
          }
          cb(autoVar);
        });
        break;
      default:
        cb();
        return false;
    }
    return true;
  }

  private _loadHelp(context: {
    keyword: string;
    type: string;
    zone: number;
    procName: string;
    stmtName: string;
    optName: string;
    cb: (data?: HelpData) => void;
  }) {
    let keyword = _cleanUpKeyword(context.keyword),
      help = null;
    const zone = context.zone,
      cb = context.cb,
      type = context.type;

    switch (zone) {
      case ZONE_TYPE.PROC_DEF:
        help = this.loader.getProcedureHelp(keyword, cb);
        break;
      case ZONE_TYPE.PROC_OPT:
        help = this.loader.getProcedureOptionHelp(
          context.procName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.PROC_SUB_OPT_NAME:
        help = this.loader.getProcedureSubOptionHelp(
          context.procName,
          context.optName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.PROC_OPT_VALUE:
        help = this.loader.getProcedureOptionValueHelp(
          context.procName,
          context.optName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.PROC_STMT:
        if (type === "hint") {
          keyword = _cleanUpKeyword(context.stmtName);
        } //not use the real parameter value for hint
        if (context.procName === "ODS") {
          keyword = "ODS " + keyword;
        }
        help = this.loader.getProcedureStatementHelp(
          context.procName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.PROC_STMT_OPT:
      case ZONE_TYPE.PROC_STMT_OPT_REQ:
        context.stmtName = _cleanUpKeyword(context.stmtName);
        if (context.procName === "ODS") {
          context.stmtName = "ODS " + context.stmtName;
        }
        help = this.loader.getProcedureStatementOptionHelp(
          context.procName,
          context.stmtName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.PROC_STMT_SUB_OPT:
        help = this.loader.getProcedureStatementSubOptionHelp(
          context.procName,
          context.stmtName,
          context.optName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.PROC_STMT_OPT_VALUE:
        if (context.procName === "ODS") {
          context.stmtName = "ODS " + context.stmtName;
        }
        help = this.loader.getProcedureStatementOptionValueHelp(
          context.procName,
          context.stmtName,
          context.optName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.EMBEDDED_LANG:
        if (cb) {
          _notify(cb, undefined);
        }

        break;
      case ZONE_TYPE.GBL_STMT_SUB_OPT_NAME:
        help = this.loader.getStatementSubOptionHelp(
          "global",
          _cleanUpKeyword(context.stmtName),
          context.optName,
          keyword,
        );
        if (help) {
          _notify(cb, help);
        } else {
          help = this.loader.getStatementSubOptionHelp(
            "standalone",
            _cleanUpKeyword(context.stmtName),
            context.optName,
            keyword,
            cb,
          );
        }
        break;
      case ZONE_TYPE.GBL_STMT_OPT:
        help = this.loader.getStatementOptionHelp(
          "global",
          _cleanUpKeyword(context.stmtName),
          keyword,
        );
        if (help) {
          _notify(cb, help);
        } else {
          help = this.loader.getStatementOptionHelp(
            "standalone",
            _cleanUpKeyword(context.stmtName),
            keyword,
            cb,
          );
        }
        break;
      case ZONE_TYPE.GBL_STMT_OPT_VALUE:
        help = this.loader.getStatementOptionValueHelp(
          "global",
          context.stmtName,
          context.optName,
          keyword,
        );
        if (help) {
          _notify(cb, help);
        } else {
          help = this.loader.getStatementOptionValueHelp(
            "standalone",
            context.stmtName,
            context.optName,
            keyword,
            cb,
          );
        }
        break;
      case ZONE_TYPE.DATA_STEP_STMT:
        help = this.loader.getKeywordHelp(keyword, undefined, KW_MAP[zone]); // always sync
        if (help) {
          _notify(cb, help);
        } else {
          help = this.loader.getProcedureStatementHelp("DATA", keyword, cb);
        }
        break;
      case ZONE_TYPE.DATA_STEP_STMT_OPT:
        help = this.loader.getStatementOptionHelp(
          "datastep",
          context.stmtName,
          keyword,
        ); // always sync
        if (help) {
          _notify(cb, help);
        } else {
          if (context.stmtName === "SET") {
            help = this.loader.getDataStepOptionHelp(
              keyword,
              cb,
              "datastep-option",
            );
          } else {
            help = this.loader.getProcedureStatementOptionHelp(
              "DATA",
              context.stmtName,
              keyword,
              cb,
            );
          }
        }
        break;
      case ZONE_TYPE.DATA_STEP_STMT_OPT_VALUE:
        help = this.loader.getStatementOptionValueHelp(
          "datastep",
          context.stmtName,
          context.optName,
          keyword,
          cb,
        );
        if (help) {
          _notify(cb, help);
        } else {
          if (context.stmtName === "SET") {
            help = this.loader.getDataStepOptionValueHelp(
              context.optName,
              keyword,
              cb,
            );
          } else {
            help = this.loader.getProcedureStatementOptionValueHelp(
              "DATA",
              context.stmtName,
              context.optName,
              keyword,
            ); // sync
            if (!help) {
              help = this.loader.getStatementOptionValueHelp(
                "global",
                context.stmtName,
                context.optName,
                keyword,
                cb,
              );
            } else {
              _notify(cb, help);
            }
          }
        }
        break;
      case ZONE_TYPE.DATA_SET_OPT_VALUE:
        help = this.loader.getDataSetOptionValueHelp(
          context.optName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.DATA_STEP_DEF_OPT:
      case ZONE_TYPE.VIEW_OR_PGM_OPT_NAME:
        help = this.loader.getDataStepOptionHelp(
          keyword,
          cb,
          "datastep-option2",
        );
        break;
      case ZONE_TYPE.DATA_SET_OPT_NAME:
        help = this.loader.getDSOptionHelp(keyword, cb);
        break;
      case ZONE_TYPE.DATA_STEP_OPT_NAME:
        help = this.loader.getDataStepOptionHelp(
          keyword,
          cb,
          "datastep-option",
        );
        break;
      case ZONE_TYPE.DATA_STEP_OPT_VALUE:
      case ZONE_TYPE.VIEW_OR_PGM_OPT_VALUE:
        help = this.loader.getDataStepOptionValueHelp(
          context.optName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.MACRO_DEF_OPT:
        help = this.loader.getProcedureOptionHelp("MACRO", keyword, cb);
        break;
      case ZONE_TYPE.MACRO_STMT_OPT:
        help = this.loader.getStatementOptionHelp(
          "macro",
          context.stmtName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.MACRO_STMT_OPT_VALUE:
        help = this.loader.getStatementOptionValueHelp(
          "macro",
          context.stmtName,
          context.optName,
          keyword,
          cb,
        );
        break;
      case ZONE_TYPE.ODS_STMT:
        keyword = _cleanUpODSStmtName(keyword);
        help = this.loader.getKeywordHelp(keyword, cb, "gbl-proc-stmt");
        break;
      case ZONE_TYPE.ODS_STMT_OPT:
        help = this.loader.getStatementOptionHelp(
          "global",
          _cleanUpODSStmtName(context.stmtName),
          keyword,
          cb,
        );
        //stmtName = context.stmtName.replace('TAGSETS.','');
        //this.loader.getProcedureStatementOptionHelp('ODS', stmtName, keyword, cb);
        break;
      case ZONE_TYPE.ODS_STMT_OPT_VALUE:
        help = this.loader.getStatementOptionValueHelp(
          "global",
          _cleanUpODSStmtName(context.stmtName),
          context.optName,
          keyword,
          cb,
        );
        break;
      default: {
        if (KW_MAP[zone] === undefined) {
          if (cb) {
            _notify(cb, undefined);
          }
        } else {
          help = this.loader.getKeywordHelp(keyword, cb, KW_MAP[zone]);
        }
      }
    }
    return help;
  }

  private _addLinkContext(zone: number, content: HelpData) {
    const context: any = {};
    let contextText,
      linkTail,
      keyword,
      // productDocumentation,
      // sasNote,
      // papers,
      // tmpHintInfo,
      help,
      alias = "";
    keyword = _cleanUpKeyword(content.key);
    // tmpHintInfo = {
    //   text: keyword,
    //   line: pos ? pos.line : hintInfo.line,
    //   column: pos ? pos.column : hintInfo.column,
    // };
    //if (type === "hint") {
    context.procName = this.czMgr.getProcName();
    context.stmtName = this.czMgr.getStmtName();
    context.optName = this.czMgr.getOptionName();
    //context = hintContext;
    //}
    if (context.procName === "STATGRAPH") {
      // S1481483
      context.procName = "TEMPLATE";
    }
    switch (zone) {
      case ZONE_TYPE.GBL_STMT:
        contextText = getText("ce_ac_global_statement_txt");
        linkTail = "%22" + keyword + "+STATEMENT%22";
        break;
      case ZONE_TYPE.GBL_STMT_OPT:
      case ZONE_TYPE.GBL_STMT_SUB_OPT_NAME:
        if (zone === ZONE_TYPE.GBL_STMT_SUB_OPT_NAME) {
          keyword = context.optName;
        }
        contextText = getText("ce_ac_statement.fmt", context.stmtName);
        linkTail =
          "%22SYSTEM+" + context.stmtName.toUpperCase() + "%22+" + keyword;
        break;
      case ZONE_TYPE.GBL_STMT_OPT_VALUE:
        contextText = getText("ce_ac_option.fmt", context.optName + "=");
        linkTail =
          "%22SYSTEM+" +
          context.stmtName +
          "%22+" +
          context.optName +
          "= " +
          keyword;
        break;
      case ZONE_TYPE.PROC_DEF:
        contextText = getText("ce_ac_procedure_definition_txt");
        linkTail = "%22PROC " + keyword + "%22";
        break;
      case ZONE_TYPE.PROC_OPT:
      case ZONE_TYPE.PROC_STMT:
        if (content.isGlobal) {
          contextText = getText("ce_ac_global_statement_txt");
          linkTail = "%22" + keyword + "+STATEMENT%22";
        } else {
          contextText = getText("ce_ac_proc.fmt", context.procName);
          linkTail = "PROC+" + context.procName + "+" + keyword;
        }
        break;
      case ZONE_TYPE.PROC_SUB_OPT_NAME:
        contextText =
          getText("ce_ac_proc.fmt", context.procName) +
          ", " +
          getText("ce_ac_option.fmt", context.optName + "=");
        linkTail = "%22PROC+" + context.procName + "%22+" + context.optName;
        break;
      case ZONE_TYPE.PROC_OPT_VALUE:
        contextText =
          getText("ce_ac_proc.fmt", context.procName) +
          ", " +
          getText("ce_ac_option.fmt", context.optName + "=");
        linkTail =
          "%22PROC+" +
          context.procName +
          "%22+%22" +
          context.optName +
          "= " +
          keyword +
          "%22";
        break;
      case ZONE_TYPE.PROC_STMT_OPT:
      case ZONE_TYPE.PROC_STMT_SUB_OPT:
        if (zone === ZONE_TYPE.PROC_STMT_SUB_OPT) {
          keyword = context.optName;
        }
        if (content.isGlobal) {
          contextText = getText("ce_ac_statement.fmt", context.stmtName);
          linkTail = "%22" + context.stmtName + "+STATEMENT%22";
        } else {
          contextText =
            getText("ce_ac_proc.fmt", context.procName) +
            ", " +
            getText("ce_ac_statement.fmt", context.stmtName);
          linkTail =
            "%22PROC+" +
            context.procName +
            "%22+%22" +
            context.stmtName +
            "+STATEMENT%22+" +
            keyword;
        }
        break;
      case ZONE_TYPE.PROC_STMT_OPT_VALUE:
        if (content.isGlobal) {
          contextText =
            getText("ce_ac_global_statement_txt") +
            ", " +
            getText("ce_ac_option.fmt", context.optName + "=");
          linkTail =
            "%22SYSTEM+" +
            context.stmtName +
            "%22+" +
            context.optName +
            "= " +
            keyword;
        } else {
          contextText =
            getText("ce_ac_proc.fmt", context.procName) +
            ", " +
            getText("ce_ac_statement.fmt", context.stmtName) +
            ", " +
            getText("ce_ac_option.fmt", context.optName + "=");
          linkTail =
            "PROC+" +
            context.procName +
            "+" +
            context.stmtName +
            "+STATEMENT+" +
            context.optName +
            "= " +
            keyword;
        }
        break;
      case ZONE_TYPE.DATA_STEP_STMT:
        contextText = getText("ce_ac_data_step_txt");
        linkTail = "%22DATA+STEP%22+%22" + keyword + "+" + "STATEMENT%22";
        break;
      case ZONE_TYPE.DATA_STEP_STMT_OPT:
        contextText = getText("ce_ac_statement.fmt", context.stmtName);
        linkTail = "%22" + context.stmtName + "+STATEMENT%22+" + keyword;
        break;
      case ZONE_TYPE.DATA_STEP_OPT_NAME:
      case ZONE_TYPE.DATA_STEP_DEF_OPT:
        contextText = getText("ce_ac_data_step_txt");
        linkTail = "%22DATA STATEMENT%22 "; // + _getOptionName(tmpHintInfo);
        break;
      case ZONE_TYPE.DATA_STEP_OPT_VALUE:
        contextText = getText("ce_ac_data_step_option_value_txt");
        linkTail = "%22DATA STATEMENT%22 " + context.optName + "= " + keyword;
        break;
      case ZONE_TYPE.VIEW_OR_PGM_OPT_NAME:
        contextText = getText("ce_ac_data_step_txt");
        linkTail = "%22DATA STEP PASSWORD= OPTION%22 "; // + _getOptionName(tmpHintInfo);
        break;
      case ZONE_TYPE.VIEW_OR_PGM_OPT_VALUE:
        contextText = getText("ce_ac_data_step_txt");
        linkTail =
          "%22DATA STEP PASSWORD= OPTION%22 " +
          context.optName +
          "= " +
          keyword;
        break;
      // case ZONE_TYPE.VIEW_OR_PGM_SUB_OPT_NAME:
      // contextText = 'DATA STEP VIEW PGM SUB OPTION NAME';
      // var nameParts = _getContextMain(zone, _cleanUpKeyword(_getOptionName(tmpHintInfo))).split(' ');
      // linkTail = "%22DATA STEP%22" + "%OPTIONS%22"+"%22" + nameParts[0] + "%22";
      // break;
      case ZONE_TYPE.DATA_SET_OPT_NAME:
        contextText = getText("ce_ac_data_set_option_txt");
        linkTail = "%22DATA SET OPTIONS%22 "; // + _getOptionName(tmpHintInfo);
        break;
      case ZONE_TYPE.DATA_SET_OPT_VALUE:
        contextText = getText("ce_ac_data_set_option_value_txt");
        linkTail = "%22DATA SET OPTIONS%22 " + context.optName + "= " + keyword;
        break;
      case ZONE_TYPE.MACRO_DEF:
        contextText = getText("ce_ac_macro_definition_txt");
        break;
      case ZONE_TYPE.MACRO_STMT:
        contextText = getText("ce_ac_macro_statement_txt");
        linkTail = "%22" + keyword.replace("%", "") + "+STATEMENT%22";
        break;
      case ZONE_TYPE.MACRO_DEF_OPT:
        contextText = getText("ce_ac_macro_definition_option_txt");
        linkTail =
          "%22" +
          context.stmtName.toUpperCase().replace("%", "") +
          " " +
          keyword.replace("%", "") +
          "%22";
        break;
      case ZONE_TYPE.MACRO_STMT_OPT:
        contextText = getText("ce_ac_macro_statement_option_txt");
        linkTail =
          "%22" +
          context.stmtName.toUpperCase().replace("%", "") +
          " " +
          keyword.replace("%", "") +
          "%22";
        break;
      case ZONE_TYPE.ODS_STMT:
        contextText = getText("ce_ac_ods_txt");
        linkTail = keyword;
        break;
      case ZONE_TYPE.ODS_STMT_OPT:
        contextText = _cleanUpODSStmtName(context.stmtName);
        linkTail = contextText + "+" + keyword;
        contextText = getText("ce_ac_statement.fmt", contextText);
        break;
      case ZONE_TYPE.ODS_STMT_OPT_VALUE:
        contextText = _cleanUpODSStmtName(context.stmtName);
        linkTail = contextText + "+" + context.optName + "= " + keyword;
        contextText =
          getText("ce_ac_statement.fmt", contextText) +
          ", " +
          getText("ce_ac_option.fmt", context.optName + "=");
        break;
      case ZONE_TYPE.TAGSETS_NAME:
        contextText = getText("ce_ac_ods_markup_txt");
        linkTail = "ODS " + keyword;
        break;
      case ZONE_TYPE.CALL_ROUTINE:
        contextText = getText("ce_ac_call_routine_txt");
        linkTail = "CALL " + keyword;
        break;
      case ZONE_TYPE.STYLE_LOC:
        contextText = getText("ce_ac_style_option_txt");
        linkTail = "STYLE%28" + keyword + "%29%22";
        break;
      case ZONE_TYPE.STYLE_ELEMENT:
        contextText = getText("ce_ac_style_option_txt");
        linkTail = "STYLE " + keyword;
        break;
      case ZONE_TYPE.STYLE_ATTR:
        contextText = getText("ce_ac_style_option_txt");
        linkTail = "STYLE " + keyword;
        break;
      // case ZONE_TYPE.MACRO_STMT:
      // contextText = 'MACRO STATEMENT';
      // linkTail = '%22' + keyword + '+STATEMENT%22';
      // break;
      default: //zone;
        contextText = "";
        linkTail = keyword.replace("%", "");
    }

    keyword = this._genKeywordLink(content, zone, linkTail);

    // const sasReleaseParam = "fq=releasesystem%3AViya&";
    // productDocumentation =
    //   "<a href = 'https://support.sas.com/en/search.html?" +
    //   sasReleaseParam +
    //   "fq=siteArea%3ADocumentation&q=" +
    //   linkTail +
    //   "' target = '_blank'>" +
    //   getText("ce_ac_product_documentation_txt") +
    //   "</a>";
    // sasNote =
    //   "<a href = 'https://support.sas.com/en/search.html?" +
    //   sasReleaseParam +
    //   "fq=siteArea%3A%22Samples%20%26%20SAS%20Notes%22&q=" +
    //   linkTail +
    //   "' target = '_blank'>" +
    //   getText("ce_ac_samples_and_sas_notes_txt") +
    //   "</a>";
    // papers =
    //   "<a href = 'https://support.sas.com/en/search.html?" +
    //   sasReleaseParam +
    //   "fq=siteArea%3A%22Papers%20%26%20Proceedings%22&q=" +
    //   linkTail +
    //   "' target = '_blank'>" +
    //   getText("ce_ac_papers_txt") +
    //   "</a>";

    contextText = contextText.toUpperCase();
    if (contextText === "") {
      contextText = "\n\n";
    } else {
      contextText =
        "\\\n**" +
        getText("ce_ac_context_txt") +
        " [" +
        contextText +
        "] " +
        _getContextMain(
          zone,
          _cleanUpKeyword(
            /*_getOptionName(tmpHintInfo)*/ content.key.toUpperCase(),
          ),
        ) +
        "**\n\n";
    }
    if (content.alias && content.alias.length) {
      alias =
        "\\\n" + getText("ce_ac_alias_txt") + " " + content.alias.join(", ");
    }
    help = "&lt;no help>";
    if (content.data) {
      if (content.supportSite) {
        help = "";
        if (content.syntax) {
          if (content.syntax.indexOf("\n") !== -1) {
            // multi-lines
            help =
              "```\n" +
              getText("ce_ac_syntax_txt") +
              " " +
              content.syntax +
              "\n```\n\n";
          } else {
            help = getText("ce_ac_syntax_txt") + " " + content.syntax + "\n\n";
          }
        }
        help +=
          '<span style="white-space:pre-wrap;">' + content.data + "</span>";
      } else {
        help = content.data.replace(/</g, "&lt;");
      }
    }
    return (
      getText("ce_ac_keyword_txt") + "  " + keyword + alias + contextText + help
      // "\n<br />" +
      // getText("ce_ac_search_txt") +
      // "   " +
      // productDocumentation +
      // "     " +
      // sasNote +
      // "     " +
      // papers
    );
  }

  private _notifyOptValue(
    cb: (data?: (string | LibCompleteItem)[]) => void,
    data: OptionValues | undefined,
    optName: string,
  ) {
    if (data) {
      if (this.loader.isColorType(data.type)) {
        this.popupContext.zone = ZONE_TYPE.COLOR;
        data.values = data.values.map((value: string) => value.slice(0, -9));
      } else if (this.loader.isDataSetType(data.type)) {
        if (optName !== this.popupContext.optName) {
          cb(undefined);
          return;
        }
        this.popupContext.zone = ZONE_TYPE.LIB;
        let libref = this._findLibRef();
        if (libref) {
          libref = libref.toUpperCase();
          for (let i = 0; i < data.values.length; i++) {
            const libItem: LibCompleteItem = data.values[i] as any;
            if (libref === libItem.name.toUpperCase()) {
              this.loader.getDataSetNames(libItem.id, cb);
              return;
            }
          }
          data.values = [];
        } else {
          const datasetList = this._getDatasetNames() as any;
          this.popupContext.datasetList = datasetList;
          data.values = data.values.concat(datasetList);
        }
      } // else if (!this.loader.isDataSetType(data.type) && libref) {
      // wrong guess, should not popup
      //  cb(undefined);
      //  return;
      //}
      cb(data.values);
      this.popupContext.datasetList = undefined;
    } else {
      cb(undefined);
    }
  }

  private _getZone(position: Position) {
    this.popupContext.position = position;
    this.popupContext.prefix = this._getPrefix(position);
    const zone = this.czMgr.getCurrentZone(position.line, position.character);
    this.popupContext.zone =
      this.popupContext.prefix.startsWith("&") &&
      zone !== ZONE_TYPE.COMMENT &&
      zone !== ZONE_TYPE.DATALINES
        ? ZONE_TYPE.MACRO_VAR
        : zone;
  }

  private _getPrefix(position: Position) {
    const textBeforeCaret = this.model
        .getLine(position.line)
        .substring(0, position.character),
      lastWorldStart = textBeforeCaret.search(
        /[%&](\w|[^\x00-\xff])*$|(\w|[^\x00-\xff])+$/, // eslint-disable-line no-control-regex
      );
    return lastWorldStart === -1
      ? ""
      : textBeforeCaret.substring(lastWorldStart);
  }

  private _findLibRef() {
    const pos = this.popupContext.position;
    const syntax = this.syntaxProvider.getSyntax(pos.line),
      count = syntax.length;
    let end, libref;
    for (let i = count - 1; i > 0; i--) {
      if (syntax[i].start < pos.character) {
        const line = this.model.getLine(pos.line);
        if (!syntax[i + 1]) {
          end = line.length - 1;
        } else {
          end = syntax[i + 1].start - 1;
        }
        if (syntax[i].style === "format") {
          // data=<libref>.
          libref = line.slice(syntax[i].start, end);
        } else {
          // data=<libref>.|...
          const dotIndex = line.slice(syntax[i].start, end).indexOf(".");
          if (
            dotIndex > 0 &&
            syntax[i].start + dotIndex < pos.character &&
            line.slice(pos.character - 1, pos.character) !== " "
          ) {
            libref = line.slice(syntax[i].start, syntax[i].start + dotIndex);
          }
        }
        break;
      }
    }
    return libref;
  }

  private _getDatasetNames() {
    const datasetList = [];
    let flag = 0;
    for (let line = 0; line < this.model.getLineCount(); line++) {
      const syntax = this.syntaxProvider.getSyntax(line),
        lineText = this.model.getLine(line),
        count = syntax.length;
      for (let i = 0; i < count; i++) {
        const token =
          i + 1 < count
            ? lineText.slice(syntax[i].start, syntax[i + 1].start)
            : lineText.slice(syntax[i].start);
        if (
          syntax[i].style === "comment" ||
          syntax[i].style === "macro-comment" || // just comment, do nothing
          (syntax[i].style === "text" &&
            (token === "" || token.search(/\s/) !== -1))
        ) {
          // just blanks, do nothing
        } else if (
          flag === 0 &&
          syntax[i].style === "sec-keyword" &&
          token.toUpperCase() === "DATA"
        ) {
          flag = 1; // found data
        } else if (
          flag === 1 &&
          syntax[i].style === "text" &&
          token.toUpperCase() !== "_NULL_"
        ) {
          datasetList.push({ name: token, type: "DATA" });
        } else if (flag === 1 && syntax[i].style === "sep" && token === "(") {
          flag = 2; // dataset options
        } else if (flag === 2) {
          if (syntax[i].style === "sep" && token === ")") {
            flag = 1;
          }
        } else {
          flag = 0;
        }
      }
    }
    return datasetList;
  }

  private _getMacroVar() {
    const macroVarList = [];
    let flag = 0,
      varName = "";
    for (let line = 0; line < this.model.getLineCount(); line++) {
      const syntax = this.syntaxProvider.getSyntax(line),
        lineText = this.model.getLine(line),
        count = syntax.length;
      for (let i = 0; i < count; i++) {
        const token =
          i + 1 < count
            ? lineText.slice(syntax[i].start, syntax[i + 1].start)
            : lineText.slice(syntax[i].start);
        if (
          syntax[i].style === "comment" ||
          syntax[i].style === "macro-comment" || // just comment, do nothing
          (syntax[i].style === "text" &&
            (token === "" || token.search(/\s/) !== -1))
        ) {
          // just blanks, do nothing
        } else if (
          flag === 0 &&
          syntax[i].style === "macro-keyword" &&
          token.toUpperCase() === "%LET"
        ) {
          flag = 1; // Found %let
        } else if (flag === 1 && syntax[i].style === "text") {
          varName = token;
          flag = 2; // found variable name
        } else if (flag === 2 && syntax[i].style === "sep" && token === "=") {
          flag = 3; // wait for ;
        } else if (flag === 3) {
          // anything between = and ; are considered as macro variable value
          if (syntax[i].style === "sep" && token === ";") {
            macroVarList.push(varName);
            flag = 0;
          }
        } else if (
          flag === 0 &&
          syntax[i].style === "keyword" &&
          token.toUpperCase() === "CALL"
        ) {
          flag = 4; // found call
        } else if (
          flag === 4 &&
          syntax[i].style === "text" &&
          token.toUpperCase() === "SYMPUT"
        ) {
          flag = 5; // found symput
        } else if (flag === 5 && syntax[i].style === "sep" && token === "(") {
          flag = 6; // found (
        } else if (flag === 6 && syntax[i].style === "string") {
          varName = token.replace(/['"]/g, "");
          flag = 7; // found variable name
        } else if (
          flag === 7 &&
          syntax[i].style === "sep" &&
          token === "," &&
          varName
        ) {
          flag = 3; // wait fot ;
        } else {
          flag = 0;
        }
      }
    }
    return macroVarList;
    /*var re = textarea.value.match(/%let\s+\w+(?=\s*=)/mgi);
      if (re) {
          re.forEach(function(item) {
              macroVarList.push(item.match(/%let\s+(\w+)/mi)[1]);
          });
      }
      re = textarea.value.match(/call\s+symput\s*\(\s*('\w+'|"\w+")(?=\s*,)/mgi);
      if (re) {
          re.forEach(function(item) {
              macroVarList.push(item.match(/call\s+symput\s*\(\s*['"](\w+)['"]/mi)[1]);
          });
      }*/
  }

  private _genKeywordLink(
    content: HelpData,
    zone: number,
    linkTail: string = "",
  ) {
    let addr =
      "https://support.sas.com/en/search.html?" +
      "fq=releasesystem%3AViya&" +
      "q=" +
      linkTail;
    if (content.supportSite) {
      addr =
        "https://documentation.sas.com/?docsetId=" +
        content.supportSite.docsetId +
        "&docsetVersion=" +
        content.supportSite.docsetVersion +
        "&docsetTarget=";
      if (
        zone === ZONE_TYPE.PROC_DEF ||
        zone === ZONE_TYPE.SAS_FUNC ||
        !content.supportSite.supportSiteTargetFile
      ) {
        addr += content.supportSite.docsetTargetFile;
      } else {
        addr += content.supportSite.supportSiteTargetFile;
        if (content.supportSite.supportSiteTargetFragment) {
          addr += "#" + content.supportSite.supportSiteTargetFragment;
        }
      }
    } else {
      addr = addr.replace(/\s/g, "%20");
    }
    // "<a href = '" +
    // addr +
    // "' target = '_blank'>" +
    // _cleanUpKeyword(content.key.toUpperCase()) +
    // "</a>";
    return "[" + _cleanUpKeyword(content.key.toUpperCase()) + "](" + addr + ")";
  }
}
