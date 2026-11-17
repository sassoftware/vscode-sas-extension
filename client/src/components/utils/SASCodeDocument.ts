// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CancellationToken,
  CancellationTokenSource,
  Disposable,
  Uri,
} from "vscode";
import type { BaseLanguageClient } from "vscode-languageclient";

import { dirname } from "path";
import { v4 } from "uuid";

import {
  ProblemLocation,
  decomposeCodeLogLine,
} from "../logViewer/ProblemProcessor";

export interface PythonFinalExpression {
  isExpression: boolean;
  expressionText?: string;
  startOffset?: number;
  endOffset?: number;
  isModuleDocstring?: boolean;
}

export interface SASCodeDocumentParameters {
  languageId: string;
  code: string;
  selectedCode: string;
  uri?: string;
  fileName?: string;
  selections?: ReadonlyArray<{
    start: { line: number; character: number };
    end: { line: number; character: number };
  }>;
  preamble?: string;
  postamble?: string;
  outputHtml?: boolean;
  htmlStyle?: string;
  uuid?: string;
  checkKeyword: (LineNumber: number, ...keywords: string[]) => Promise<boolean>;
}

type LineNumber = number;
type Offset = { lineOffset: number; columnOffset: number };
const pendingDetectionClients = new WeakSet<object>();

export class SASCodeDocument {
  // there may be many selected raw code and they can be not continuous in editor.
  // this field provides a offset map for selected raw code in wrapped code and in whole raw code.
  private offsetMap: Map<LineNumber, Offset>;
  private pythonAutodisplayId: string | undefined;

  public constructor(private parameters: SASCodeDocumentParameters) {}

  public getWrappedCode(): string {
    const code = this.getRawCode();
    return this.codeIsEmpty(code) ? "" : this.wrapCode(code);
  }

  public async getWrappedNotebookCode(
    client?: Pick<BaseLanguageClient, "isRunning" | "sendRequest">,
    token?: CancellationToken,
  ): Promise<string> {
    const code = this.getRawCode();
    if (this.codeIsEmpty(code)) {
      return "";
    }
    if (this.parameters.languageId !== "python") {
      return this.wrapCode(code);
    }
    return this.wrapCode(
      await this.preparePythonNotebookCode(code, client, token),
    );
  }

  public getPythonAutodisplayId(): string | undefined {
    return this.pythonAutodisplayId;
  }

  public getUri(): string {
    return this.parameters.uri;
  }

  public getFileName(): string {
    return this.parameters.fileName;
  }

  public getBaseDirectory(): string {
    return dirname(this.getFileName());
  }

  public wrappedCodeLineAt(lineNumber: number) {
    return this.getWrappedCode().split("\n")[lineNumber];
  }

  public async getLocationInRawCode(
    locationFromLog: ProblemLocation,
    codeLinesInLog: string[],
  ): Promise<ProblemLocation> {
    if (this.offsetMap === undefined) {
      await this.constructOffsetMap(codeLinesInLog);
    }

    const {
      lineNumber: lineNumberInLog,
      startColumn: startColumnInLog,
      endColumn: endColumnInLog,
    } = locationFromLog;

    const offset = this.offsetMap.get(lineNumberInLog);
    if (offset) {
      const { lineOffset: lineNumberInRaw, columnOffset } = offset;
      return {
        lineNumber: lineNumberInRaw,
        startColumn: startColumnInLog + columnOffset,
        endColumn: endColumnInLog + columnOffset,
      };
    }

    const firstLineNumber = this.offsetMap.keys().next().value;
    const lastLineNumber = Array.from(this.offsetMap.keys()).pop() ?? 0;

    // if the problem occurs before the first raw code line,
    // then re-locate it at the first character in the first raw code line.
    if (lineNumberInLog < firstLineNumber) {
      return {
        lineNumber: 0,
        startColumn: 0,
        endColumn: 1,
      };
    }

    // if the problem occurs after the last raw code line,
    // then re-located it at the last character in the last raw code line.
    if (lineNumberInLog > lastLineNumber) {
      const codeLinesInRaw = this.getRawCode().split("\n");
      const count = codeLinesInRaw[codeLinesInRaw.length - 1].length;
      let lastCharacterIndex = count === 0 ? 0 : count - 1;

      if (this.offsetMap.size === 1) {
        lastCharacterIndex = this.parameters.selections[0].end.character - 1;
      }

      const lineNumberInRaw =
        this.offsetMap.get(lastLineNumber)?.lineOffset ?? 0;

      return {
        lineNumber: lineNumberInRaw,
        startColumn: lastCharacterIndex,
        endColumn: lastCharacterIndex + 1,
      };
    }

    // the problem occurs in imported source code,
    // re-locate it at the nearest previous raw code line.
    const nearestPreviousLineNumberInLog = Array.from(this.offsetMap.keys())
      .reverse()
      .find((lineNumber) => lineNumberInLog > lineNumber);

    const nearestOffset = this.offsetMap.get(nearestPreviousLineNumberInLog);

    return {
      lineNumber: nearestOffset.lineOffset,
      startColumn: 0,
      endColumn: 1,
    };
  }

  private codeIsEmpty(code: string): boolean {
    return code.trim() === "";
  }

  private isSasContentUri(uri: string | undefined): boolean {
    return (
      uri !== undefined && Uri.parse(uri).query.startsWith("id=/files/files")
    );
  }

  private quoteSasMacroValue(value: string): string {
    return value.replace(/%/g, "%%").replace(/[()'"]/g, "%$&");
  }

  private wrapCodeWithSASProgramFileName(code: string): string {
    const fileName = this.parameters.fileName;
    let uri = this.parameters.uri;

    if (this.isSasContentUri(uri)) {
      const uriObj = Uri.parse(uri);
      // Preserve the SAS Content URI as sascontent:/files/files/<uuid>.
      uri = uriObj.query.replace("id=", "sascontent:");
      return (
        "%let _SASPROGRAMFILE = %nrquote(%nrstr(" +
        this.quoteSasMacroValue(uri) +
        "));\n" +
        code
      );
    }

    if (fileName !== undefined) {
      return (
        "%let _SASPROGRAMFILE = %nrquote(%nrstr(" +
        this.quoteSasMacroValue(fileName) +
        "));\n" +
        code
      );
    }

    // if a fileName was not found, just return the raw code
    return code;
  }

  private wrapCodeWithSASProgramDir(code: string): string {
    // SAS Content files have no readable parent folder without an extra
    // service call, which isn't possible during session init (LOCKDOWN);
    if (this.isSasContentUri(this.parameters.uri)) {
      return "%symdel _SASPROGRAMDIR / nowarn;\n" + code;
    }

    if (this.parameters.fileName === undefined) {
      return "%symdel _SASPROGRAMDIR / nowarn;\n" + code;
    }

    const baseDirectory = this.quoteSasMacroValue(this.getBaseDirectory());
    return (
      "%let _SASPROGRAMDIR = %nrquote(%nrstr(" + baseDirectory + "));\n" + code
    );
  }

  private wrapCodeWithPreambleAndPostamble(code: string): string {
    return (
      (this.parameters?.preamble ? this.parameters?.preamble + "\n" : "") +
      code +
      (this.parameters?.postamble ? "\n" + this.parameters?.postamble : "")
    );
  }

  private wrapCodeWithOutputHtml(code: string): string {
    if (this.parameters.outputHtml) {
      const htmlStyle = this.parameters.htmlStyle.trim();
      const htmlStyleOption = htmlStyle !== "" ? ` style=${htmlStyle}` : "";
      const outputDestination = this.parameters?.uuid
        ? ` body="${this.parameters.uuid}.htm"`
        : "";

      return `title;footnote;ods _all_ close;
ods graphics on;
ods html5(id=vscode)${htmlStyleOption} options(bitmap_mode='inline' svg_mode='inline')${outputDestination};
${code}
;*';*";*/;run;quit;ods html5(id=vscode) close;
`;
    } else {
      return code;
    }
  }

  private wrapSQL(code: string) {
    return `proc sql;
${code}
;quit;`;
  }

  private async preparePythonNotebookCode(
    code: string,
    client?: Pick<BaseLanguageClient, "isRunning" | "sendRequest">,
    token?: CancellationToken,
  ): Promise<string> {
    this.pythonAutodisplayId = undefined;
    const cancellation = new CancellationTokenSource();
    const parentListener = token?.onCancellationRequested(() =>
      cancellation.cancel(),
    );
    if (token?.isCancellationRequested) {
      cancellation.cancel();
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let listener: Disposable | undefined;
    try {
      if (
        !client?.isRunning() ||
        cancellation.token.isCancellationRequested ||
        pendingDetectionClients.has(client) ||
        code.length > 100_000 ||
        (code.match(/[()[\]{}]/g)?.length ?? 0) > 256 ||
        (code.match(/[;+=*/%&|^<>,:-]/g)?.length ?? 0) > 1024 ||
        (code.match(/\S+/g)?.length ?? 0) > 2000
      ) {
        return code;
      }
      pendingDetectionClients.add(client);
      let request: Promise<PythonFinalExpression>;
      try {
        request = Promise.resolve(
          (async () => {
            const result = await client.sendRequest<PythonFinalExpression>(
              "sas/pythonFinalExpression",
              { code },
              cancellation.token,
            );
            return result;
          })(),
        ).finally(() => pendingDetectionClients.delete(client));
      } catch (error) {
        pendingDetectionClients.delete(client);
        throw error;
      }
      const expression = await Promise.race([
        request,
        new Promise<undefined>((resolve) => {
          listener = cancellation.token.onCancellationRequested(() =>
            resolve(undefined),
          );
          timer = setTimeout(() => {
            cancellation.cancel();
            resolve(undefined);
          }, 1000);
        }),
      ]);
      if (
        !expression?.isExpression ||
        cancellation.token.isCancellationRequested
      ) {
        return code;
      }
      const { startOffset, endOffset, expressionText } = expression;
      if (
        typeof startOffset !== "number" ||
        typeof endOffset !== "number" ||
        !Number.isInteger(startOffset) ||
        !Number.isInteger(endOffset) ||
        startOffset < 0 ||
        endOffset <= startOffset ||
        endOffset > code.length ||
        !expressionText ||
        code.slice(startOffset, endOffset) !== expressionText
      ) {
        return code;
      }
      const id = v4().replace(/-/g, "");
      const resultName = `__sas_${id}_result`;
      const builtinsName = `__sas_${id}_builtins`;
      const jsonName = `__sas_${id}_json`;
      const display = expression.isModuleDocstring
        ? `${expressionText}\n${resultName} = ((${expressionText}))`
        : `${resultName} = ((${expressionText}))`;
      const cleanup = [resultName, builtinsName, jsonName]
        .map((name) => `try:\n    del ${name}\nexcept:\n    pass`)
        .join("\n");
      this.pythonAutodisplayId = id;
      return (
        code.slice(0, startOffset) +
        display +
        code.slice(endOffset) +
        `
try:
    if ${resultName} is not None:
        import builtins as ${builtinsName}
        import json as ${jsonName}
        ${builtinsName}.print("__SAS_AUTODISPLAY_${id}_BEGIN__" + ${jsonName}.dumps(${builtinsName}.repr(${resultName}), ensure_ascii=True) + "__SAS_AUTODISPLAY_${id}_END__")
except:
    pass
${cleanup}
`
      );
    } catch (error) {
      if (!cancellation.token.isCancellationRequested) {
        console.error("Failed to prepare Python notebook autodisplay:", error);
      }
      return code;
    } finally {
      clearTimeout(timer);
      listener?.dispose();
      parentListener?.dispose();
      cancellation.dispose();
    }
  }

  private wrapPython(code: string) {
    return `proc python;
submit;
${code}
endsubmit;
run;`;
  }

  private wrapR(code: string) {
    return `proc r;
submit;
${code}
endsubmit;
run;`;
  }

  private insertLogStartIndicator(code: string): string {
    // add a comment line at the top of code,
    // this comment line will be used as indicator to the beginning of log related with this code
    return `/** LOG_START_INDICATOR **/
${code}`;
  }

  private wrapCode(code: string): string {
    let wrapped = code;

    if (this.parameters.languageId === "sql") {
      wrapped = this.wrapSQL(wrapped);
    }

    if (this.parameters.languageId === "python") {
      wrapped = this.wrapPython(wrapped);
    }

    if (this.parameters.languageId === "r") {
      wrapped = this.wrapR(wrapped);
    }

    wrapped = this.wrapCodeWithSASProgramFileName(wrapped);

    wrapped = this.wrapCodeWithSASProgramDir(wrapped);

    wrapped = this.wrapCodeWithPreambleAndPostamble(wrapped);

    wrapped = this.wrapCodeWithOutputHtml(wrapped);

    wrapped = this.insertLogStartIndicator(wrapped);

    return wrapped;
  }

  // getWrappedCode() returns more code than raw code in editor, and addition code may be added at the beginning or end of raw code.
  // this method return the position at which the raw code begins in wrapped code.
  private getRawCodeBeginLineNumberInWrappedCode(): number {
    const FRONT_LOCATOR = "LOCATOR-TO-MARK-THE-BEGIN-OF-USER-CODE";
    const codeWithLocator = FRONT_LOCATOR + this.getRawCode();
    const wrapped = this.wrapCode(codeWithLocator);
    return wrapped
      .split("\n")
      .findIndex((line) => line.includes(FRONT_LOCATOR));
  }

  // return selected code line array, which is in {lineNumber, column, code} format.
  private constructCodeLinesInRaw(): {
    lineNumber: LineNumber;
    column: number;
    code: string;
  }[] {
    const codeLines = this.getRawCode().split("\n");
    let index = -1;
    const codeLinesInRaw = [];

    this.parameters.selections.forEach((selection) => {
      const { start, end } = selection;

      for (let lineNumber = start.line; lineNumber <= end.line; lineNumber++) {
        index++;
        codeLinesInRaw[index] = {
          lineNumber,
          column: lineNumber === start.line ? start.character : 0,
          code: codeLines[index],
        };
      }
    });

    return codeLinesInRaw;
  }

  private getNextValidCodeLineInLog(
    codeLines: string[],
    start: number,
  ): { code: string; lineNumber: number; index: number } {
    let index = start;
    let { code, lineNumber } = decomposeCodeLogLine(codeLines[index]);

    while (
      index < codeLines.length &&
      // code not included in the source file starts with "+" in the log.
      code.trim().startsWith("+")
    ) {
      ({ code, lineNumber } = decomposeCodeLogLine(codeLines[++index]));
    }
    return { code, lineNumber, index };
  }

  private async constructOffsetMap(codeLinesInLog: string[]): Promise<void> {
    const codeLinesInRaw = this.constructCodeLinesInRaw();
    let indexInRaw = 0;
    let codeLineInRaw: string;
    let lineNumberInRaw: number;
    let columnInRaw: number;

    let indexInLog = this.getRawCodeBeginLineNumberInWrappedCode();
    let codeLineInLog: string;
    let lineNumberInLog: number;
    let lastValidLineNumberInLog: number;

    let inInteractiveBlock = false;

    this.offsetMap = new Map<LineNumber, Offset>();

    while (
      indexInRaw < codeLinesInRaw.length &&
      indexInLog < codeLinesInLog.length
    ) {
      ({
        code: codeLineInRaw,
        lineNumber: lineNumberInRaw,
        column: columnInRaw,
      } = codeLinesInRaw[indexInRaw]);

      if (inInteractiveBlock) {
        let index = indexInRaw;
        let lineInfo = codeLinesInRaw[++index];

        while (
          !(await this.parameters.checkKeyword(
            // this.parameters.uri,
            // lineInfo.code,
            lineInfo.lineNumber,
            "endinteractive",
          )) &&
          index < codeLinesInRaw.length
        ) {
          lineInfo = codeLinesInRaw[++index];
        }

        if (index < codeLinesInRaw.length) {
          ({
            code: codeLineInRaw,
            lineNumber: lineNumberInRaw,
            column: columnInRaw,
          } = codeLinesInRaw[++index]);
          indexInRaw = index;
          inInteractiveBlock = false;
        }
      }

      ({
        code: codeLineInLog,
        lineNumber: lineNumberInLog,
        index: indexInLog,
      } = this.getNextValidCodeLineInLog(codeLinesInLog, indexInLog));

      // The line numbers in the source code within the log should be continuous.
      // but if encountering datasets following a datalines statement or %INC statement,
      // the line numbers will not be continuous.
      // for datalines-like statements, it will skip the number of dataset lines.
      // for %INC-like statements, it will continue without skip
      const delta =
        lastValidLineNumberInLog === undefined
          ? 1
          : lineNumberInLog - lastValidLineNumberInLog;
      if (
        delta > 1 &&
        // if the code line in log can be found in raw,
        // think of the discontinuous line number is caused by %INC-like statements,
        // otherwise it is from datalines-like statements and need to skip lines in raw.
        !isSameOrStartsWith(codeLineInRaw.trim(), codeLineInLog.trim())
      ) {
        indexInRaw += delta - 1;
        ({
          code: codeLineInRaw,
          lineNumber: lineNumberInRaw,
          column: columnInRaw,
        } = codeLinesInRaw[indexInRaw]);
      }

      if (!isSameOrStartsWith(codeLineInRaw.trim(), codeLineInLog.trim())) {
        const match = this.getMatchedCodeLineInLog(
          codeLineInRaw,
          codeLinesInLog,
          indexInLog,
        );
        lineNumberInLog = match.lineNumber;
        indexInLog = match.index;
      }

      const offset = { lineOffset: lineNumberInRaw, columnOffset: columnInRaw };

      this.offsetMap.set(lineNumberInLog, offset);
      lastValidLineNumberInLog = lineNumberInLog;

      inInteractiveBlock = await this.parameters.checkKeyword(
        // this.parameters.uri,
        // codeLineInRaw,
        lineNumberInRaw,
        "interactive",
        "i",
      );

      indexInRaw++;
      indexInLog++;
    }
  }

  private getMatchedCodeLineInLog(
    codeLineInRaw: string,
    codeLinesInLog: string[],
    start: number,
  ): { code: string; lineNumber: number; index: number } | null {
    let validCodeLine = { code: "", lineNumber: -1, index: start };
    let indexInLog = start;
    do {
      validCodeLine = this.getNextValidCodeLineInLog(
        codeLinesInLog,
        indexInLog++,
      );
    } while (
      !isSameOrStartsWith(codeLineInRaw.trim(), validCodeLine.code.trim()) &&
      indexInLog < codeLinesInLog.length
    );

    return validCodeLine.index >= codeLinesInLog.length ? null : validCodeLine;
  }

  // priority return selected code, otherwise, return whole code.
  private getRawCode(): string {
    return this.parameters.selectedCode.trim() === ""
      ? this.parameters.code
      : this.parameters.selectedCode;
  }
}

function isSameOrStartsWith(base: string, target: string): boolean {
  return target === "" ? base === target : base.startsWith(target);
}
