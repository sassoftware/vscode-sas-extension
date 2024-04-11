import { expect } from "chai";
import sinon from "sinon";

import * as connection from "../../../src/connection";
import CodeRunner from "../../../src/connection/itc/CodeRunner";
import { Session } from "../../../src/connection/session";

export class MockSession extends Session {
  private _logFn;
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

  public async run(codeString: string): Promise<connection.RunResult> {
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

  public close(): void | Promise<void> {}

  public sessionId?(): string {
    return "";
  }
}

describe("CodeRunner tests", () => {
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

    const codeRunner = new CodeRunner();
    const results = await codeRunner.runCode(
      codeString,
      "<CodeTag>",
      "</CodeTag>",
    );

    expect(results).to.equal("Test Code");
  });

  it("returns all output when no tags are specifed", async () => {
    const codeString = `
// prefixed sas code
<CodeTag>Test Code</CodeTag>
// postfixed sas code
    `;

    const codeRunner = new CodeRunner();
    const results = await codeRunner.runCode(codeString);

    expect(results).to.equal(
      codeString
        .split("\n")
        .map((l) => l.trim())
        .join(""),
    );
  });
});
