import { expect } from "chai";
import sinon from "sinon";

import * as connection from "../../../src/connection";
import { runCode } from "../../../src/connection/itc/CodeRunner";
import { Session } from "../../../src/connection/session";

export class MockSession extends Session {
  protected _logFn;
  private _runMap: Record<string, string> | undefined;
  public sasSystemLine = "The Sas System";

  public set onSessionLogFn(logFn) {
    this._logFn = logFn;
  }
  public set onExecutionLogFn(logFn) {
    this._logFn = logFn;
  }

  public constructor(runMap?: Record<string, string>) {
    super();
    this._runMap = runMap;
  }

  protected async establishConnection(): Promise<void> {
    return;
  }

  protected async _run(codeString: string): Promise<connection.RunResult> {
    if (this._runMap) {
      const [, result] = Object.entries(this._runMap).find(([code]) =>
        codeString.includes(code),
      );
      if (result) {
        this._logFn(
          result.split("\n").map((line) => ({ line, type: "normal" })),
        );
        return;
      }
    }

    this._logFn(
      codeString.split("\n").map((line) => ({ line, type: "normal" })),
    );
    return {};
  }

  protected _close(): void | Promise<void> {}

  public sessionId?(): string {
    return "";
  }
}

describe.skip("CodeRunner tests", () => {
  let sessionStub;
  before(() => {
    sessionStub = sinon.stub(connection, "getSession");
    sessionStub.returns(new MockSession());
  });

  after(() => {
    sessionStub.restore();
  });

  it("parses output between start tag and end tag", async () => {
    const codeString = `
// prefixed sas code
<CodeTag>Test Code</CodeTag>
// postfixed sas code
    `;

    const results = await runCode(codeString, "<CodeTag>", "</CodeTag>");

    expect(results).to.equal("Test Code");
  });

  it("returns all output when no tags are specifed", async () => {
    const codeString = `
// prefixed sas code
<CodeTag>Test Code</CodeTag>
// postfixed sas code
    `;

    const results = await runCode(codeString);

    expect(results).to.equal(
      codeString
        .split("\n")
        .map((l) => l.trim())
        .join(""),
    );
  });
});
