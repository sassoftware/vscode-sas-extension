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

  public getLocationInRawCode(
    locationFromLog: ProblemLocation,
    codeLinesInLog: string[],
  ): ProblemLocation {
    if (this.offsetMap === undefined) {
      this.constructOffsetMap(codeLinesInLog);
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

      return {
        lineNumber: lastLineNumber,
        startColumn: lastCharacterIndex,
        endColumn: lastCharacterIndex + 1,
      };
    }
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

  private constructOffsetMap(codeLinesInLog: string[]): void {
    const codeLinesInRaw = this.constructCodeLinesInRaw();
    const beginIndexInLog = this.getRawCodeBeginLineNumberInWrappedCode();
    let indexInRaw = 0;
    let indexInLog = beginIndexInLog;
    let previousLineNumberInLog =
      decomposeCodeLogLine(codeLinesInLog[indexInLog]).lineNumber - 1;

    this.offsetMap = new Map<LineNumber, Offset>();

    while (
      indexInRaw < codeLinesInRaw.length &&
      indexInLog < codeLinesInLog.length
    ) {
      let {
        code: codeLineInRaw,
        lineNumber: lineNumberInRaw,
        column: columnInRaw,
      } = codeLinesInRaw[indexInRaw];

      let { code: codeLineInLog, lineNumber: lineNumberInLog } =
        decomposeCodeLogLine(codeLinesInLog[indexInLog]);

      // The line numbers in the source code within the log should be continuous.
      // but if encountering datasets following a datalines statement or %INC statement,
      // the line numbers will not be continuous.
      // for datalines-like statements, it will skip the number of dataset lines.
      // for %INC-like statements, it will continue without skip
      const delta2 = lineNumberInLog - previousLineNumberInLog;
      if (
        delta2 > 1 &&
        // if the code line in log can be found in raw,
        // think of the discontinuous line number is caused by %INC-like statements,
        // otherwise it is from datalines-like statements and need to skip lines in raw.
        !codeLineInRaw.trim().startsWith(codeLineInLog.trim())
      ) {
        indexInRaw += delta2 - 1;
        ({
          code: codeLineInRaw,
          lineNumber: lineNumberInRaw,
          column: columnInRaw,
        } = codeLinesInRaw[indexInRaw]);
      }

      while (
        !codeLineInRaw.trim().startsWith(codeLineInLog.trim()) &&
        indexInLog < codeLinesInLog.length - 1
      ) {
        ({ code: codeLineInLog, lineNumber: lineNumberInLog } =
          decomposeCodeLogLine(codeLinesInLog[++indexInLog]));
      }

      const offset = { lineOffset: lineNumberInRaw, columnOffset: columnInRaw };

      this.offsetMap.set(lineNumberInLog, offset);
      previousLineNumberInLog = lineNumberInLog;

      indexInRaw++;
      indexInLog++;
    }
  }

  // priority return selected code, otherwise, return whole code.
  private getRawCode(): string {
    return this.parameters.selectedCode.trim() === ""
      ? this.parameters.code
      : this.parameters.selectedCode;
  }
}
