// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { Selection } from "vscode";

export interface CodeMetadata {
  languageId: string;
  code: string;
  selectedCode: string;
  uri?: string;
  fileName?: string;
}

export interface SASCodeDocumentOptions {
  selections?: ReadonlyArray<Selection>;
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

  public constructor(
    private metadata: CodeMetadata,
    private options?: SASCodeDocumentOptions,
  ) {}

  public getWrappedCode(): string {
    const code = this.getRawCode();
    return this.codeIsEmpty(code) ? "" : this.wrapCode(code);
  }

  public getUri(): string {
    return this.metadata.uri;
  }

  public wrappedCodeLineAt(lineNumber: number) {
    return this.getWrappedCode().split("\n")[lineNumber];
  }

  public rawCodeOffsetFor(lineNumberInWrappedCode: number): Offset {
    if (this.offsetMap === undefined) {
      this.constructOffsetMap();
    }

    return this.offsetMap.get(lineNumberInWrappedCode);
  }

  private codeIsEmpty(code: string): boolean {
    return code.trim() === "";
  }

  private selectionsAreEmpty(): boolean {
    return (
      this.options.selections === undefined ||
      this.options.selections.length === 0
    );
  }

  private wrapCodeWithSASProgramFileName(
    code: string,
    fileName: string | undefined,
  ): string {
    if (fileName === undefined) {
      return code;
    } else {
      fileName = fileName.replace(/[('")]/g, "%$&");
      const wrapped =
        "%let _SASPROGRAMFILE = %nrquote(%nrstr(" + fileName + "));\n" + code;
      return wrapped;
    }
  }

  private wrapCodeWithPreambleAndPostamble(
    code: string,
    preamble?: string,
    postamble?: string,
  ): string {
    return (
      (preamble ? preamble + "\n" : "") +
      code +
      (postamble ? "\n" + postamble : "")
    );
  }

  private wrapCodeWithOutputHtml(code: string): string {
    if (this.options.outputHtml) {
      const htmlStyle = this.options.htmlStyle.trim();
      const htmlStyleOption = htmlStyle !== "" ? ` style=${htmlStyle}` : "";
      const outputDestination = this.options?.uuid
        ? ` body="${this.options.uuid}.htm"`
        : "";

      return `title;footnote;ods _all_ close;
ods graphics on;
ods html5${htmlStyleOption} options(bitmap_mode='inline' svg_mode='inline')${outputDestination};
${code}
;*';*";*/;run;quit;ods html5 close;`;
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

  private wrapCode(code: string): string {
    let wrapped = code;

    if (this.metadata.languageId === "sql") {
      wrapped = this.wrapSQL(wrapped);
    }

    if (this.metadata.languageId === "python") {
      wrapped = this.wrapPython(wrapped);
    }

    wrapped = this.wrapCodeWithSASProgramFileName(
      wrapped,
      this.metadata.fileName,
    );

    wrapped = this.wrapCodeWithPreambleAndPostamble(
      wrapped,
      this.options?.preamble,
      this.options?.postamble,
    );
    wrapped = this.wrapCodeWithOutputHtml(wrapped);

    return wrapped;
  }

  // getWrappedCode() returns more code than raw code in editor, and addition code may be added at the beginning or end of raw code.
  // this method return the position at which the raw code begins after wrapped.
  private getRawCodeBeginLineNumber(): number {
    const FRONT_LOCATOR = "LOCATOR-TO-MARK-THE-BEGIN-OF-USER-CODE";
    const codeWithLocator = FRONT_LOCATOR + this.getRawCode();
    const wrapped = this.wrapCode(codeWithLocator);
    return wrapped
      .split("\n")
      .findIndex((line) => line.includes(FRONT_LOCATOR));
  }

  private constructOffsetMap(): void {
    const selections = this.options.selections;

    let lineNumberInCodeToRun = this.getRawCodeBeginLineNumber();

    this.offsetMap = new Map<LineNumber, Offset>();
    selections.forEach((selection) => {
      const { start, end } = selection;
      for (let i = start.line; i <= end.line; i++) {
        const offset = {
          lineOffset: i - lineNumberInCodeToRun,
          columnOffset: i === start.line ? start.character : 0,
        };
        this.offsetMap.set(lineNumberInCodeToRun++, offset);
      }
    });
  }

  // priority return selected code, otherwise, return whole code.
  private getRawCode(): string {
    return this.metadata.selectedCode.trim() === ""
      ? this.metadata.code
      : this.metadata.selectedCode;
  }
}
