// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/explicit-module-boundary-types,
@typescript-eslint/no-unused-vars,@typescript-eslint/no-explicit-any,@typescript-eslint/dot-notation */
import { ResLoader } from "../node/ResLoader";
import { arrayToMap } from "./utils";

const getBaseUrl = () => "../..";

export interface HelpData {
  key: string;
  alias?: string[];
  data?: string;
  syntax?: string;
  arguments?: ArgumentData[];
  isGlobal?: boolean;
  supportSite?: {
    docsetId: string;
    docsetVersion: string;
    docsetTargetFile?: string;
    supportSiteTargetFile?: string;
    supportSiteTargetFragment?: string;
  };
}

export interface OptionValues {
  type: string;
  values: string[];
}

export interface LibCompleteItem {
  id: string;
  name: string;
  type: "DATA" | "VIEW" | "LIBRARY";
}

export type LibService = (
  libId: string | null,
  resolve: (items: LibCompleteItem[]) => void,
) => void;

interface SupportSiteInformation {
  docsetId: string;
  docsetVersion: string;
  docsetTargetFile: string;
}

interface FunctionData {
  name: string;
  description?: string;
  syntax?: { help: string; arguments?: ArgumentData[] };
  supportSiteInformation?: SupportSiteInformation;
}

interface ArgumentData {
  name: string;
  description: string;
  placeholder?: boolean;
  optional?: boolean;
  dataTypes?: string[];
  supportSiteTargetFragment?: string;
}

interface StatementOption {
  name: string;
  type: string;
  aliases?: string[];
  arguments?: StatementOption[];
  followsDelimiter?: string;
  description?: string;
  help?: string;
  placeholder?: boolean;
  supportSiteTargetFragment?: string;
  supportSiteInformation?: SupportSiteInformation;
}

interface Statement {
  name: string;
  aliases?: string[];
  arguments?: StatementOption[];
  description?: string;
  help?: string;
  supportSiteTargetFile?: string;
  supportSiteInformation?: SupportSiteInformation;
}

interface Procedure {
  name: string;
  statements?: Statement[];
  supportSiteInformation?: SupportSiteInformation;
  interactive?: boolean;
}

const db: any = {
    procOpts: {},
    procStmts: {},
    kwPool: {},
    stmts: {},
    functions: {},
    sasColors: [],
  },
  ID_HELP = "_$help",
  ID_TYPE = "_$type",
  ID_OPTS = "_$options",
  ID_OPTS_REQ = "_$optionsReq",
  ID_VALS = "_$values",
  ID_STMTS = "_$stms",
  ID_HAS_OPT_DELIMITER = "_$hasOptDelimiter",
  ID_SUB_OPTS = "_$subOpts",
  ID_KEYWORDS = "_$keywords",
  ID_ALIAS = "_$alias",
  ID_ATTR = "_$attr",
  ID_SYNTAX = "_$syntax",
  ID_ARGUMENTS = "_$arguments",
  ID_SUPPORT_SITE = "_$supportSite",
  stmtTable = arrayToMap([
    "ABORT",
    "ARRAY",
    "ATTRIB",
    "AXIS",
    "ENDRSUBMIT",
    "FILE",
    "FILENAME",
    "FOOTNOTE",
    "FORMAT",
    "GOPTIONS",
    "INFILE",
    "INFORMAT",
    "KILLTASK",
    "LEGEND",
    "LIBNAME",
    "LISTTASK",
    "LOCK",
    "NOTE",
    "ODS",
    "OPTIONS",
    "PATTERN",
    "RDISPLAY",
    "RGET",
    "RSUBMIT",
    "RUN",
    "SIGNOFF",
    "SIGNON",
    "SYMBOL",
    "SYSTASK",
    "TITLE",
    "CAS",
    "CASLIB",
    "WAITFOR",
    "WHERE",
    "DATA-SET",
    "DATA-STEP",
  ]),
  procTable = arrayToMap([
    "MACRO",
    "ODS",
    "DATA",
    "STATGRAPH",
    "DEFINE_TAGSET",
    "DEFINE_EVENT",
  ]);
let libService: LibService;

// Utilities
function _uniq(arr: any[]) {
  const a = [],
    o: any = {},
    len = arr.length;
  if (len < 2) {
    return arr;
  }
  for (let i = 0; i < len; i++) {
    const v = arr[i];
    if (!o[v]) {
      a.push(v);
      o[v] = true;
    }
  }
  return a;
}

function _notify<T>(cb: ((arg0: T) => void) | null | undefined, data: T) {
  if (cb) {
    setTimeout(function () {
      cb(data);
    }, 0);
  }
  return data;
}

function _obj(root: any, ...other: any[]) {
  let i = 0,
    obj = root;
  for (; obj && (other[i] !== undefined || other[i + 1] !== undefined); i++) {
    obj = obj[other[i]];
  }
  return obj;
}

function _removeEqu(name: string) {
  return name.replace("=", "");
}
function _cleanName(name: string) {
  const matched = /^\((.*)\)$/.exec(name);
  if (matched) {
    return matched[1];
  } else {
    return name.replace(/(\(.*\))|=/g, "");
  }
}
function _resolveAliasFromPubs(alias: string, item: { name: string }) {
  const cloneItem = JSON.parse(JSON.stringify(item)); // deep clone
  cloneItem.name = alias;
  const index = cloneItem.aliases.indexOf(alias);
  cloneItem.aliases.splice(index, 1, item.name);
  return cloneItem;
}
function _resolveAlias(name: string, pool: string) {
  return pool.split("|").filter(function (item) {
    return item && _removeEqu(item) !== name;
  });
}

function _stmtOptSupportSite(
  context: string,
  stmtName: string,
  optName: string,
) {
  let supportSite = _procStmtObj(context, stmtName)[ID_SUPPORT_SITE];
  if (supportSite) {
    const optionSite = _procStmtObj(context, stmtName, optName)[
      ID_SUPPORT_SITE
    ];
    if (optionSite && optionSite.docsetTargetFile) {
      return optionSite;
    }
    supportSite = Object.assign({}, supportSite);
    supportSite.supportSiteTargetFile = supportSite.docsetTargetFile;
    supportSite.supportSiteTargetFragment = optionSite;
  }
  return supportSite;
}

function _procOptSupportSite(procName: string, optName: string) {
  let supportSite = _procOptObj(procName)[ID_SUPPORT_SITE];
  if (supportSite) {
    supportSite = Object.assign({}, supportSite);
    supportSite.supportSiteTargetFragment = _procOptObj(
      procName,
      _removeEqu(optName),
    )[ID_SUPPORT_SITE];
  }
  return supportSite;
}

function _procStmtOptSupportSite(
  procName: string,
  stmtName: string,
  optName: string,
) {
  let supportSite = _procOptObj(procName)[ID_SUPPORT_SITE];
  if (supportSite) {
    supportSite = Object.assign({}, supportSite);
    supportSite.supportSiteTargetFile = _procStmtObj(procName, stmtName)[
      ID_SUPPORT_SITE
    ];
    supportSite.supportSiteTargetFragment = _procStmtObj(
      procName,
      stmtName,
      optName,
    )[ID_SUPPORT_SITE];
  }
  return supportSite;
}

function _procOptObj(
  procName: string,
  optName?: string,
  valName?: string,
  subOptName?: string,
) {
  if (optName) {
    optName = _removeEqu(optName);
  }
  if (subOptName) {
    subOptName = _removeEqu(subOptName);
  }
  return _obj(db.procOpts, procName, optName, valName, subOptName);
}

function _procStmtObj(
  procName: string,
  stmtName?: string,
  optName?: string,
  valName?: string,
  subOptName?: string,
) {
  if (optName) {
    optName = _cleanName(optName);
  }
  if (subOptName) {
    subOptName = _removeEqu(subOptName);
  }
  return _obj(db.procStmts, procName, stmtName, optName, valName, subOptName);
}

function _keywordObj(type: string, name?: string) {
  return _obj(db.kwPool, type, name);
}

function _stmtObj(
  stmtName: string,
  optName?: string,
  valName?: string,
  subOptName?: string,
) {
  if (optName) {
    optName = _removeEqu(optName);
  }
  return _obj(db.stmts, stmtName, optName, valName, subOptName);
}

function _funcObj(funcName: string, context: string) {
  return _obj(db.functions, context, funcName);
}

const Type2File: Record<string, string> = {
  formats: "SASFormats.json",
  informats: "SASInformats.json",
  "macro-func": "SASMacroFunctions.json",
  "macro-stmt": "SASMacroStatements.json",
  "macro-def-opt": "MacroDefinitionOptions.json",
  "ods-tagsets": "ODS_Tagsets.json",
  "auto-var": "SASAutoVariables.json",
  "autocall-macro": "SASAutocallMacros.json",
  "arm-macro": "SASARMMacros.json",
  "call-routines": "SASCallRoutines.json",
  "hash-pack-method": "HashPackageMethods.json",
  "stat-kw": "StatisticsKeywords.json",
  "style-loc": "StyleLocations.json",
  "style-att": "StyleAttributes.json",
  "style-ele": "StyleElements.json",
  func: "SASFunctions.json",
  "ds-stmt": "SASDataStepStatements.json",
  "ds-option": "SASDataSetOptions.json",
  "gbl-stmt": "SASGlobalStatements.json",
  "gbl-proc-stmt": "SASGlobalProcedureStatements.json",
  proc: "SASProcedures.json",
  "datastep-option": "SASDataStepOptions.json",
  "datastep-option2": "SASDataStepOptions2.json",
  sql: "SQLKeywords.json",
};
function _resolveURL(type: string) {
  let url = getBaseUrl() + "/data/";
  if (Type2File[type]) {
    url += Type2File[type];
  } else {
    return null;
  }
  return url;
}

function _getSubOptKeywords(obj: any, data: string) {
  //obj must be an object
  const keywords = data.split("|");
  if (!obj[ID_KEYWORDS]) {
    obj[ID_KEYWORDS] = [];
  }
  const list = obj[ID_KEYWORDS];
  keywords.forEach(function (item) {
    item =
      typeof item === "string"
        ? item.trim()
        : item !== null
          ? String(item).trim()
          : "";
    if (item === "") {
      return;
    }
    obj[_removeEqu(item)] = true;
    list.push(item);
  });
  return obj;
}

function _getHelp(data: { [x: string]: any }) {
  return data ? data["#cdata"] : "";
}

function _iterateValues(
  values: { [x: string]: string },
  tooltips: { [x: string]: any } | null,
  cb: {
    (i: any, name: any, tooltip: any): void;
    (arg0: number, arg1: any, arg2: any): void;
  },
) {
  let i = 1,
    j = 0,
    name = "@Value" + i,
    names;
  while (values[name]) {
    names = values[name].split("|");
    for (j = 0; j < names.length; j++) {
      cb(j, names[j], tooltips ? tooltips["@ToolTip" + i] : undefined);
    }
    i++;
    name = "@Value" + i;
  }
}

function _iterateKeywords(
  keywords: any[],
  cb: {
    (i: any, name: any, data: any): void;
    (arg0: number, arg1: any, arg2: any): void;
  },
) {
  const count = keywords.length;
  for (let i = 0; i < count; i++) {
    if (!keywords[i]["Name"]) {
      continue;
    }
    const names = keywords[i].Name.split("|");
    for (let j = 0; j < names.length; j++) {
      cb(i, names[j], keywords[i]);
    }
  }
}

function _tryToLoad<T>(config: {
  userCb: ((data: T) => void) | null | undefined;
  getData: () => T;
  needToLoad: () => boolean;
  load: (cb?: () => void) => void;
}) {
  if (!config.needToLoad()) {
    //data is ready
    return _notify(config.userCb, config.getData());
  } else {
    // data is not ready
    const async = !!config.userCb;
    if (async) {
      // async mode
      config.load(function () {
        config.userCb?.(config.getData());
      });
    } else {
      config.load();
      return config.getData();
    }
  }
}

// Sas Colors
function _setColors(values: any) {
  _iterateValues(values, null, function (i: any, name: any, tooltip: any) {
    db.sasColors.push(name);
  });
}
function _loadColors(cb: () => void) {
  const url = getBaseUrl() + "/data/SASColorValues.json";
  ResLoader.get(
    url,
    function (data: { Color: { Values: any } }) {
      if (data && data.Color) {
        _setColors(data.Color.Values);
        if (cb) {
          cb();
        }
      }
    },
    !!cb,
  ); //if cb exists, use async mode
}
function _sasColorsLoaded() {
  return db.sasColors.length > 0;
}

function _tryToLoadColors(userCb: any) {
  return _tryToLoad({
    userCb: userCb,
    getData: function () {
      return db.sasColors;
    },
    needToLoad: function () {
      return !_sasColorsLoaded();
    },
    load: function (cb: any) {
      _loadColors(cb);
    },
  });
}

function _getFunctionHelp(funcName: string, context: string, userCb?: any) {
  return _tryToLoadFunctionsFromPubs(context, userCb, function () {
    let data = _funcObj(funcName, context);
    if (data) {
      data = {
        key: funcName,
        data: data[ID_HELP],
        syntax: data[ID_SYNTAX],
        arguments: data[ID_ARGUMENTS],
        supportSite: data[ID_SUPPORT_SITE],
      };
    }
    return data;
  });
}
function _setFunctionsFromPubs(data: FunctionData[], context: string) {
  if (!db.functions[context]) {
    db.functions[context] = {};
  }
  const list: string[] = [];
  data.forEach(function (fun) {
    list.push(fun.name);
    db.functions[context][fun.name] = {};
    db.functions[context][fun.name][ID_HELP] = fun.description;
    db.functions[context][fun.name][ID_SYNTAX] = fun.syntax && fun.syntax.help;
    db.functions[context][fun.name][ID_ARGUMENTS] =
      fun.syntax && fun.syntax.arguments;
    db.functions[context][fun.name][ID_SUPPORT_SITE] =
      fun.supportSiteInformation;
  });
  db.functions[context][ID_KEYWORDS] = list;
}
function _loadFunctionsFromPubs(context: string, cb?: () => void) {
  const url = getBaseUrl() + "/pubsdata/Functions/en/" + context + ".json";
  ResLoader.get(
    url,
    function (data?: FunctionData[]) {
      if (data && data.length) {
        _setFunctionsFromPubs(data, context);
        if (cb) {
          cb();
        }
      }
    },
    !!cb,
  ); //if cb exists, use async mode
}
function _FunctionsLoadedFromPubs(context: string) {
  return db.functions[context];
}
function _tryToLoadFunctionsFromPubs<T>(
  context: string,
  userCb: ((data: T) => void) | null | undefined,
  getDataFunc: () => T,
) {
  return _tryToLoad({
    userCb: userCb,
    getData: getDataFunc,
    needToLoad: function () {
      return !_FunctionsLoadedFromPubs(context);
    },
    load: function (cb) {
      _loadFunctionsFromPubs(context, cb);
    },
  });
}

function _loadProceduresFromPubs(cb?: () => void) {
  const url = getBaseUrl() + "/pubsdata/procedures.json";
  ResLoader.get(
    url,
    function (data?: string[]) {
      if (data && data.length) {
        if (db.kwPool["proc"] === undefined) {
          db.kwPool.proc = {};
        }
        data.forEach(function (item) {
          db.kwPool["proc"][item] = {};
        });
        db.kwPool["proc"][ID_KEYWORDS] = data;
        if (cb) {
          cb();
        }
      }
    },
    !!cb,
  ); //if cb exists, use async mode
}
function _tryToLoadProceduresFromPubs<T>(
  userCb: ((data: T) => void) | null | undefined,
  getDataFunc: () => T,
) {
  return _tryToLoad({
    userCb: userCb,
    getData: getDataFunc,
    needToLoad: function () {
      return !_keywordLoaded("proc");
    },
    load: function (cb) {
      _loadProceduresFromPubs(cb);
    },
  });
}

// Statements
function _setStatementOptionValueHelp(
  stmtName: string,
  optName: string,
  valName: string,
  help: string,
) {
  if (db.stmts[stmtName][optName][valName] === undefined) {
    db.stmts[stmtName][optName][valName] = {};
  }
  db.stmts[stmtName][optName][valName][ID_HELP] = help;
}

function _setStatementOptionValues(
  stmtName: string,
  optName: string,
  values: any,
  tooltips: any,
) {
  const list: string[] = [];
  _iterateValues(
    values,
    tooltips,
    function (i: any, name: string, tooltip: any) {
      list.push(name);
      if (tooltips) {
        _setStatementOptionValueHelp(
          stmtName,
          optName,
          name.toUpperCase(),
          tooltip,
        );
      }
    },
  );
  db.stmts[stmtName][optName][ID_VALS] = list;
}
function _setStatementOptionHelp(stmtName: string, optName: string, data: any) {
  db.stmts[stmtName][optName][ID_HELP] = _getHelp(data);
}
function _setStatementOptionType(stmtName: string, optName: string, data: any) {
  db.stmts[stmtName][optName][ID_TYPE] = data;
}
function _setStatementOptionAlias(
  stmtName: string,
  optName: string,
  data: any,
) {
  db.stmts[stmtName][optName][ID_ALIAS] = _resolveAlias(optName, data);
}
function _setStatementSubOptions(stmtName: string, optName: string, data: any) {
  const list = db.stmts[stmtName][optName][ID_SUB_OPTS] || {};
  _getSubOptKeywords(list, data);
  db.stmts[stmtName][optName][ID_SUB_OPTS] = list;
}
function _setStatementOption(
  stmtName: string,
  optName: string,
  data: {
    Help: any;
    Type: any;
    Name: any;
    Values: any;
    ToolTips: any;
    SubOptionsKeywords: any;
  },
) {
  optName = _removeEqu(optName);
  if (db.stmts[stmtName][optName] === undefined) {
    db.stmts[stmtName][optName] = {};
  }
  _setStatementOptionHelp(stmtName, optName, data.Help);
  _setStatementOptionType(stmtName, optName, data.Type);
  _setStatementOptionAlias(stmtName, optName, data.Name);
  if (data.Values) {
    _setStatementOptionValues(stmtName, optName, data.Values, data.ToolTips);
  }
  if (data.SubOptionsKeywords) {
    _setStatementSubOptions(stmtName, optName, data.SubOptionsKeywords);
  }
}

function _setStatementOptions(stmtName: string, keywords: any) {
  const list: string[] = [];
  if (db.stmts[stmtName] === undefined) {
    db.stmts[stmtName] = {};
  }
  _iterateKeywords(keywords, function (i: any, name: any, data: any) {
    list.push(name);
    _setStatementOption(stmtName, name, data);
  });
  db.stmts[stmtName][ID_OPTS] = list;
}

function _loadStatementOptions(stmtName: string, cb: () => void) {
  let url = getBaseUrl() + "/data/";
  if (stmtName === "DATA-SET") {
    url += "SASDataSetOptions";
  } else if (stmtName === "DATA-STEP") {
    url += "SASDataStepOptions";
  } else {
    url += "Statements/" + stmtName.toUpperCase();
  }
  url += ".json";
  ResLoader.get(
    url,
    function (data: { Keywords: { Keyword: any } }) {
      if (data && data.Keywords) {
        _setStatementOptions(stmtName, data.Keywords.Keyword);
        if (cb) {
          cb();
        }
      }
    },
    !!cb,
  );
}

function _statementLoaded(stmtName: string) {
  return db.stmts[stmtName];
}

function _tryToLoadStatementOptions(
  stmtName: string,
  userCb: any,
  getDataFunc: { (): any },
) {
  return _tryToLoad({
    userCb: userCb,
    getData: getDataFunc,
    needToLoad: function () {
      return stmtTable[stmtName] && !_statementLoaded(stmtName);
    },
    load: function (cb: any) {
      _loadStatementOptions(stmtName, cb);
    },
  });
}

function _getStatementHelp(
  context: string,
  stmtName: string,
  userCb?: (data?: HelpData) => void,
) {
  return _tryToLoadStatementsFromPubs(context, userCb, function () {
    let data = _procStmtObj(context, stmtName);
    if (data) {
      data = {
        key: stmtName,
        data: data[ID_HELP],
        alias: data[ID_ALIAS],
        syntax: data[ID_SYNTAX],
        supportSite: data[ID_SUPPORT_SITE],
      };
    }
    return data;
  });
}
function _setStatementsFromPubs(data: Statement[], context: string) {
  if (!db.procStmts[context]) {
    db.procStmts[context] = {};
  }
  const list: string[] = [];
  data.forEach(function (stmt) {
    const stmtName = stmt.name;
    list.push(stmtName);
    if (db.procStmts[context][stmtName] === undefined) {
      db.procStmts[context][stmtName] = {};
      db.procStmts[context][stmtName][ID_HAS_OPT_DELIMITER] = false;
    }
    db.procStmts[context][stmtName][ID_HELP] = stmt.description;
    db.procStmts[context][stmtName][ID_SYNTAX] = stmt.help;
    db.procStmts[context][stmtName][ID_SUPPORT_SITE] =
      stmt.supportSiteInformation;
    db.procStmts[context][stmtName][ID_ALIAS] = stmt.aliases;
    const opts = stmt.arguments;
    if (opts && opts.length) {
      _setProcedureStatementOptionsFromPubs(context, stmtName, opts);
    }
    if (stmt.aliases) {
      stmt.aliases.forEach(function (alias: string) {
        list.push(alias);
        db.procStmts[context][alias] = JSON.parse(
          JSON.stringify(db.procStmts[context][stmtName]),
        ); // deep clone
        db.procStmts[context][alias][ID_ALIAS] = _resolveAliasFromPubs(
          alias,
          stmt,
        ).aliases;
      });
    }
  });
  db.procStmts[context][ID_STMTS] = list;
}
function _loadStatementsFromPubs(context: string, cb?: () => void) {
  const url = getBaseUrl() + "/pubsdata/Statements/en/" + context + ".json";
  ResLoader.get(
    url,
    function (data?: Statement[]) {
      if (data && data.length) {
        _setStatementsFromPubs(data, context);
        if (cb) {
          cb();
        }
      }
    },
    !!cb,
  ); //if cb exists, use async mode
}
function _StatementsLoadedFromPubs(context: string) {
  return db.procStmts[context];
}
function _tryToLoadStatementsFromPubs<T>(
  context: string,
  userCb: ((data: T) => void) | null | undefined,
  getDataFunc: () => T,
) {
  return _tryToLoad({
    userCb: userCb,
    getData: getDataFunc,
    needToLoad: function () {
      return !_StatementsLoadedFromPubs(context);
    },
    load: function (cb) {
      _loadStatementsFromPubs(context, cb);
    },
  });
}

// Keywords
function _setKeywordHelp(type: string, name: string, data: any) {
  db.kwPool[type][name][ID_HELP] = _getHelp(data);
}
function _setKeywordAlias(type: string, name: string, data: any) {
  db.kwPool[type][name][ID_ALIAS] = _resolveAlias(name, data);
}
function _setKeywordAttr(type: string, name: string, data: string) {
  db.kwPool[type][name][ID_ATTR] = data;
}
function _setKeyword(
  type: string,
  name: string,
  data: { Help: any; Name: any; Attributes: any },
) {
  if (db.kwPool[type][name] === undefined) {
    db.kwPool[type][name] = {};
  }
  _setKeywordHelp(type, name, data.Help);
  _setKeywordAlias(type, name, data.Name);
  _setKeywordAttr(type, name, data.Attributes);
}
function _setKeywords(type: string, keywords: any) {
  const list: string[] = [];
  if (db.kwPool[type] === undefined) {
    db.kwPool[type] = {};
  }
  _iterateKeywords(keywords, function (i: any, name: any, data: any) {
    list.push(name);
    _setKeyword(type, _removeEqu(name).toUpperCase(), data);
  });
  db.kwPool[type][ID_KEYWORDS] = list;
}

function _loadKeywords(type: string, cb: any) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const url = _resolveURL(type)!;
  ResLoader.get(
    url,
    function (data: { Keywords: { Keyword: any } }) {
      if (data && data.Keywords) {
        _setKeywords(type, data.Keywords.Keyword);
        if (cb) {
          cb();
        }
      }
    },
    !!cb,
  );
}
function _keywordLoaded(type: string) {
  return db.kwPool[type];
}

function _tryToLoadKeywords(
  type: string,
  userCb: any,
  getDataFunc: { (): any },
) {
  return _tryToLoad({
    userCb: userCb,
    getData: getDataFunc,
    needToLoad: function () {
      return !_keywordLoaded(type);
    },
    load: function (cb: any) {
      _loadKeywords(type, cb);
    },
  });
}

function _getKeywords(type: string, userCb: any) {
  return _tryToLoadKeywords(type, userCb, function () {
    let data = _keywordObj(type);
    if (data) {
      data = data[ID_KEYWORDS];
    }
    return data;
  });
}
function _getKeywordHelp(name: string, type: string, userCb: any) {
  return _tryToLoadKeywords(type, userCb, function () {
    let data = _keywordObj(type, _removeEqu(name).toUpperCase());
    if (data) {
      data = { key: name, data: data[ID_HELP], alias: data[ID_ALIAS] };
    }
    return data;
  });
}

// Procedures
function _loadProcedureFromPubs(procName: string, cb?: () => void) {
  const url = getBaseUrl() + "/pubsdata/Procedures/en/" + procName + ".json";
  ResLoader.get(
    url,
    function (data: Procedure) {
      if (data && data.statements) {
        _setProcedureFromPubs(
          procName,
          data.statements,
          data.supportSiteInformation,
        );
        if (data.interactive) {
          _setKeywordAttr("proc", data.name, "InteractivePROC");
        }
        if (cb) {
          cb();
        }
      }
    },
    !!cb,
  );
}
function _loadProcedure(procName: string, cb?: () => void) {
  if (procTable[procName]) {
    const url = getBaseUrl() + "/data/Procedures/" + procName + ".json";
    return ResLoader.get(
      url,
      function (data: { Procedure: any }) {
        if (data && data.Procedure) {
          _setProcedure(procName, data.Procedure);
          if (cb) {
            cb();
          }
        }
      },
      !!cb,
    );
  }
  return _loadProcedureFromPubs(procName, cb);
}

function _procedureLoaded(procName: string) {
  return db.procStmts[procName];
}

function _tryToLoadProcedure<T>(
  procName: string,
  userCb: ((data: T) => void) | null | undefined,
  getDataFunc: () => T,
) {
  return _tryToLoad({
    userCb: userCb,
    getData: getDataFunc,
    needToLoad: function () {
      const procs = _tryToLoadProceduresFromPubs(null, function () {
        return _keywordObj("proc");
      });
      return (
        procs &&
        (procs[procName] || procTable[procName]) &&
        !_procedureLoaded(procName)
      );
    },
    load: function (cb) {
      _loadProcedure(procName, cb);
    },
  });
}

function _setProcedureFromPubs(
  procName: string,
  data: Statement[],
  supportSite?: SupportSiteInformation,
) {
  if (db.procOpts[procName] === undefined) {
    db.procOpts[procName] = {};
  }
  if (db.procStmts[procName] === undefined) {
    db.procStmts[procName] = {};
  }
  if (data[0]) {
    if (supportSite) {
      db.procOpts[procName][ID_SUPPORT_SITE] = {
        ...supportSite,
        supportSiteTargetFile: data[0].supportSiteTargetFile,
      };
    }
    _setProcedureHelpFromPubs(procName, data[0]);
    const opts = data[0].arguments;
    if (opts && opts.length) {
      _setProcedureOptionsFromPubs(procName, opts);
    }
  }
  data.splice(0, 1);
  if (data.length) {
    _setProcedureStatementsFromPubs(procName, data);
  }
}
function _setProcedure(
  procName: string,
  data: { ProcedureHelp: any; ProcedureOptions: any; ProcedureStatements: any },
) {
  if (db.procOpts[procName] === undefined) {
    db.procOpts[procName] = {};
  }
  if (db.procStmts[procName] === undefined) {
    db.procStmts[procName] = {};
  }
  _setProcedureHelp(procName, data.ProcedureHelp);
  if (data.ProcedureOptions) {
    let opts = data.ProcedureOptions;
    if (!(opts instanceof Array)) {
      opts = [opts];
    }
    opts.forEach(function (item: { ProcedureOption: any }) {
      _setProcedureOptions(procName, item.ProcedureOption);
    });
  }
  if (data.ProcedureStatements) {
    let stmts = data.ProcedureStatements;
    if (!(stmts instanceof Array)) {
      stmts = [stmts];
    }
    stmts.forEach(function (item: { ProcedureStatement: any }) {
      if (item) {
        _setProcedureStatements(procName, item.ProcedureStatement);
      }
    });
  }
}
function _setProcedureHelpFromPubs(procName: string, data: Statement) {
  db.procOpts[procName][ID_HELP] = data.description;
  db.procOpts[procName][ID_SYNTAX] = data.help;
}
function _setProcedureHelp(procName: string, data: any) {
  // data is json format
  db.procOpts[procName][ID_HELP] = _getHelp(data);
}
function _setProcedureOptionHelpFromPubs(
  procName: string,
  optName: string,
  data: StatementOption,
) {
  db.procOpts[procName][optName][ID_HELP] = data.description;
  db.procOpts[procName][optName][ID_SYNTAX] = data.help;
  db.procOpts[procName][optName][ID_SUPPORT_SITE] =
    data.supportSiteTargetFragment;
}
function _setProcedureOptionHelp(procName: string, optName: string, data: any) {
  db.procOpts[procName][optName][ID_HELP] = _getHelp(data);
}
function _setProcedureOptionType(
  procName: string,
  optName: string,
  data: string,
) {
  db.procOpts[procName][optName][ID_TYPE] = data;
}
function _setProcedureOptionAliasFromPubs(
  procName: string,
  optName: string,
  data?: string[],
) {
  db.procOpts[procName][optName][ID_ALIAS] = data;
}
function _setProcedureOptionAlias(
  procName: string,
  optName: string,
  data: any,
) {
  db.procOpts[procName][optName][ID_ALIAS] = _resolveAlias(optName, data);
}
function _setProcedureOptionSubOptKeywordsFromPubs(
  procName: string,
  optName: string,
  data: StatementOption[],
) {
  const list = db.procOpts[procName][optName][ID_SUB_OPTS] || {};
  if (!list[ID_KEYWORDS]) {
    list[ID_KEYWORDS] = [];
  }
  data.forEach(function (arg) {
    if (arg.placeholder || arg.type === "standalone") {
      return;
    }
    const name = arg.name;
    list[ID_KEYWORDS].push(name);
    list[_removeEqu(name)] = true;
    if (db.procOpts[procName][optName][name] === undefined) {
      db.procOpts[procName][optName][name] = {};
    }
    if (arg.description) {
      db.procOpts[procName][optName][name][ID_HELP] = arg.description;
    }
  });
  db.procOpts[procName][optName][ID_SUB_OPTS] = list;
}
function _setProcedureOptionSubOptKeywords(
  procName: string,
  optName: string,
  data: any,
) {
  //db.procOpts[procName][optName][ID_SUB_OPTS] = _getSubOptKeywords(data);;
  //we store all sub option keywords in single place
  const list = db.procOpts[procName][optName][ID_SUB_OPTS] || {};
  _getSubOptKeywords(list, data);
  db.procOpts[procName][optName][ID_SUB_OPTS] = list;
}
function _setProcedureOptionValueHelp(
  procName: string,
  optName: string,
  valName: string,
  data: string,
) {
  db.procOpts[procName][optName][valName][ID_HELP] = data;
}
function _setProcedureOptionValueFromPubs(
  procName: string,
  optName: string,
  val: StatementOption,
) {
  const name = val.name.toUpperCase();
  if (db.procOpts[procName][optName][name] === undefined) {
    db.procOpts[procName][optName][name] = {};
  }
  db.procOpts[procName][optName][name][ID_ALIAS] = val.aliases;
  if (val.description) {
    _setProcedureOptionValueHelp(procName, optName, name, val.description);
  }
}
function _setProcedureOptionValuesFromPubs(
  procName: string,
  optName: string,
  values: StatementOption[],
) {
  const list: string[] = [];
  values.forEach(function (val) {
    if (val.placeholder || val.type !== "standalone") {
      return;
    }
    const name = val.name;
    list.push(name);
    _setProcedureOptionValueFromPubs(procName, optName, val);
    if (val.aliases && val.aliases.length) {
      val.aliases.forEach(function (alias) {
        list.push(alias);
        _setProcedureOptionValueFromPubs(
          procName,
          optName,
          _resolveAliasFromPubs(alias, val),
        );
      });
    }
  });

  db.procOpts[procName][optName][ID_VALS] = list;
}
function _setProcedureOptionValues(
  procName: string,
  optName: string,
  values: any,
  tooltips: any,
) {
  const list: string[] = [];
  _iterateValues(
    values,
    tooltips,
    function (i: any, name: string, tooltip: any) {
      list.push(name);
      if (db.procOpts[procName][optName][name] === undefined) {
        db.procOpts[procName][optName][name] = {};
      }
      if (tooltip) {
        _setProcedureOptionValueHelp(procName, optName, name, tooltip);
      }
    },
  );

  db.procOpts[procName][optName][ID_VALS] = list;
}
function _setProcedureOptionFromPubs(procName: string, data: StatementOption) {
  const optName = _removeEqu(data.name).toUpperCase();
  if (db.procOpts[procName][optName] === undefined) {
    db.procOpts[procName][optName] = {};
  }
  _setProcedureOptionHelpFromPubs(procName, optName, data);
  _setProcedureOptionType(procName, optName, data.type);
  _setProcedureOptionAliasFromPubs(procName, optName, data.aliases);
  const args = data.arguments;
  if (args && args.length) {
    //if (data.type === 'choice') {
    _setProcedureOptionValuesFromPubs(procName, optName, args);
    _setProcedureOptionSubOptKeywordsFromPubs(procName, optName, args);
  }
}
function _setProcedureOption(
  procName: string,
  optName: string,
  data: {
    ProcedureOptionHelp: any;
    ProcedureOptionType: any;
    ProcedureOptionName: any;
    SubOptionsKeywords: any;
    ProcedureOptionValues: any;
    ProcedureOptionToolTips: any;
  },
) {
  optName = _removeEqu(optName);
  if (db.procOpts[procName][optName] === undefined) {
    db.procOpts[procName][optName] = {};
  }
  _setProcedureOptionHelp(procName, optName, data.ProcedureOptionHelp);
  _setProcedureOptionType(procName, optName, data.ProcedureOptionType);
  _setProcedureOptionAlias(procName, optName, data.ProcedureOptionName);
  if (data.SubOptionsKeywords) {
    _setProcedureOptionSubOptKeywords(
      procName,
      optName,
      data.SubOptionsKeywords,
    );
  }
  if (data.ProcedureOptionValues) {
    _setProcedureOptionValues(
      procName,
      optName,
      data.ProcedureOptionValues,
      data.ProcedureOptionToolTips,
    );
  }
}
function _setProcedureOptionsFromPubs(
  procName: string,
  data: StatementOption[],
) {
  const keywords: string[] = [];
  data.forEach(function (item) {
    if (!item.placeholder) {
      _setProcedureOptionFromPubs(procName, item);
      keywords.push(item.name);
      if (item.aliases && item.aliases.length) {
        item.aliases.forEach(function (alias) {
          _setProcedureOptionFromPubs(
            procName,
            _resolveAliasFromPubs(alias, item),
          );
          keywords.push(alias);
        });
      }
    }
  });
  db.procOpts[procName][ID_OPTS] = keywords;
}
function _setProcedureOptions(procName: string, data: any[]) {
  if (data) {
    let keywords: string[] = [];
    if (!(data instanceof Array)) {
      data = [data];
    }
    for (let i = 0; i < data.length; i++) {
      if (!data[i]["ProcedureOptionName"]) {
        continue;
      }
      const names = data[i]["ProcedureOptionName"].split("|");
      if (names[names.length - 1] === "") {
        names.pop();
      }
      for (let j = 0; j < names.length; j++) {
        _setProcedureOption(procName, names[j], data[i]);
      }

      keywords = keywords.concat(names);
    }
    db.procOpts[procName][ID_OPTS] = keywords;
  }
}
function _setProcedureStatementHelpFromPubs(
  procName: string,
  stmtName: string,
  data: Statement,
) {
  db.procStmts[procName][stmtName][ID_HELP] = data.description;
  db.procStmts[procName][stmtName][ID_SYNTAX] = data.help;
  db.procStmts[procName][stmtName][ID_SUPPORT_SITE] =
    data.supportSiteTargetFile;
}
function _setProcedureStatementHelp(
  procName: string,
  stmtName: string,
  data: any,
) {
  db.procStmts[procName][stmtName][ID_HELP] = _getHelp(data);
}
function _setProcedureStatementAliasFromPubs(
  procName: string,
  stmtName: string,
  data?: string[],
) {
  db.procStmts[procName][stmtName][ID_ALIAS] = data;
}
function _setProcedureStatementAlias(
  procName: string,
  stmtName: string,
  data: any,
) {
  db.procStmts[procName][stmtName][ID_ALIAS] = _resolveAlias(stmtName, data);
}
function _setProcedureStatementOptionFromPubs(
  procName: string,
  stmtName: string,
  data: StatementOption,
) {
  const optName = _cleanName(data.name).toUpperCase(); //optName.replace('=','');
  if (db.procStmts[procName][stmtName][optName] === undefined) {
    db.procStmts[procName][stmtName][optName] = {};
  }
  _setProcedureStatementOptionHelpFromPubs(procName, stmtName, optName, data);
  _setProcedureStatementOptionType(procName, stmtName, optName, data.type);
  _setProcedureStatementOptionAliasFromPubs(
    procName,
    stmtName,
    optName,
    data.aliases,
  );
  const args = data.arguments;
  if (args && args.length) {
    //if (data.type === 'choice') {
    _setProcedureStatementOptionValuesFromPubs(
      procName,
      stmtName,
      optName,
      args,
    );
    //} else {
    _setProcedureStatementSubOptKeywordsFromPubs(
      procName,
      stmtName,
      optName,
      args,
    );
    //}
  }
}
function _setProcedureStatementOption(
  procName: string,
  stmtName: string,
  optName: string,
  data: {
    StatementOptionHelp: any;
    StatementOptionType: any;
    StatementOptionName: any;
    SubOptionsKeywords: any;
    StatementOptionValues: any;
    StatementOptionToolTips: any;
  },
) {
  optName = _cleanName(optName); //optName.replace('=','');
  if (db.procStmts[procName][stmtName][optName] === undefined) {
    db.procStmts[procName][stmtName][optName] = {};
  }
  _setProcedureStatementOptionHelp(
    procName,
    stmtName,
    optName,
    data.StatementOptionHelp,
  );
  _setProcedureStatementOptionType(
    procName,
    stmtName,
    optName,
    data.StatementOptionType,
  );
  _setProcedureStatementOptionAlias(
    procName,
    stmtName,
    optName,
    data.StatementOptionName,
  );
  if (data.SubOptionsKeywords) {
    _setProcedureStatementSubOptKeywords(
      procName,
      stmtName,
      optName,
      data.SubOptionsKeywords,
    );
  }
  if (data.StatementOptionValues) {
    //StatementOptionValues
    _setProcedureStatementOptionValues(
      procName,
      stmtName,
      optName,
      data.StatementOptionValues,
      data.StatementOptionToolTips,
    );
  }
}
function _setProcedureStatementOptionHelpFromPubs(
  procName: string,
  stmtName: string,
  optName: string,
  data: StatementOption,
) {
  db.procStmts[procName][stmtName][optName][ID_HELP] = data.description;
  db.procStmts[procName][stmtName][optName][ID_SYNTAX] = data.help;
  db.procStmts[procName][stmtName][optName][ID_SUPPORT_SITE] =
    data.supportSiteTargetFragment || data.supportSiteInformation;
}
function _setProcedureStatementOptionHelp(
  procName: string,
  stmtName: string,
  optName: string,
  data: any,
) {
  db.procStmts[procName][stmtName][optName][ID_HELP] = _getHelp(data);
}
function _setProcedureStatementOptionType(
  procName: string,
  stmtName: string,
  optName: string,
  data: string,
) {
  db.procStmts[procName][stmtName][optName][ID_TYPE] = data;
}
function _setProcedureStatementOptionAliasFromPubs(
  procName: string,
  stmtName: string,
  optName: string,
  data?: string[],
) {
  db.procStmts[procName][stmtName][optName][ID_ALIAS] = data;
}
function _setProcedureStatementOptionAlias(
  procName: string,
  stmtName: string,
  optName: string,
  data: any,
) {
  db.procStmts[procName][stmtName][optName][ID_ALIAS] = _resolveAlias(
    optName,
    data,
  );
}
function _setProcedureStatementSubOptKeywordFromPubs(
  procName: string,
  stmtName: string,
  optName: string,
  subOptName: string,
  arg: StatementOption,
) {
  if (db.procStmts[procName][stmtName][optName][subOptName] === undefined) {
    db.procStmts[procName][stmtName][optName][subOptName] = {};
  }
  if (arg.description) {
    db.procStmts[procName][stmtName][optName][subOptName][ID_HELP] =
      arg.description;
  }
  if (arg.help) {
    db.procStmts[procName][stmtName][optName][subOptName][ID_SYNTAX] = arg.help;
  }
  if (arg.aliases) {
    db.procStmts[procName][stmtName][optName][subOptName][ID_ALIAS] =
      arg.aliases;
  }
}
function _setProcedureStatementSubOptKeywordsFromPubs(
  procName: string,
  stmtName: string,
  optName: string,
  data: StatementOption[],
) {
  const list = db.procStmts[procName][stmtName][optName][ID_SUB_OPTS] || {};
  if (!list[ID_KEYWORDS]) {
    list[ID_KEYWORDS] = [];
  }
  data.forEach(function (arg) {
    if (arg.placeholder || arg.type === "standalone") {
      return;
    }
    const name = arg.name;
    list[ID_KEYWORDS].push(name);
    list[_removeEqu(name)] = true;
    _setProcedureStatementSubOptKeywordFromPubs(
      procName,
      stmtName,
      optName,
      name,
      arg,
    );
    if (arg.aliases) {
      arg.aliases.forEach(function (alias) {
        list[ID_KEYWORDS].push(alias);
        list[_removeEqu(alias)] = true;
        _setProcedureStatementSubOptKeywordFromPubs(
          procName,
          stmtName,
          optName,
          alias,
          _resolveAliasFromPubs(alias, arg),
        );
      });
    }
  });
  db.procStmts[procName][stmtName][optName][ID_SUB_OPTS] = list;
}
function _setProcedureStatementSubOptKeywords(
  procName: string,
  stmtName: string,
  optName: string,
  data: any,
) {
  //db.procStmts[procName][stmtName][optName][ID_SUB_OPTS] = _getSubOptKeywords(data);
  //we store all sub option keywords in single place
  const list = db.procStmts[procName][stmtName][optName][ID_SUB_OPTS] || {};
  _getSubOptKeywords(list, data);
  db.procStmts[procName][stmtName][optName][ID_SUB_OPTS] = list;
}
function _setProcedureStatementOptionValueHelp(
  procName: string,
  stmtName: string,
  optName: string,
  valName: string,
  data: string,
) {
  db.procStmts[procName][stmtName][optName][valName][ID_HELP] = data;
}
function _setProcedureStatementOptionValueFromPubs(
  procName: string,
  stmtName: string,
  optName: string,
  val: StatementOption,
) {
  const name = val.name.toUpperCase();
  if (db.procStmts[procName][stmtName][optName][name] === undefined) {
    db.procStmts[procName][stmtName][optName][name] = {};
  }
  db.procStmts[procName][stmtName][optName][name][ID_ALIAS] = val.aliases;
  if (val.description) {
    _setProcedureStatementOptionValueHelp(
      procName,
      stmtName,
      optName,
      name,
      val.description,
    );
  }
}
function _setProcedureStatementOptionValuesFromPubs(
  procName: string,
  stmtName: string,
  optName: string,
  values: StatementOption[],
) {
  const list: string[] = [];
  values.forEach(function (val) {
    if (val.placeholder || val.type !== "standalone") {
      return;
    }
    const name = val.name;
    list.push(name);
    _setProcedureStatementOptionValueFromPubs(procName, stmtName, optName, val);
    if (val.aliases && val.aliases.length) {
      val.aliases.forEach(function (alias) {
        list.push(alias);
        _setProcedureStatementOptionValueFromPubs(
          procName,
          stmtName,
          optName,
          _resolveAliasFromPubs(alias, val),
        );
      });
    }
  });

  db.procStmts[procName][stmtName][optName][ID_VALS] = list;
}
function _setProcedureStatementOptionValues(
  procName: string,
  stmtName: string,
  optName: string,
  values: any,
  tooltips: any,
) {
  const list: string[] = [];
  _iterateValues(
    values,
    tooltips,
    function (i: any, name: string, tooltip: any) {
      list.push(name);
      if (db.procStmts[procName][stmtName][optName][name] === undefined) {
        db.procStmts[procName][stmtName][optName][name] = {};
      }
      if (tooltips) {
        _setProcedureStatementOptionValueHelp(
          procName,
          stmtName,
          optName,
          name,
          tooltip,
        );
      }
    },
  );

  db.procStmts[procName][stmtName][optName][ID_VALS] = list;
}
function _setProcedureStatementOptionsFromPubs(
  procName: string,
  stmtName: string,
  data: StatementOption[],
) {
  let keywords: string[] = [],
    keywordsReq: string[] = [];
  data.forEach(function (item) {
    if (!item.placeholder) {
      _setProcedureStatementOptionFromPubs(procName, stmtName, item);
      if (item.followsDelimiter) {
        keywords.push(item.name);
      } else {
        keywordsReq.push(item.name);
      }
      if (item.aliases && item.aliases.length) {
        item.aliases.forEach(function (alias) {
          _setProcedureStatementOptionFromPubs(
            procName,
            stmtName,
            _resolveAliasFromPubs(alias, item),
          );
          if (item.followsDelimiter) {
            keywords.push(alias);
          } else {
            keywordsReq.push(alias);
          }
        });
      }
    }
  });
  if (keywords.length > 0) {
    db.procStmts[procName][stmtName][ID_HAS_OPT_DELIMITER] = true;
  } else {
    keywords = keywordsReq;
    keywordsReq = [];
  }
  db.procStmts[procName][stmtName][ID_OPTS] = keywords;
  db.procStmts[procName][stmtName][ID_OPTS_REQ] = keywordsReq;
}
function _setProcedureStatementOptions(
  procName: string,
  stmtName: string,
  data: any[],
) {
  if (data) {
    let keywords: string[] = [];
    if (!(data instanceof Array)) {
      data = [data];
    }
    for (let i = 0; i < data.length; i++) {
      let names = data[i]["StatementOptionName"];
      if (!names) {
        continue;
      }
      names = names.split("|");
      if (names[names.length - 1] === "") {
        names.pop();
      }
      for (let j = 0; j < names.length; j++) {
        _setProcedureStatementOption(procName, stmtName, names[j], data[i]);
      }
      keywords = keywords.concat(names);
    }
    db.procStmts[procName][stmtName][ID_OPTS] = keywords;
  }
}
function _setProcedureStatementFromPubs(
  procName: string,
  stmtName: string,
  data: Statement,
) {
  if (db.procStmts[procName][stmtName] === undefined) {
    db.procStmts[procName][stmtName] = {};
    db.procStmts[procName][stmtName][ID_HAS_OPT_DELIMITER] = false;
  }
  _setProcedureStatementHelpFromPubs(procName, stmtName, data);
  _setProcedureStatementAliasFromPubs(procName, stmtName, data.aliases);
  const opts = data.arguments;
  if (opts && opts.length) {
    _setProcedureStatementOptionsFromPubs(procName, stmtName, opts);
  }
}
function _setProcedureStatement(
  procName: string,
  stmtName: string,
  data: {
    StatementHelp: any;
    StatementName: any;
    StatementOptions: { StatementOption: any };
  },
) {
  if (db.procStmts[procName][stmtName] === undefined) {
    db.procStmts[procName][stmtName] = {};
  }
  _setProcedureStatementHelp(procName, stmtName, data.StatementHelp);
  _setProcedureStatementAlias(procName, stmtName, data.StatementName);
  if (data.StatementOptions) {
    _setProcedureStatementOptions(
      procName,
      stmtName,
      data.StatementOptions.StatementOption,
    );
  }
}
function _setProcedureStatementsFromPubs(procName: string, data: Statement[]) {
  const keywords: string[] = [];
  data.forEach(function (item) {
    const stmtName = _removeEqu(item.name.toUpperCase());
    _setProcedureStatementFromPubs(procName, stmtName, item);
    if (item.aliases) {
      item.aliases.forEach((alias) => {
        keywords.push(alias);
        db.procStmts[procName][alias] = Object.assign(
          {},
          db.procStmts[procName][stmtName],
        );
        db.procStmts[procName][alias][ID_ALIAS] = _resolveAliasFromPubs(
          alias,
          item,
        ).aliases;
      });
    }
    keywords.push(item.name);
  });
  db.procStmts[procName][ID_STMTS] = keywords;
}
function _setProcedureStatements(procName: string, data: any[]) {
  if (data) {
    let keywords: string[] = [];
    if (!(data instanceof Array)) {
      data = [data];
    }
    for (let i = 0; i < data.length; i++) {
      let names = data[i]["StatementName"];
      if (!names) {
        continue;
      }
      names = names.split("|");
      if (names[names.length - 1] === "") {
        names.pop();
      }
      for (let j = 0; j < names.length; j++) {
        _setProcedureStatement(
          procName,
          _removeEqu(names[j].toUpperCase()),
          data[i],
        );
      }
      keywords = keywords.concat(names);
    }
    db.procStmts[procName][ID_STMTS] = keywords;
  }
}
function _loadProcedureImmediately(procName: string) {
  if (_procOptObj(procName)) {
    return;
  } //for performance
  _tryToLoadProcedure(procName, null, function () {
    return _procOptObj(procName);
  });
}
function _loadKeywordsImmediately(type: string) {
  if (_keywordObj(type)) {
    return;
  }
  _tryToLoadKeywords(type, null, function () {
    return _keywordObj(type);
  });
}
function _tryToLoadStatementOptionsImmediately(stmtName: string) {
  if (_stmtObj(stmtName)) {
    return;
  }
  _tryToLoadStatementOptions(stmtName, null, function () {
    return _stmtObj(stmtName);
  });
}

export class SyntaxDataProvider {
  noGlobal: boolean | undefined;

  // private functions
  private _handleOptionValues(
    data: OptionValues,
    cb?: (data: OptionValues) => void,
  ) {
    // support async behavior
    if (this.isColorType(data.type)) {
      // color value
      data.values = this.getSasColors();
      _notify(cb, data);
    } else if (this.isDataSetType(data.type)) {
      // library value
      this.getLibraryList(cb, data.type); // It always is asynchronous
    } else {
      _notify(cb, data);
    }
    return data;
  }
  /* ************************************************************************
   * PUBLIC INTERFACES
   * ************************************************************************/
  setLibService(fn: LibService) {
    libService = fn;
  }
  /*
   *  If cb is valid, the call will work in asynchronous mode;
   *  if cb is invalid, the call will work in synchronous mode.
   */
  getProcedures(cb: (data: string[]) => void) {
    //return _loadKeywords(/*'procedures'*/'proc', cb);
    return _tryToLoadProceduresFromPubs(cb, function () {
      let data = _keywordObj("proc");
      if (data) {
        data = data[ID_KEYWORDS];
      }
      return data;
    });
  }

  getProcedureHelp(procName: string, cb: (data: HelpData) => void) {
    procName = procName.toUpperCase();
    return _tryToLoadProcedure(procName, cb, function () {
      let data = _procOptObj(procName);
      if (data) {
        data = {
          data: data[ID_HELP],
          key: procName,
          syntax: data[ID_SYNTAX],
          supportSite: data[ID_SUPPORT_SITE],
        };
      }
      return data;
    });
  }
  getProcedureOptions(procName: string, cb: (data?: string[]) => void) {
    procName = procName.toUpperCase();
    return _tryToLoadProcedure(procName, cb, function () {
      let data = _procOptObj(procName);
      if (data) {
        data = data[ID_OPTS];
      }
      return data;
    });
  }
  getProcedureOptionHelp(
    procName: string,
    optName: string,
    cb: (data?: HelpData) => void,
  ) {
    procName = procName.toUpperCase();
    optName = optName.toUpperCase();
    return _tryToLoadProcedure(procName, cb, function () {
      let data = _procOptObj(procName, _removeEqu(optName));
      if (data) {
        data = {
          data: data[ID_HELP],
          key: optName,
          alias: data[ID_ALIAS],
          syntax: data[ID_SYNTAX],
          supportSite: _procOptSupportSite(procName, optName),
        };
      }
      return data;
    });
  }
  getProcedureOptionType(procName: string, optName: string) {
    procName = procName.toUpperCase();
    optName = optName.toUpperCase();
    return _tryToLoadProcedure(procName, null, function () {
      let data = _procOptObj(procName, _removeEqu(optName));
      if (data) {
        data = data[ID_TYPE];
      }
      return data;
    });
  }
  getProcedureOptionValueHelp(
    procName: string,
    optName: string,
    valName: string,
    cb: (data?: HelpData) => void,
  ) {
    return _tryToLoadProcedure(procName, cb, function () {
      procName = procName.toUpperCase();
      optName = optName.toUpperCase();
      valName = valName.toUpperCase();
      let data = _procOptObj(procName, optName, valName);
      if (data) {
        data = {
          key: valName,
          data: data[ID_HELP],
          alias: data[ID_ALIAS],
          supportSite: _procOptSupportSite(procName, optName),
        };
      }
      return data;
    });
  }
  getProcedureOptionValues(
    procName: string,
    optName: string,
    cb: (data: OptionValues) => void,
  ) {
    let ret = _tryToLoadProcedure(procName, null, () => {
      //sync
      procName = procName.toUpperCase();
      optName = optName.toUpperCase();
      let data = _procOptObj(procName, optName);
      if (data) {
        const type = this.getProcedureOptionType(procName, optName);
        data = { type: type, values: data[ID_VALS] };
      }
      return data;
    });
    if (ret) {
      ret = this._handleOptionValues(ret, cb);
    }
    return ret;
  }
  getProcedureSubOptions(
    procName: string,
    optName: string,
    cb: (data: string[]) => void,
  ) {
    return _tryToLoadProcedure(procName, cb, function () {
      procName = procName.toUpperCase();
      optName = optName.toUpperCase();
      let data = _procOptObj(procName, optName, ID_SUB_OPTS);

      data = data ? data[ID_KEYWORDS] : [];

      return data;
    });
  }
  getProcedureSubOptionHelp(
    procName: string,
    optName: string,
    subOptName: string,
    cb: (data?: HelpData) => void,
  ) {
    return _tryToLoadProcedure(procName, cb, function () {
      procName = procName.toUpperCase();
      optName = optName.toUpperCase();
      subOptName = subOptName.toUpperCase();
      let data = _procOptObj(procName, optName, subOptName);
      if (data) {
        data = {
          key: subOptName,
          data: data[ID_HELP],
          alias: data[ID_ALIAS],
          syntax: data[ID_SYNTAX],
          supportSite: _procOptSupportSite(procName, optName),
        };
      }
      return data;
    });
  }
  getProcedureStatements(procName: string, cb?: (data: string[]) => void) {
    procName = procName.toUpperCase();
    return _tryToLoadProcedure(procName, cb, () => {
      let data = _procStmtObj(procName);
      if (data) {
        data = data[ID_STMTS]; // data[ID_STMTS] can be undefined
      }
      if (!data) {
        data = [];
      }
      if (!this.noGlobal) {
        const gps = this.getGlobalProcedureStatements();
        if (gps) {
          data = data.concat(gps);
          data = _uniq(data);
        }
      }
      return data.length > 0 ? data : null;
    });
  }
  getProcedureStatementHelp(
    procName: string,
    stmtName: string,
    cb?: (data: HelpData) => void,
  ) {
    procName = procName.toUpperCase();
    stmtName = stmtName.toUpperCase();
    return _tryToLoadProcedure(procName, cb, () => {
      let data = _procStmtObj(procName, stmtName);
      if (data) {
        let supportSite = _procOptObj(procName)[ID_SUPPORT_SITE];
        if (supportSite) {
          supportSite = Object.assign({}, supportSite);
          supportSite.supportSiteTargetFile = data[ID_SUPPORT_SITE];
        }
        data = {
          key: stmtName,
          data: data[ID_HELP],
          alias: data[ID_ALIAS],
          syntax: data[ID_SYNTAX],
          supportSite: supportSite,
        };
      } else {
        data = this.getKeywordHelp(stmtName, null, "gbl-proc-stmt");
        if (data) {
          data.isGlobal = true;
        }
      }
      return data;
    });
  }
  getProcedureStatementOptions(
    procName: string,
    stmtName: string,
    cb: (data: string[]) => void,
    req?: boolean,
  ) {
    procName = procName.toUpperCase();
    stmtName = stmtName.toUpperCase();
    return _tryToLoadProcedure(procName, cb, () => {
      let data = _procStmtObj(procName, stmtName);
      if (data) {
        data = req ? data[ID_OPTS_REQ] : data[ID_OPTS];
      } else {
        data = this.getStatementOptions("global", stmtName, undefined, req);
      }
      return data;
    });
  }
  getProcedureStatementOptionHelp(
    procName: string,
    stmtName: string,
    optName: string,
    cb?: (data?: HelpData) => void,
  ) {
    procName = procName.toUpperCase();
    stmtName = stmtName.toUpperCase();
    optName = optName.toUpperCase();
    return _tryToLoadProcedure(procName, cb, () => {
      let data = _procStmtObj(procName, stmtName, optName);
      if (data) {
        data = {
          key: optName,
          data: data[ID_HELP],
          alias: data[ID_ALIAS],
          syntax: data[ID_SYNTAX],
          supportSite: _procStmtOptSupportSite(procName, stmtName, optName),
        };
      } else {
        data = this.getStatementOptionHelp("global", stmtName, optName);
      }
      return data;
    });
  }
  getProcedureStatementOptionType(
    procName: string,
    stmtName: string,
    optName: string,
  ) {
    procName = procName.toUpperCase();
    stmtName = stmtName.toUpperCase();
    optName = optName.toUpperCase();
    return _tryToLoadProcedure(procName, null, () => {
      let data = _procStmtObj(procName, stmtName, optName);
      if (data) {
        data = data[ID_TYPE];
      } else {
        data = this.getStatementOptionType(stmtName, optName);
      }

      return data;
    });
  }
  getProcedureStatementSubOptions(
    procName: string,
    stmtName: string,
    optName: string,
    cb: (data: string[]) => void,
  ) {
    procName = procName.toUpperCase();
    stmtName = stmtName.toUpperCase();
    optName = optName.toUpperCase();
    return _tryToLoadProcedure(procName, cb, () => {
      let data = _procStmtObj(procName, stmtName, optName, ID_SUB_OPTS);
      if (data) {
        data = data[ID_KEYWORDS];
      } else {
        data = this.getStatementSubOptions("global", stmtName, optName);
      }
      return data;
    });
  }
  getProcedureStatementSubOptionHelp(
    procName: string,
    stmtName: string,
    optName: string,
    subOptName: string,
    cb: (data?: HelpData) => void,
  ) {
    procName = procName.toUpperCase();
    stmtName = stmtName.toUpperCase();
    optName = optName && optName.toUpperCase();
    subOptName = subOptName && subOptName.toUpperCase();
    return _tryToLoadProcedure(procName, cb, () => {
      let data = _procStmtObj(procName, stmtName, optName, subOptName);
      if (data) {
        data = {
          key: subOptName,
          data: data[ID_HELP],
          alias: data[ID_ALIAS],
          syntax: data[ID_SYNTAX],
          supportSite: _procStmtOptSupportSite(procName, stmtName, optName),
        };
      } else {
        data = this.getStatementSubOptionHelp(
          "global",
          stmtName,
          optName,
          subOptName,
        );
      }

      return data;
    });
  }
  getProcedureStatementOptionValueHelp(
    procName: string,
    stmtName: string,
    optName: string,
    valName: string,
    cb?: (data?: HelpData) => void,
  ) {
    procName = procName.toUpperCase();
    stmtName = stmtName.toUpperCase();
    optName = optName && optName.toUpperCase();
    return _tryToLoadProcedure(procName, cb, () => {
      let data = _procStmtObj(procName, stmtName, optName, valName);
      if (data) {
        data = {
          key: valName,
          data: data[ID_HELP],
          alias: data[ID_ALIAS],
          supportSite: _procStmtOptSupportSite(procName, stmtName, optName),
        };
      } else {
        data = this.getStatementOptionValueHelp(
          "global",
          stmtName,
          optName,
          valName,
        );
      }

      return data;
    });
  }
  getProcedureStatementOptionValues(
    procName: string,
    stmtName: string,
    optName: string,
    cb: (data?: OptionValues) => void,
  ) {
    if (!optName) {
      cb(undefined);
      return null;
    }
    stmtName = stmtName.toUpperCase();
    procName = procName.toUpperCase();
    optName = optName.toUpperCase();
    let ret = _tryToLoadProcedure(procName, null, () => {
      //sync
      let data = _procStmtObj(procName, stmtName, optName);
      if (data) {
        const type = this.getProcedureStatementOptionType(
          procName,
          stmtName,
          optName,
        );
        data = { type: type, values: data[ID_VALS] };
      } else {
        data = this.getStatementOptionValues("global", stmtName, optName);
      }
      return data;
    });

    if (ret) {
      ret = this._handleOptionValues(ret, cb);
    } else {
      _notify(cb, ret);
    }
    return ret;
  }
  addUserDefinedAbbr(abbr: any) {
    //TODO:
  }
  getUserDefinedAbbr() {
    //TODO:
  }
  getFilenameOrLibnameOptions() {
    //TODO:
  }

  // access Statements/*.xml, mainly global statements or global procedure statements
  getStatementOptions(
    context: string,
    stmtName: string,
    cb?: (data: string[]) => void,
    req?: boolean,
  ) {
    stmtName = stmtName.toUpperCase();
    return _tryToLoadStatementsFromPubs(context, cb, function () {
      let data = _procStmtObj(context, stmtName);
      if (data) {
        data = req ? data[ID_OPTS_REQ] : data[ID_OPTS];
      }
      return data;
    });
  }
  // access Statements/*.xml, mainly global statements or global procedure statements
  getStatementOptionHelp(
    context: string,
    stmtName: string,
    optName: string,
    cb?: (data?: HelpData) => void,
  ) {
    return _tryToLoadStatementsFromPubs(context, cb, function () {
      stmtName = stmtName.toUpperCase();
      optName = optName && optName.toUpperCase();
      let data = _procStmtObj(context, stmtName, optName);
      if (data) {
        data = {
          key: optName,
          data: data[ID_HELP],
          alias: data[ID_ALIAS],
          syntax: data[ID_SYNTAX],
          supportSite: _stmtOptSupportSite(context, stmtName, optName),
        };
      }
      return data;
    });
  }
  getStatementOptionValueHelp(
    context: string,
    stmtName: string,
    optName: string,
    valName: string,
    cb?: (data?: HelpData) => void,
  ) {
    return _tryToLoadStatementsFromPubs(context, cb, function () {
      stmtName = stmtName.toUpperCase();
      optName = optName && optName.toUpperCase();
      valName = valName && valName.toUpperCase();
      let data = _procStmtObj(context, stmtName, optName, valName);
      if (data) {
        data = {
          key: valName,
          data: data[ID_HELP],
          alias: data[ID_ALIAS],
          supportSite: _stmtOptSupportSite(context, stmtName, optName),
        };
      }
      return data;
    });
  }
  // old data is still used by some places
  _getStatementOptionValueHelp(
    stmtName: string,
    optName: string,
    valName: string,
    cb: any,
  ) {
    return _tryToLoadStatementOptions(stmtName, cb, function () {
      stmtName = stmtName.toUpperCase();
      optName = optName && optName.toUpperCase();
      valName = valName.toUpperCase();
      let data = _stmtObj(stmtName, optName, valName);
      if (data) {
        data = { key: valName, data: data[ID_HELP] };
      }
      return data;
    });
  }
  getStatementOptionType(stmtName: string, optName: string, cb?: any) {
    return _tryToLoadStatementOptions(stmtName, cb, function () {
      stmtName = stmtName.toUpperCase();
      optName = optName.toUpperCase();
      let data = _stmtObj(stmtName, optName);
      if (data) {
        data = data[ID_TYPE];
      }
      return data;
    });
  }
  getStatementOptionValues(
    context: string,
    stmtName: string,
    optName: string,
    cb?: (data: OptionValues) => void,
  ) {
    let ret = _tryToLoadStatementsFromPubs(context, null, function () {
      stmtName = stmtName.toUpperCase();
      optName = optName && optName.toUpperCase();
      let data = _procStmtObj(context, stmtName, optName);
      if (data) {
        data = { type: data[ID_TYPE], values: data[ID_VALS] };
      }
      return data;
    });
    if (ret) {
      ret = this._handleOptionValues(ret, cb);
    } else {
      _notify(cb, ret);
    }
    return ret;
  }
  // old data is still used by some places
  _getStatementOptionValues(stmtName: string, optName: string, cb: any) {
    let ret = _tryToLoadStatementOptions(stmtName, null, () => {
      //sync
      stmtName = stmtName.toUpperCase();
      optName = optName && optName.toUpperCase();
      let data = _stmtObj(stmtName, optName);
      if (data) {
        const type = this.getStatementOptionType(stmtName, optName);
        data = { type: type, values: data[ID_VALS] };
      }
      return data;
    });

    if (ret) {
      ret = this._handleOptionValues(ret, cb);
    }
    return ret;
  }
  getStatementSubOptions(
    context: string,
    stmtName: string,
    optName: string,
    cb?: (data: string[]) => void,
  ) {
    return _tryToLoadStatementsFromPubs(context, cb, function () {
      stmtName = stmtName.toUpperCase();
      optName = optName && optName.toUpperCase();
      let data = _procStmtObj(context, stmtName, optName, ID_SUB_OPTS);
      if (data) {
        data = data[ID_KEYWORDS];
      } else {
        data = [];
      }
      return data;
    });
  }
  getStatementSubOptionHelp(
    context: string,
    stmtName: string,
    optName: string,
    subOptName: string,
    cb?: (data?: HelpData) => void,
  ) {
    return _tryToLoadStatementsFromPubs(context, cb, function () {
      stmtName = stmtName.toUpperCase();
      optName = optName && optName.toUpperCase();
      let data = _procStmtObj(context, stmtName, optName, subOptName);
      if (data) {
        data = {
          key: subOptName,
          data: data[ID_HELP],
          alias: data[ID_ALIAS],
          syntax: data[ID_SYNTAX],
          supportSite: _stmtOptSupportSite(context, stmtName, optName),
        };
      }
      return data;
    });
  }
  getDataStepOptions(cb?: (data: string[]) => void) {
    return _getKeywords("datastep-option", cb);
  }
  getDataStepOptionHelp(
    optName: string,
    cb: (data: HelpData) => void,
    type: string,
  ) {
    return _getKeywordHelp(optName, type, cb);
  }
  getDataStepOptionValueHelp(
    optName: string,
    valName: string,
    cb: (data?: HelpData) => void,
  ) {
    this.getStatementOptionValueHelp("datastep", "DATA", optName, valName, cb);
  }
  getDataStepOptionValues(optName: string, cb: (data: OptionValues) => void) {
    this.getStatementOptionValues("datastep", "DATA", optName, cb);
  }
  getDataSetOptionValueHelp(
    optName: string,
    valName: string,
    cb: (data: HelpData) => void,
  ) {
    this._getStatementOptionValueHelp("DATA-SET", optName, valName, cb);
  }
  getDataSetOptionValues(optName: string, cb: (data: OptionValues) => void) {
    this._getStatementOptionValues("DATA-SET", optName, cb);
  }
  // get all keyword's help, not only global statement, or global procedure statement
  getKeywordHelp(
    name: string,
    cb: ((data?: HelpData) => void) | null | undefined,
    type: string,
  ) {
    if (type === "func") {
      // from pubsdata
      const data = _getFunctionHelp(name, "base");
      return _notify(cb, data);
    }
    if (type === "macro-func") {
      // from pubsdata
      const data = _getFunctionHelp(name, "macro");
      return _notify(cb, data);
    }
    if (type === "gbl-proc-stmt") {
      const data = _getStatementHelp("global", name);
      return _notify(cb, data);
    }
    if (type === "gbl-stmt") {
      let data = _getStatementHelp("standalone", name);
      if (!data) {
        data = _getStatementHelp("global", name);
      }
      return _notify(cb, data);
    }
    if (type === "ds-stmt") {
      const data = _getStatementHelp("datastep", name);
      return _notify(cb, data);
    }
    if (type === "macro-stmt") {
      let data = _getStatementHelp("macro", name);
      if (!data) {
        data = _getStatementHelp("global", name);
      }
      return _notify(cb, data);
    }
    let data = _getKeywordHelp(name, type, null); //handle synchronously
    if (!data) {
      if (type === "datastep-option") {
        data = _getKeywordHelp(name, "datastep-option2", null);
      } else if (type === "ds-stmt") {
        data = _getKeywordHelp(name, "gbl-stmt", null);
      } else if (type === "macro-stmt") {
        data = _getKeywordHelp(name, "arm-macro", null);
      }
    }

    return _notify(cb, data);
  }
  // the name parameter can be the name of call routines or functions
  getContextPrompt(name: string, cb?: any) {
    //var url = Utils.getBaseUrl() + '/data/SASContextPrompt.json';
    //TODO:
  }
  getSasColors(cb?: any) {
    /*_loadKeywords('colorValues',cb);*/
    return _tryToLoadColors(cb);
  }
  //ODS tagsets
  getODSTagsets(cb?: (data: string[]) => void) {
    return _getKeywords(/*'ODSTagsets'*/ "ods-tagsets", cb);
  }
  //Style
  getStyleAttributes(cb?: (data: string[]) => void) {
    return _getKeywords(/*'styleAttributes'*/ "style-att", cb);
  }
  getStyleElements(cb?: (data: string[]) => void) {
    return _getKeywords(/*'styleElements'*/ "style-ele", cb);
  }
  getStyleLocations(cb?: (data: string[]) => void) {
    return _getKeywords(/*'styleLocations'*/ "style-loc", cb);
  }
  // macro
  getARMMacros(cb?: (data: string[]) => void) {
    return _getKeywords(/*'ARMMacros'*/ "arm-macro", cb);
  }
  getAutocallMacros(cb?: (data: string[]) => void) {
    return _getKeywords(/*'autocallMacros'*/ "autocall-macro", cb);
  }
  getAutoVariables(cb?: (data: string[]) => void) {
    return _getKeywords(/*'autoVariables'*/ "auto-var", cb);
  }
  getMacroDefinitionOptions(cb?: (data: string[]) => void) {
    return _getKeywords("macro-def-opt", cb);
  }
  getGlobalStatements(cb?: (data: string[]) => void) {
    const globalProcStatements = this.getGlobalProcedureStatements();
    return _tryToLoadStatementsFromPubs("standalone", cb, function () {
      const data = _procStmtObj("standalone");
      return data[ID_STMTS].concat(globalProcStatements);
    });
  }
  getGlobalProcedureStatements(cb?: (data: string[]) => void) {
    return _tryToLoadStatementsFromPubs("global", cb, function () {
      const data = _procStmtObj("global");
      return data[ID_STMTS];
    });
  }
  getMacroStatements(cb?: (data: string[]) => void) {
    return _tryToLoadStatementsFromPubs("macro", cb, function () {
      const data = _procStmtObj("macro");
      return data[ID_STMTS];
    });
  }
  getFunctions(cb?: (data: string[]) => void) {
    return _tryToLoadFunctionsFromPubs("base", cb, function () {
      const data = db.functions["base"][ID_KEYWORDS];
      return data;
    });
  }
  getCallRoutines(cb?: (data: string[]) => void) {
    return _getKeywords(/*'callRoutines'*/ "call-routines", cb);
  }
  getMacroFunctions(cb?: (data: string[]) => void) {
    return _tryToLoadFunctionsFromPubs("macro", cb, function () {
      const data = db.functions["macro"][ID_KEYWORDS];
      return data;
    });
  }
  getHashPackageMethods(cb?: (data: string[]) => void) {
    return _getKeywords(/*'hashPackageMethods'*/ "hash-pack-method", cb);
  }
  getFormats(cb?: (data: string[]) => void) {
    return _getKeywords("formats", cb);
  }
  getInformats(cb?: (data: string[]) => void) {
    return _getKeywords("informats", cb);
  }
  getStatisticsKeywords(cb?: (data: string[]) => void) {
    return _getKeywords(/*'statisticsKeywords'*/ "stat-kw", cb);
  }
  getDSStatements(cb?: (data: string[]) => void) {
    return _tryToLoadStatementsFromPubs("datastep", cb, function () {
      const data = _procStmtObj("datastep");
      return data[ID_STMTS];
    });
  }
  getDSOptions(cb?: (data: string[]) => void) {
    return _getKeywords(/*'datasetOptions'*/ "ds-option", cb);
  }
  getDSOptionHelp(optName: string, cb?: any) {
    return _getKeywordHelp(optName, "ds-option", cb);
  }
  getDS2Keywords() {
    //TODO:
  }
  getDS2Functions() {
    //TODO:
  }
  getLibraryList(cb: any, type: string) {
    if (typeof libService === "function") {
      libService(null, function (data) {
        _notify(cb, { values: data, type: type });
      });
    } else {
      _notify(cb, { values: [], type: type });
    }
  }
  getDataSetNames(libId: any, cb: any) {
    if (libId && typeof libService === "function") {
      libService(libId, function (data) {
        if (data && data.length !== 0) {
          _notify(cb, data);
          return;
        }
        _notify(cb, null);
      });
    } else {
      _notify(cb, null);
    }
  }
  getDocumentVariables() {
    //TODO:
  }
  getMacroDefinitions() {
    //TODO:
  }
  getMacroVariables() {
    //TODO:
  }
  hasOptionDelimiter(procName: string, stmtName: string) {
    let obj,
      ret = false;
    const help = this.getProcedureStatementHelp(procName, stmtName); // try to load

    if (help) {
      if (help.isGlobal) {
        obj = _procStmtObj("global", stmtName); //_keywordObj('gbl-proc-stmt',stmtName);
      } else {
        obj = _procStmtObj(procName, stmtName);
      }
      if (obj[ID_HAS_OPT_DELIMITER] === undefined) {
        obj[ID_HAS_OPT_DELIMITER] = /Syntax:(.|\n)*\/(.|\n)*;/i.test(
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          help.data!,
        );
      }
      ret = obj[ID_HAS_OPT_DELIMITER];
    }
    return ret;
  }

  isProcedureOptionKeyword(
    procName: string,
    optName: string,
    valName?: string,
  ) {
    _loadProcedureImmediately(procName);
    return !!_procOptObj(procName, optName, valName);
  }
  isProcedureSubOptKeyword(
    procName: string,
    optName: string,
    subOptName: string,
  ) {
    _loadProcedureImmediately(procName);
    return !!_procOptObj(procName, optName, ID_SUB_OPTS, subOptName);
    //return !!_procOptObj(procName, ID_SUB_OPTS, subOptName);
  }
  isProcedureStatementKeyword(
    procName: string,
    stmtName: string,
    optName?: string,
    valName?: string,
  ): boolean {
    if (procName === "SQL") {
      return this.isStatementKeyword("global", stmtName, optName, valName);
    }
    _loadProcedureImmediately(procName);
    let ret = _procStmtObj(procName, stmtName, optName, valName);
    if (stmtName && !ret) {
      // var type = 'gbl-proc-stmt';
      //NOTE: It seems that it is reasonable to use 'gbl-proc-stmt',
      // but the result is different form EG, so here we use 'gbl-stmt'.
      //var type = 'gbl-proc-stmt';
      //_loadKeywordsImmediately(type);
      //if (optName === undefined) {
      //    ret = _keywordObj(type, stmtName);
      //    if (!ret) {
      //        type = 'gbl-stmt';
      //        _loadKeywordsImmediately(type);
      //        ret = _keywordObj(type, stmtName);
      //    }
      //} else {
      //    if (_keywordObj(type, stmtName)) {
      ret = this.isStatementKeyword("global", stmtName, optName, valName);
      if (!ret && (procName === "" || procName === "DATA")) {
        const type = procName === "DATA" ? "datastep" : "standalone";
        ret = this.isStatementKeyword(type, stmtName, optName, valName);
      }
      //    }
      //}
    }
    return !!ret;
  }
  isProcedureStatementSubOptKeyword(
    procName: string,
    stmtName: string,
    optName: string,
    subOptName: string,
  ) {
    _loadProcedureImmediately(procName);
    return (
      !!_procStmtObj(procName, stmtName, optName, ID_SUB_OPTS, subOptName) ||
      !!_stmtObj(stmtName, optName, ID_SUB_OPTS, subOptName)
    );
    //return !!_procStmtObj(procName, stmtName, ID_SUB_OPTS, subOptName);
  }
  isStatementKeyword(
    context: string,
    stmtName: string,
    optName?: string,
    valName?: string,
  ): boolean {
    return !!_tryToLoadStatementsFromPubs(context, null, function () {
      return !!_procStmtObj(context, stmtName, optName, valName);
    });
  }
  _isStatementKeyword(stmtName: string, optName: string, valName?: string) {
    _tryToLoadStatementOptionsImmediately(stmtName);
    let ret = !!_stmtObj(stmtName, optName, valName);
    if (!ret && !optName) {
      const type = "gbl-stmt";
      _loadKeywordsImmediately(type);
      ret = !!_keywordObj(type, stmtName);
    }
    return ret;
  }
  isStatementSubOptKeyword(
    stmtName: string,
    optName: string,
    subOptName: string,
  ) {
    _tryToLoadStatementOptionsImmediately(stmtName);
    return !!_stmtObj(stmtName, optName, ID_SUB_OPTS, subOptName);
  }
  isDatasetKeyword(name: string) {
    const type = "ds-option";
    _loadKeywordsImmediately(type);
    return !!_keywordObj(type, name);
  }
  isSasFunction(name: string) {
    return _tryToLoadFunctionsFromPubs("base", null, function () {
      return db.functions["base"][ID_KEYWORDS].indexOf(name) !== -1;
    });
  }
  isDataSetType(type: string) {
    return /\bDV\b/.test(type) || type.toLowerCase() === "dataset";
  }
  isColorType(type: string) {
    return /\bC\b/.test(type) || type.toLowerCase() === "color";
  }
  isInteractiveProc(name: string) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    _tryToLoadProceduresFromPubs(null, function () {});
    const data = _keywordObj("proc", name);
    return data && data[ID_ATTR] === "InteractivePROC";
  }
}
