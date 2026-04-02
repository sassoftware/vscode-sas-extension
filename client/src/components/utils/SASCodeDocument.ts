// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ProblemLocation,
  decomposeCodeLogLine,
} from "../logViewer/ProblemProcessor";

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

export class SASCodeDocument {
  // there may be many selected raw code and they can be not continuous in editor.
  // this field provides a offset map for selected raw code in wrapped code and in whole raw code.
  private offsetMap: Map<LineNumber, Offset>;

  public constructor(private parameters: SASCodeDocumentParameters) {}

  public getWrappedCode(): string {
    const code = this.getRawCode();
    return this.codeIsEmpty(code) ? "" : this.wrapCode(code);
  }

  public getUri(): string {
    return this.parameters.uri;
  }

  public getFileName(): string {
    return this.parameters.fileName;
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

  private wrapCodeWithSASProgramFileName(code: string): string {
    let fileName = this.parameters.fileName;
    if (fileName === undefined) {
      return code;
    } else {
      fileName = fileName.replace(/[('")]/g, "%$&");
      const wrapped =
        "%let _SASPROGRAMFILE = %nrquote(%nrstr(" + fileName + "));\n" + code;
      return wrapped;
    }
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
