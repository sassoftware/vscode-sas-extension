// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Shared, dependency-free scanner for custom %macro definitions.
// It is used by the SAS LSP server (current document) and imported by LSP
// clients (e.g. the VS Code extension) to scan external .sas files, so that
// every client produces exactly the same CustomMacro data.

export interface CustomMacroParameter {
  name: string;
  keyword: boolean; // true for keyword parameters (name=), false for positional
  defaultValue?: string; // keyword parameter default, if any
}

export interface CustomMacro {
  name: string; // case-insensitive, max 32 characters
  parameters?: CustomMacroParameter[];
  parmbuff?: boolean; // %macro ... / PARMBUFF (or /PBUFF)
  description?: string; // e.g. leading comment or /DES= text
  sourceLabel?: string; // display text only, e.g. "My Folder/util/dates.sas"
  sourceUri?: string; // stable identity used to exclude stale entries for the open file
}

export interface GetCustomMacrosResult {
  macros: CustomMacro[];
}

const MACRO_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

export function isValidMacroName(name: unknown): name is string {
  return typeof name === "string" && MACRO_NAME_REGEX.test(name);
}

const WORD_CHAR = /[A-Za-z0-9_]/;
const WHITESPACE = /\s/;
// characters that can follow "%" as a macro quoting escape, e.g. %' %( %,
const ESCAPED_AFTER_PERCENT = "'\"(),;%&";

interface Comment {
  text: string;
  end: number;
}

/** Returns the index just after the closing quote (or text length). */
function skipString(text: string, start: number): number {
  const quote = text[start];
  let i = start + 1;
  while (i < text.length) {
    if (text[i] === quote) {
      if (text[i + 1] === quote) {
        i += 2;
        continue;
      }
      return i + 1;
    }
    i++;
  }
  return i;
}

/** Returns the index just after the closing "*\/" (or text length). */
function skipBlockComment(text: string, start: number): number {
  const end = text.indexOf("*/", start + 2);
  return end === -1 ? text.length : end + 2;
}

/** Returns the index just after the terminating ";" (or text length). */
function skipToSemicolon(text: string, start: number): number {
  const end = text.indexOf(";", start);
  return end === -1 ? text.length : end + 1;
}

/** Skips whitespace and block comments. */
function skipTrivia(text: string, start: number): number {
  let i = start;
  while (i < text.length) {
    if (WHITESPACE.test(text[i])) {
      i++;
    } else if (text[i] === "/" && text[i + 1] === "*") {
      i = skipBlockComment(text, i);
    } else {
      break;
    }
  }
  return i;
}

/**
 * Finds the ";" ending a statement, ignoring ";" in quoted strings and
 * block comments. Returns the index of the ";" (or text length).
 */
function findStatementEnd(text: string, start: number): number {
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "'" || ch === '"') {
      i = skipString(text, i);
    } else if (ch === "/" && text[i + 1] === "*") {
      i = skipBlockComment(text, i);
    } else if (ch === ";") {
      return i;
    } else {
      i++;
    }
  }
  return i;
}

function cleanComment(raw: string): string | undefined {
  let body = raw;
  if (body.startsWith("/*")) {
    body = body.slice(2, body.endsWith("*/") ? -2 : undefined);
  } else {
    // "%* ...;" or "* ...;"
    body = body.replace(/^%?\*/, "").replace(/;$/, "");
  }
  const lines = body.split(/\r?\n/).map((line) =>
    line
      .replace(/^\s*\*+/, "")
      .replace(/\*+\s*$/, "")
      .trim(),
  );
  // drop leading/trailing empty lines, keep paragraph breaks in between
  while (lines.length && !lines[0]) {
    lines.shift();
  }
  while (lines.length && !lines[lines.length - 1]) {
    lines.pop();
  }
  const description = lines.join("\n").trim();
  return description ? description : undefined;
}

function toParameter(segment: string): CustomMacroParameter | undefined {
  const text = segment.trim();
  if (!text) {
    return undefined;
  }
  const eq = text.indexOf("=");
  if (eq === -1) {
    return isValidMacroName(text) ? { name: text, keyword: false } : undefined;
  }
  const name = text.substring(0, eq).trim();
  if (!isValidMacroName(name)) {
    return undefined;
  }
  const defaultValue = text
    .substring(eq + 1)
    .replace(/\s+/g, " ")
    .trim();
  return defaultValue
    ? { name, keyword: true, defaultValue }
    : { name, keyword: true };
}

/**
 * Parses a parameter list starting just after "(".
 * Returns the parameters and the index just after the closing ")".
 */
function parseParameters(
  text: string,
  start: number,
): { parameters: CustomMacroParameter[]; end: number } {
  const segments: string[] = [];
  let current = "";
  let depth = 0;
  let i = start;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "/" && text[i + 1] === "*") {
      i = skipBlockComment(text, i);
      current += " ";
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = skipString(text, i);
      current += text.substring(i, end);
      i = end;
      continue;
    }
    if (ch === "%" && ESCAPED_AFTER_PERCENT.includes(text[i + 1] ?? "")) {
      current += text.substring(i, i + 2);
      i += 2;
      continue;
    }
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      if (depth === 0) {
        i++;
        break;
      }
      depth--;
    } else if (ch === "," && depth === 0) {
      segments.push(current);
      current = "";
      i++;
      continue;
    } else if (ch === ";" && depth === 0) {
      // malformed list: the statement ends here
      break;
    }
    current += ch;
    i++;
  }
  segments.push(current);

  const parameters: CustomMacroParameter[] = [];
  for (const segment of segments) {
    const parameter = toParameter(segment);
    if (parameter) {
      parameters.push(parameter);
    }
  }
  return { parameters, end: i };
}

function parseOptions(options: string): {
  parmbuff: boolean;
  description?: string;
} {
  // remove quoted strings first so that e.g. DES='use /PARMBUFF' does not
  // turn on the flag, but keep the DES= value
  let description: string | undefined;
  const desMatch = /\bDES\s*=\s*(['"])/i.exec(options);
  if (desMatch) {
    const quoteStart = desMatch.index + desMatch[0].length - 1;
    const end = skipString(options, quoteStart);
    const quote = desMatch[1];
    const raw = options.substring(
      quoteStart + 1,
      options[end - 1] === quote && end - 1 > quoteStart ? end - 1 : end,
    );
    description =
      raw
        .split(quote + quote)
        .join(quote)
        .trim() || undefined;
  }
  let unquoted = "";
  for (let i = 0; i < options.length;) {
    const ch = options[i];
    if (ch === "'" || ch === '"') {
      i = skipString(options, i);
      unquoted += " ";
    } else {
      unquoted += ch;
      i++;
    }
  }
  const parmbuff = /(^|[^A-Za-z0-9_])(PARMBUFF|PBUFF)(?![A-Za-z0-9_])/i.test(
    unquoted,
  );
  return { parmbuff, description };
}

/**
 * Parses one definition. `start` is the index just after "%macro".
 * Returns the macro (if the name can be resolved) and the index just after
 * the ";" that ends the %MACRO statement.
 */
function parseDefinition(
  text: string,
  start: number,
): { macro?: CustomMacro; end: number } {
  let i = skipTrivia(text, start);
  const nameMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.substring(i, i + 256));
  if (!nameMatch) {
    // dynamic (%macro &name) or invalid name
    return { end: findStatementEnd(text, i) + 1 };
  }
  const name = nameMatch[0];
  i += name.length;
  if (text[i] === "&" || text[i] === "%" || !isValidMacroName(name)) {
    // partly dynamic (%macro a&b) or longer than 32 characters
    return { end: findStatementEnd(text, i) + 1 };
  }

  const macro: CustomMacro = { name };
  i = skipTrivia(text, i);
  if (text[i] === "(") {
    const result = parseParameters(text, i + 1);
    macro.parameters = result.parameters;
    i = result.end;
  }

  const stmtEnd = findStatementEnd(text, i);
  const rest = text.substring(i, stmtEnd);
  const slash = rest.indexOf("/");
  if (slash !== -1) {
    const { parmbuff, description } = parseOptions(rest.substring(slash + 1));
    if (parmbuff) {
      macro.parmbuff = true;
    }
    if (description) {
      macro.description = description;
    }
  }
  return { macro, end: stmtEnd + 1 };
}

/**
 * Scans the text of a SAS program and returns every %MACRO definition found,
 * including nested definitions, in source order. When a name is defined
 * more than once, consumers should let the last definition win.
 *
 * Handled: block comments, "* ...;" and "%* ...;" comments, quoted strings,
 * macro quoting escapes (%' %" %( %) %,), positional and keyword parameters
 * with defaults (quotes, nested parentheses, %str/%nrstr), /PARMBUFF, /PBUFF
 * and /DES=.
 *
 * Not handled: dynamic names (%macro &name), compiled stored macros without
 * source.
 */
export function parseMacroDefinitions(
  text: string,
  sourceLabel?: string,
): CustomMacro[] {
  const macros: CustomMacro[] = [];
  if (typeof text !== "string" || text.length === 0) {
    return macros;
  }
  let lastComment: Comment | undefined;
  let atStatementStart = true;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const next = text[i + 1];

    if (WHITESPACE.test(ch)) {
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = skipBlockComment(text, i);
      lastComment = { text: text.substring(i, end), end };
      i = end;
      continue;
    }
    if (ch === "'" || ch === '"') {
      i = skipString(text, i);
      atStatementStart = false;
      continue;
    }
    if (ch === ";") {
      atStatementStart = true;
      i++;
      continue;
    }
    if (ch === "*" && atStatementStart) {
      const end = skipToSemicolon(text, i);
      lastComment = { text: text.substring(i, end), end };
      i = end;
      continue;
    }
    if (ch === "%") {
      if (next === "*") {
        const end = skipToSemicolon(text, i);
        lastComment = { text: text.substring(i, end), end };
        atStatementStart = true;
        i = end;
        continue;
      }
      if (ESCAPED_AFTER_PERCENT.includes(next ?? "")) {
        i += 2;
        atStatementStart = false;
        continue;
      }
      const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(
        text.substring(i + 1, i + 40),
      )?.[0];
      if (word && word.toLowerCase() === "macro") {
        const { macro, end } = parseDefinition(text, i + 1 + word.length);
        if (macro) {
          let description = macro.description;
          if (
            !description &&
            lastComment &&
            /^\s*$/.test(text.substring(lastComment.end, i))
          ) {
            description = cleanComment(lastComment.text);
          }
          if (description) {
            macro.description = description;
          }
          if (sourceLabel) {
            macro.sourceLabel = sourceLabel;
          }
          macros.push(macro);
        }
        lastComment = undefined;
        atStatementStart = true;
        i = end;
        continue;
      }
      i += 1 + (word ? word.length : 0);
      atStatementStart = false;
      continue;
    }
    if (WORD_CHAR.test(ch)) {
      while (i < text.length && WORD_CHAR.test(text[i])) {
        i++;
      }
    } else {
      i++;
    }
    atStatementStart = false;
  }
  return macros;
}
