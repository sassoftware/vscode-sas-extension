// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export class LineParser {
  protected processedLines: string[] = [];
  protected capturingLine: boolean = false;

  public constructor(
    protected startTag: string,
    protected endTag: string,
    protected returnNonProcessedLines: boolean,
  ) {}

  public processLine(line: string): string | undefined {
    if (line.includes(this.startTag) || this.capturingLine) {
      this.processedLines.push(line);
      this.capturingLine = true;
      if (line.includes(this.endTag)) {
        return this.processedLine();
      }
      return;
    }

    return this.returnNonProcessedLines ? line : undefined;
  }

  protected processedLine(): string {
    this.capturingLine = false;
    const fullError = this.processedLines
      .join("")
      .replace(this.startTag, "")
      .replace(this.endTag, "");
    this.processedLines = [];
    return fullError;
  }

  public isCapturingLine(): boolean {
    return this.capturingLine;
  }
}
