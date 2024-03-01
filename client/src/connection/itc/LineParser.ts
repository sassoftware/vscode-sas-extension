export class LineParser {
  protected errorLines: string[] = [];
  protected capturingError: boolean = false;
  protected startTag: string;
  protected endTag: string;

  public constructor(startTag: string, endTag: string) {
    this.startTag = startTag;
    this.endTag = endTag;
  }

  public processLine(line: string): string | undefined {
    if (line.includes(this.startTag) || this.capturingError) {
      this.errorLines.push(line);
      this.capturingError = true;
      if (line.includes(this.endTag)) {
        return this.processedError();
      }
      return;
    }

    return;
  }

  protected processedError(): string {
    this.capturingError = false;
    const fullError = this.errorLines.join('').replace(this.startTag, '').replace(this.endTag,'');
    this.errorLines = [];
    return fullError;
  }
}