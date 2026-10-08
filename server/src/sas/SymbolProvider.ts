// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Location,
  Position,
  Range,
  TextEdit,
  WorkspaceEdit,
} from "vscode-languageserver";

import { LexerEx } from "./LexerEx";
import { Model } from "./Model";
import { SyntaxProvider } from "./SyntaxProvider";

type SymbolKind = "dataSet" | "macroProgram" | "macroVariable" | "variable";

interface SasSymbol {
  name: string;
  kind: SymbolKind;
  range: Range;
  declaration: boolean;
  dataStepScope?: { startLine: number; endLine: number };
  macroScopeKey?: string;
}

interface MacroVariableDeclaration {
  name: string;
  start: number;
  end: number;
  scope: "global" | "local" | "let" | "symput" | "parameter";
}

const identifier = "[A-Za-z_][A-Za-z0-9_]*";

export class SymbolProvider {
  constructor(
    private model: Model,
    private syntaxProvider: SyntaxProvider,
  ) {}

  getReferences(
    uri: string,
    position: Position,
    includeDeclaration: boolean,
  ): Location[] {
    const symbol = this.getSymbolAt(position);
    if (!symbol) {
      return [];
    }
    return this.findSymbols(symbol)
      .filter((item) => includeDeclaration || !item.declaration)
      .map((item) => Location.create(uri, item.range));
  }

  prepareRename(position: Position): Range | undefined {
    return this.getSymbolAt(position)?.range;
  }

  rename(
    uri: string,
    position: Position,
    newName: string,
  ): WorkspaceEdit | undefined {
    const symbol = this.getSymbolAt(position);
    if (!symbol || !new RegExp(`^${identifier}$`).test(newName)) {
      return undefined;
    }
    const edits = this.findSymbols(symbol).map((item) =>
      TextEdit.replace(item.range, newName),
    );
    return { changes: { [uri]: edits } };
  }

  private getSymbolAt(position: Position): SasSymbol | undefined {
    const line = this.model.getLine(position.line);
    if (!line) {
      return undefined;
    }
    let character = Math.min(position.character, line.length);
    if (
      character === line.length ||
      !/[A-Za-z0-9_]/.test(line.charAt(character))
    ) {
      character--;
    }
    if (character < 0 || !/[A-Za-z0-9_]/.test(line.charAt(character))) {
      return undefined;
    }

    let start = character;
    let end = character + 1;
    while (start > 0 && /[A-Za-z0-9_]/.test(line.charAt(start - 1))) {
      start--;
    }
    while (end < line.length && /[A-Za-z0-9_]/.test(line.charAt(end))) {
      end++;
    }

    if (this.isComment(position.line, start)) {
      return undefined;
    }

    const name = line.slice(start, end);
    const range = this.range(position.line, start, end);
    const marker = line.charAt(start - 1);
    if (marker === "&") {
      return {
        name,
        kind: "macroVariable",
        range,
        declaration: false,
        macroScopeKey: this.resolveMacroVariableScope(name, position),
      };
    }
    if (marker === "%") {
      return { name, kind: "macroProgram", range, declaration: false };
    }
    const macroDeclaration = this.getMacroVariableDeclarationAt(
      position.line,
      start,
    );
    if (macroDeclaration) {
      return {
        name,
        kind: "macroVariable",
        range,
        declaration: true,
        macroScopeKey: this.resolveMacroVariableScope(
          name,
          position,
          macroDeclaration.scope,
        ),
      };
    }
    if (this.isMacroProgramDeclaration(line, start, name)) {
      return { name, kind: "macroProgram", range, declaration: true };
    }
    if (this.isMacroProgramEnd(line, start, name)) {
      return { name, kind: "macroProgram", range, declaration: false };
    }
    if (this.isString(position.line, start)) {
      return undefined;
    }
    if (this.isDataSetReference(line, start)) {
      return {
        name,
        kind: "dataSet",
        range,
        declaration: this.isDataSetDeclaration(line, start),
      };
    }
    return {
      name,
      kind: "variable",
      range,
      declaration: false,
      dataStepScope: this.getDataStepScope(position),
    };
  }

  private findSymbols(symbol: SasSymbol): SasSymbol[] {
    switch (symbol.kind) {
      case "macroVariable":
        return this.findMacroVariables(symbol.name, symbol.macroScopeKey);
      case "macroProgram":
        return this.findMacroPrograms(symbol.name);
      case "dataSet":
        return this.findDataSets(symbol.name);
      default:
        return this.findVariables(symbol.name, symbol.dataStepScope);
    }
  }

  private findMacroVariables(
    name: string,
    macroScopeKey?: string,
  ): SasSymbol[] {
    const result: SasSymbol[] = [];
    const reference = new RegExp(`&(${name})(?:\\.)?\\b`, "gi");
    for (
      let lineNumber = 0;
      lineNumber < this.model.getLineCount();
      lineNumber++
    ) {
      const line = this.model.getLine(lineNumber);
      for (const match of line.matchAll(reference)) {
        const start = match.index! + 1;
        if (
          !this.isComment(lineNumber, start) &&
          !this.isInSingleQuotedString(line, start) &&
          this.resolveMacroVariableScope(name, {
            line: lineNumber,
            character: start,
          }) === macroScopeKey
        ) {
          result.push({
            name,
            kind: "macroVariable",
            range: this.range(lineNumber, start, start + match[1].length),
            declaration: false,
          });
        }
      }
      for (const declaration of this.getMacroVariableDeclarations(line)) {
        if (
          declaration.name.toLowerCase() !== name.toLowerCase() ||
          this.isComment(lineNumber, declaration.start) ||
          (declaration.scope !== "symput" &&
            this.isString(lineNumber, declaration.start))
        ) {
          continue;
        }
        const scopeKey = this.resolveMacroVariableScope(
          name,
          { line: lineNumber, character: declaration.start },
          declaration.scope,
        );
        if (scopeKey !== macroScopeKey) {
          continue;
        }
        result.push({
          name,
          kind: "macroVariable",
          range: this.range(lineNumber, declaration.start, declaration.end),
          declaration: true,
          macroScopeKey: scopeKey,
        });
      }
    }
    return result;
  }

  private findMacroPrograms(name: string): SasSymbol[] {
    const result: SasSymbol[] = [];
    const reference = new RegExp(`%(${name})\\b`, "gi");
    for (
      let lineNumber = 0;
      lineNumber < this.model.getLineCount();
      lineNumber++
    ) {
      const line = this.model.getLine(lineNumber);
      for (const match of line.matchAll(reference)) {
        const start = match.index! + 1;
        if (!this.isComment(lineNumber, start)) {
          result.push({
            name,
            kind: "macroProgram",
            range: this.range(lineNumber, start, start + match[1].length),
            declaration: /^\s*%macro\b/i.test(line.slice(0, match.index)),
          });
        }
      }
      const declaration = new RegExp(`%macro\\s+(${name})\\b`, "i").exec(line);
      if (declaration) {
        const start =
          declaration.index + declaration[0].lastIndexOf(declaration[1]);
        if (this.isComment(lineNumber, start)) {
          continue;
        }
        result.push({
          name,
          kind: "macroProgram",
          range: this.range(lineNumber, start, start + declaration[1].length),
          declaration: true,
        });
      }
      const macroEnd = new RegExp(`%mend\\s+(${name})\\b`, "i").exec(line);
      if (macroEnd) {
        const start = macroEnd.index + macroEnd[0].lastIndexOf(macroEnd[1]);
        if (this.isComment(lineNumber, start)) {
          continue;
        }
        result.push({
          name,
          kind: "macroProgram",
          range: this.range(lineNumber, start, start + macroEnd[1].length),
          declaration: false,
        });
      }
    }
    return result;
  }

  private findDataSets(name: string): SasSymbol[] {
    return this.findCodeIdentifiers(name)
      .filter((item) =>
        this.isDataSetReference(
          this.model.getLine(item.range.start.line),
          item.range.start.character,
        ),
      )
      .map((item) => ({
        ...item,
        kind: "dataSet",
        declaration: this.isDataSetDeclaration(
          this.model.getLine(item.range.start.line),
          item.range.start.character,
        ),
      }));
  }

  private findVariables(
    name: string,
    dataStepScope?: { startLine: number; endLine: number },
  ): SasSymbol[] {
    return this.findCodeIdentifiers(
      name,
      dataStepScope?.startLine,
      dataStepScope?.endLine,
    ).filter((item) => {
      const line = this.model.getLine(item.range.start.line);
      return !this.isDataSetReference(line, item.range.start.character);
    });
  }

  private findCodeIdentifiers(
    name: string,
    startLine = 0,
    endLine = this.model.getLineCount() - 1,
  ): SasSymbol[] {
    const result: SasSymbol[] = [];
    const matcher = new RegExp(`\\b${name}\\b`, "gi");
    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
      const line = this.model.getLine(lineNumber);
      for (const match of line.matchAll(matcher)) {
        const start = match.index!;
        const marker = line.charAt(start - 1);
        if (
          marker !== "&" &&
          marker !== "%" &&
          !this.isComment(lineNumber, start) &&
          !this.isString(lineNumber, start)
        ) {
          result.push({
            name,
            kind: "variable",
            range: this.range(lineNumber, start, start + match[0].length),
            declaration: false,
          });
        }
      }
    }
    return result;
  }

  private getMacroVariableDeclarationAt(
    lineNumber: number,
    start: number,
  ): MacroVariableDeclaration | undefined {
    return this.getMacroVariableDeclarations(
      this.model.getLine(lineNumber),
    ).find((item) => item.start === start);
  }

  private getMacroVariableDeclarations(
    line: string,
  ): MacroVariableDeclaration[] {
    const declarations: MacroVariableDeclaration[] = [];
    const addNames = (
      source: string,
      sourceOffset: number,
      scope: MacroVariableDeclaration["scope"],
    ) => {
      const matcher = new RegExp(identifier, "g");
      for (const match of source.matchAll(matcher)) {
        declarations.push({
          name: match[0],
          start: sourceOffset + match.index!,
          end: sourceOffset + match.index! + match[0].length,
          scope,
        });
      }
    };

    const letDeclaration = new RegExp(`%let\\s+(${identifier})\\b`, "i").exec(
      line,
    );
    if (letDeclaration) {
      const start =
        letDeclaration.index + letDeclaration[0].lastIndexOf(letDeclaration[1]);
      declarations.push({
        name: letDeclaration[1],
        start,
        end: start + letDeclaration[1].length,
        scope: "let",
      });
    }

    for (const match of line.matchAll(/%(global|local)\s+([^;]+);/gi)) {
      const listStart = match.index! + match[0].indexOf(match[2]);
      const scope = match[1].toLowerCase();
      if (scope === "global" || scope === "local") {
        addNames(match[2], listStart, scope);
      }
    }

    const macroHeader = /%macro\s+[A-Za-z_][A-Za-z0-9_]*\s*\(([^)]*)\)/i.exec(
      line,
    );
    if (macroHeader) {
      const parametersOffset =
        macroHeader.index + macroHeader[0].indexOf(macroHeader[1]);
      for (const parameter of macroHeader[1].split(",")) {
        const parameterName = new RegExp(`^\\s*(${identifier})`).exec(
          parameter,
        );
        if (parameterName) {
          const start = parametersOffset + macroHeader[1].indexOf(parameter);
          const nameStart =
            start + parameterName[0].lastIndexOf(parameterName[1]);
          declarations.push({
            name: parameterName[1],
            start: nameStart,
            end: nameStart + parameterName[1].length,
            scope: "parameter",
          });
        }
      }
    }

    const symputDeclaration = new RegExp(
      `\\bsymput(?:x|n)?\\s*\\(\\s*['"](${identifier})['"]`,
      "i",
    ).exec(line);
    if (symputDeclaration) {
      const start =
        symputDeclaration.index +
        symputDeclaration[0].lastIndexOf(symputDeclaration[1]);
      declarations.push({
        name: symputDeclaration[1],
        start,
        end: start + symputDeclaration[1].length,
        scope: "symput",
      });
    }

    return declarations;
  }

  private resolveMacroVariableScope(
    name: string,
    position: Position,
    declarationScope?: MacroVariableDeclaration["scope"],
  ): string {
    const macroBlock = this.getMacroBlock(position);
    if (declarationScope === "global") {
      return "global";
    }
    if (declarationScope === "local" || declarationScope === "parameter") {
      return macroBlock
        ? this.macroScopeKey(macroBlock.startLine, name)
        : "global";
    }
    if (!macroBlock) {
      return "global";
    }

    const localScopeExists = this.hasMacroDeclaration(name, macroBlock, [
      "local",
      "parameter",
    ]);
    if (localScopeExists) {
      return this.macroScopeKey(macroBlock.startLine, name);
    }

    const globalScopeExists =
      this.hasMacroDeclaration(name, undefined, ["global"]) ||
      this.hasTopLevelMacroLet(name);
    if (globalScopeExists) {
      return "global";
    }

    if (this.hasMacroDeclaration(name, macroBlock, ["let", "symput"])) {
      return this.macroScopeKey(macroBlock.startLine, name);
    }
    return "global";
  }

  private hasMacroDeclaration(
    name: string,
    scope: { startLine: number; endLine: number } | undefined,
    kinds: MacroVariableDeclaration["scope"][],
  ): boolean {
    for (
      let lineNumber = 0;
      lineNumber < this.model.getLineCount();
      lineNumber++
    ) {
      if (
        scope &&
        (lineNumber < scope.startLine || lineNumber > scope.endLine)
      ) {
        continue;
      }
      const line = this.model.getLine(lineNumber);
      for (const declaration of this.getMacroVariableDeclarations(line)) {
        if (
          declaration.name.toLowerCase() === name.toLowerCase() &&
          kinds.includes(declaration.scope) &&
          !this.isComment(lineNumber, declaration.start) &&
          (declaration.scope === "symput" ||
            !this.isString(lineNumber, declaration.start))
        ) {
          return true;
        }
      }
    }
    return false;
  }

  private hasTopLevelMacroLet(name: string): boolean {
    for (
      let lineNumber = 0;
      lineNumber < this.model.getLineCount();
      lineNumber++
    ) {
      if (this.getMacroBlock({ line: lineNumber, character: 0 })) {
        continue;
      }
      const line = this.model.getLine(lineNumber);
      if (
        this.getMacroVariableDeclarations(line).some(
          (declaration) =>
            declaration.scope === "let" &&
            declaration.name.toLowerCase() === name.toLowerCase() &&
            !this.isComment(lineNumber, declaration.start),
        )
      ) {
        return true;
      }
    }
    return false;
  }

  private getMacroBlock(position: Position) {
    let block = this.syntaxProvider.getFoldingBlock(
      position.line,
      position.character,
    );
    while (block && block.type !== LexerEx.SEC_TYPE.MACRO) {
      block = block.outerBlock ?? null;
    }
    return block;
  }

  private macroScopeKey(startLine: number, name: string): string {
    return `macro:${startLine}:${name.toLowerCase()}`;
  }

  private isMacroProgramDeclaration(
    line: string,
    start: number,
    name: string,
  ): boolean {
    return (
      new RegExp(`%macro\\s+${name}\\b`, "i").exec(line)?.index ===
      line.lastIndexOf("%macro", start)
    );
  }

  private isMacroProgramEnd(
    line: string,
    start: number,
    name: string,
  ): boolean {
    return (
      new RegExp(`%mend\\s+${name}\\b`, "i").exec(line)?.index ===
      line.lastIndexOf("%mend", start)
    );
  }

  private isDataSetReference(line: string, start: number): boolean {
    const statement = line.slice(0, start);
    return (
      /(?:^|;)\s*(?:data|set|merge|from|join|create\s+table|append\s+base|out)\s*(?:=\s*)?[^;]*$/i.test(
        statement,
      ) || /\b(?:data|out|base)\s*=\s*[^;]*$/i.test(statement)
    );
  }

  private isDataSetDeclaration(line: string, start: number): boolean {
    return /(?:^|;)\s*data\s+[^;]*$/i.test(line.slice(0, start));
  }

  private getDataStepScope(position: Position) {
    let block = this.syntaxProvider.getFoldingBlock(
      position.line,
      position.character,
    );
    while (block && block.type !== LexerEx.SEC_TYPE.DATA) {
      block = block.outerBlock ?? null;
    }
    if (!block) {
      return undefined;
    }
    return {
      startLine: block.startLine,
      endLine: block.endFoldingLine,
    };
  }

  private isComment(line: number, character: number): boolean {
    return (
      this.getTokenStyle(line, character) === "comment" ||
      this.getTokenStyle(line, character) === "macro-comment"
    );
  }

  private isString(line: number, character: number): boolean {
    return this.getTokenStyle(line, character) === "string";
  }

  private isInSingleQuotedString(line: string, character: number): boolean {
    let inSingleQuote = false;
    for (let index = 0; index < character; index++) {
      if (line.charAt(index) !== "'") {
        continue;
      }
      if (line.charAt(index + 1) === "'") {
        index++;
      } else {
        inSingleQuote = !inSingleQuote;
      }
    }
    return inSingleQuote;
  }

  private getTokenStyle(line: number, character: number) {
    const tokens = this.syntaxProvider.getSyntax(line);
    for (let index = 0; index < tokens.length; index++) {
      const start = tokens[index].start;
      const end = tokens[index + 1]?.start ?? this.model.getLine(line).length;
      if (character >= start && character < end) {
        return tokens[index].style;
      }
    }
    return undefined;
  }

  private range(line: number, start: number, end: number): Range {
    return Range.create(line, start, line, end);
  }
}
