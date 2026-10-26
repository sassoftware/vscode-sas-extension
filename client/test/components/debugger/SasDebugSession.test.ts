import { commands, window, workspace } from "vscode";

import type { DebugProtocol } from "@vscode/debugprotocol";

import { AxiosHeaders, AxiosResponse } from "axios";
import { expect } from "chai";
import * as path from "path";
import * as sinon from "sinon";

import { profileConfig } from "../../../src/commands/profile";
import {
  SasDebugSession,
  SasLaunchRequestArguments,
} from "../../../src/components/debugger/SasDebugSession";
import * as connection from "../../../src/connection";
import type { JobLogCollection } from "../../../src/connection/rest/api/compute";
import { ComputeJob } from "../../../src/connection/rest/job";
import { ComputeSession } from "../../../src/connection/rest/session";
import { Session } from "../../../src/connection/session";
import { useRunStore } from "../../../src/store";

function logResponse(data: JobLogCollection): AxiosResponse<JobLogCollection> {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { headers: new AxiosHeaders() },
  };
}

class TestDebugSession extends SasDebugSession {
  async launch(args: SasLaunchRequestArguments) {
    this.configurationDoneRequest({
      seq: 0,
      type: "response",
      request_seq: 1,
      command: "configurationDone",
      success: true,
    });
    const response: DebugProtocol.LaunchResponse = {
      seq: 0,
      type: "response",
      request_seq: 2,
      command: "launch",
      success: true,
    };
    await this.launchRequest(response, args);
    return response;
  }

  stackTrace() {
    const response: DebugProtocol.StackTraceResponse = {
      ...request("stackTrace"),
      body: { stackFrames: [] },
    };
    this.stackTraceRequest(response);
    return response.body;
  }

  scopes() {
    const response: DebugProtocol.ScopesResponse = {
      ...request("scopes"),
      body: { scopes: [] },
    };
    this.scopesRequest(response);
    return response.body;
  }

  variables(variablesReference: number) {
    const response: DebugProtocol.VariablesResponse = {
      ...request("variables"),
      body: { variables: [] },
    };
    this.variablesRequest(response, { variablesReference });
    return response.body;
  }
}

function request(command: string): DebugProtocol.Response {
  return {
    seq: 0,
    type: "response",
    request_seq: 1,
    command,
    success: true,
  };
}

class TestSession extends Session {
  executeDebuggerCode = sinon.stub().resolves("debug-job");
  protected async establishConnection() {}
  protected async _run() {
    return {};
  }
  protected _close() {}
  sessionId() {
    return "test-session";
  }
}

describe("DATA step debug program", () => {
  let adapter: TestDebugSession;
  let session: TestSession;
  let setup: sinon.SinonStub;
  let events: sinon.SinonStub;

  beforeEach(() => {
    adapter = new TestDebugSession();
    sinon.stub(adapter, "sendResponse");
    events = sinon.stub(adapter, "sendEvent");
    session = new TestSession();
    setup = sinon.stub(session, "setup").resolves();
    sinon.stub(connection, "getSession").returns(session);
    sinon.stub(profileConfig, "getActiveProfile").returns("test");
    useRunStore.getState().setIsExecutingCode(false);
  });

  afterEach(async () => {
    adapter.dispose();
    sinon.restore();
    useRunStore.getState().setIsExecutingCode(false);
    await commands.executeCommand("setContext", "SAS.running", false);
  });

  it("submits the active unsaved SAS document without changing its contents", async () => {
    const code = "data _null_;\n  x = 42;\nrun;";
    const document = await workspace.openTextDocument({
      language: "sas",
      content: code,
    });
    await window.showTextDocument(document);

    const response = await adapter.launch({});

    expect(response.success).to.equal(true);
    sinon.assert.calledOnceWithExactly(
      session.executeDebuggerCode,
      code,
      sinon.match.func,
    );
    expect(document.getText()).to.equal(code);
    expect(window.activeTextEditor.document.uri.toString()).to.equal(
      document.uri.toString(),
    );
  });

  it("loads the configured program instead of the active editor", async () => {
    const code = "data _null_; x = 7; run;";
    const program = await workspace.openTextDocument({
      language: "sas",
      content: code,
    });
    const other = await workspace.openTextDocument({
      language: "sas",
      content: "data _null_; x = 99; run;",
    });
    await window.showTextDocument(other);

    const response = await adapter.launch({ program: program.uri.toString() });

    expect(response.success).to.equal(true);
    sinon.assert.calledOnceWithExactly(
      session.executeDebuggerCode,
      code,
      sinon.match.func,
    );
    expect(window.activeTextEditor.document.uri.toString()).to.equal(
      program.uri.toString(),
    );
  });

  it("reads unsaved edits from a configured file path", async () => {
    const program = path.resolve(
      __dirname,
      "../../../../testFixture/SampleCode.sas",
    );
    const document = await workspace.openTextDocument(program);
    const editor = await window.showTextDocument(document);
    const original = document.getText();
    await editor.edit((edit) => {
      edit.insert(document.positionAt(original.length), "\n/* unsaved edit */");
    });
    try {
      const response = await adapter.launch({ program });

      expect(response.success).to.equal(true);
      sinon.assert.calledOnceWithExactly(
        session.executeDebuggerCode,
        document.getText(),
        sinon.match.func,
      );
      expect(document.isDirty).to.equal(true);
    } finally {
      await commands.executeCommand("workbench.action.files.revert");
    }
  });

  it("writes every callback log line to the Debug Console", async () => {
    const document = await workspace.openTextDocument({
      language: "sas",
      content: "data _null_; run;",
    });
    session.executeDebuggerCode.callsFake(
      async (_code: string, onLog: connection.OnLogFn) => {
        onLog([
          { type: "source", line: "data _null_; run;" },
          { type: "normal", line: "" },
          { type: "warning", line: "A warning" },
          { type: "error", line: "An error" },
        ]);
        onLog([{ type: "note", line: "A note" }]);
        return "debug-job";
      },
    );
    await adapter.launch({ program: document.uri.toString() });

    for (const [text, category] of [
      ["data _null_; run;\n", "console"],
      ["\n", "console"],
      ["A warning\n", "console"],
      ["An error\n", "stderr"],
      ["A note\n", "console"],
    ]) {
      sinon.assert.calledWithMatch(events, {
        event: "output",
        body: { output: text, category },
      });
    }
  });

  it("rejects a non-SAS document without submitting code", async () => {
    const document = await workspace.openTextDocument({
      language: "plaintext",
      content: "not SAS",
    });

    const response = await adapter.launch({ program: document.uri.toString() });

    expect(response.success).to.equal(false);
    sinon.assert.notCalled(session.executeDebuggerCode);
    sinon.assert.notCalled(setup);
  });

  it("rejects an empty SAS document without submitting code", async () => {
    const document = await workspace.openTextDocument({
      language: "sas",
      content: " \n",
    });

    const response = await adapter.launch({ program: document.uri.toString() });

    expect(response.success).to.equal(false);
    sinon.assert.notCalled(session.executeDebuggerCode);
  });

  it("reports an invalid program instead of falling back to the active editor", async () => {
    const response = await adapter.launch({ program: "" });

    expect(response.success).to.equal(false);
    sinon.assert.notCalled(session.executeDebuggerCode);
  });

  it("reports an unreadable file without submitting code", async () => {
    const response = await adapter.launch({
      program: "/nonexistent-sas-debug-test/program.sas",
    });

    expect(response.success).to.equal(false);
    sinon.assert.notCalled(session.executeDebuggerCode);
  });

  describe("Variables view", () => {
    const program = [
      "data _null_;",
      "  a = 1 + 2;",
      "  name = 'x';",
      "run;",
    ].join("\n");

    const debuggerLog = (stopSource: string): connection.LogLine[] =>
      [
        "10   options dsoptions=ldebug notes source;",
        "11   data _null_;",
        "12     a = 1 + 2;",
        "13     name = 'x';",
        "14   run;",
        "Stopped at line 12 column 3",
        `12     ${stopSource}`,
        "DEBUG> describe _all_;",
        "Name = a, Type = NUM, Length = 8",
        "Name = name, Type = CHAR, Length = 1",
        "Name = _ERROR_, Type = NUM, Length = 8",
        "Name = _N_, Type = NUM, Length = 8",
        "DEBUG> examine _all_;",
        "a = .",
        "name = ",
        "_ERROR_ = 0",
        "_N_ = 1",
        "DEBUG>",
      ].map((line) => ({ type: "normal", line }));

    const launchWithLog = async (log: connection.LogLine[]) => {
      const document = await workspace.openTextDocument({
        language: "sas",
        content: program,
      });
      session.executeDebuggerCode.callsFake(
        async (_code: string, onLog: connection.OnLogFn) => {
          onLog(log);
          return "debug-job";
        },
      );
      await adapter.launch({ program: document.uri.toString() });
      return document;
    };

    it("stops at the mapped document line after the job completes", async () => {
      const document = await launchWithLog(debuggerLog("a = 1 + 2;"));

      sinon.assert.calledWithMatch(events, {
        event: "stopped",
        body: { reason: "step", threadId: 1 },
      });
      const { stackFrames } = adapter.stackTrace();
      expect(stackFrames).to.have.length(1);
      expect(stackFrames[0]).to.include({ line: 2, column: 3 });
      expect(stackFrames[0].source.path).to.equal(document.uri.toString());
    });

    it("splits variables into user and automatic scopes", async () => {
      await launchWithLog(debuggerLog("a = 1 + 2;"));

      expect(adapter.scopes().scopes.map((scope) => scope.name)).to.deep.equal([
        "Variables",
        "Automatic Variables",
      ]);
      const [variablesScope, automaticScope] = adapter.scopes().scopes;
      expect(
        adapter.variables(variablesScope.variablesReference).variables,
      ).to.deep.equal([
        { name: "a", value: ".", type: "NUM(8)", variablesReference: 0 },
        { name: "name", value: '""', type: "CHAR(1)", variablesReference: 0 },
      ]);
      expect(
        adapter
          .variables(automaticScope.variablesReference)
          .variables.map(({ name, value }) => ({ name, value })),
      ).to.deep.equal([
        { name: "_ERROR_", value: "0" },
        { name: "_N_", value: "1" },
      ]);
      expect(adapter.variables(99).variables).to.deep.equal([]);
    });

    it("omits the source when the echoed statement does not match", async () => {
      await launchWithLog(debuggerLog("something else;"));

      const [frame] = adapter.stackTrace().stackFrames;
      expect(frame.source).to.equal(undefined);
      expect(frame.line).to.equal(0);
      sinon.assert.calledWithMatch(events, {
        event: "output",
        body: { category: "stderr" },
      });
    });

    it("does not stop when the log contains no debugger stop", async () => {
      await launchWithLog([{ type: "normal", line: "NOTE: done" }]);

      sinon.assert.neverCalledWithMatch(events, { event: "stopped" });
      expect(adapter.stackTrace().stackFrames).to.deep.equal([]);
      expect(adapter.scopes().scopes).to.deep.equal([]);
    });
  });
});

describe("Compute debugger submission", () => {
  afterEach(() => sinon.restore());

  for (const newline of ["\n", "\r\n"]) {
    it(`wraps caller code in debugger setup (${JSON.stringify(newline)})`, async () => {
      const session = new ComputeSession("test-session");
      const job = new ComputeJob("debug-job");
      sinon.stub(job, "getState").resolves("completed");
      sinon.stub(job, "isDone").resolves(true);
      const execute = sinon.stub(session, "execute").resolves(job);
      sinon.stub(job.logs, "getJobLog").resolves(logResponse({ items: [] }));

      const jobId = await session.executeDebuggerCode(
        ["data _null_;", "  x = 123;", "run;"].join(newline),
        sinon.spy(),
      );

      expect(jobId).to.equal("debug-job");
      sinon.assert.calledOnceWithExactly(execute, {
        code: [
          "options dsoptions=ldebug notes source;",
          "data _null_;",
          "  x = 123;",
          "run;",
          "describe _all_;",
          "examine _all_;",
        ],
      });
    });
  }

  it("waits for completion before fetching all log pages in order", async () => {
    const session = new ComputeSession("test-session");
    const job = new ComputeJob("debug-job");
    sinon.stub(session, "execute").resolves(job);
    const state = sinon.stub(job, "getState");
    state.onFirstCall().resolves("running");
    state.onSecondCall().resolves("completed");
    const stream = sinon.stub(job, "getLogStream");
    const nextLink = { rel: "next", href: "/next-log-page", method: "GET" };
    const firstPage: connection.LogLine[] = [
      { type: "source", line: "data _null_; run;" },
    ];
    const secondPage: connection.LogLine[] = [
      { type: "normal", line: "Variable values" },
    ];
    const getLog = sinon
      .stub(job.logs, "getJobLog")
      .resolves(logResponse({ items: firstPage, links: [nextLink] }));
    const nextPage = sinon
      .stub(job, "requestLink")
      .resolves(logResponse({ items: secondPage }));
    const onLog = sinon.spy();

    expect(
      await session.executeDebuggerCode("data _null_; run;", onLog),
    ).to.equal("debug-job");

    sinon.assert.calledWithExactly(state, { wait: 5, onChange: true });
    expect(state.secondCall.calledBefore(getLog.firstCall)).to.equal(true);
    sinon.assert.calledOnceWithExactly(getLog, {
      sessionId: "test-session",
      jobId: "debug-job",
      start: 0,
    });
    sinon.assert.calledOnceWithExactly(nextPage, nextLink);
    expect(onLog.args).to.deep.equal([[firstPage], [secondPage]]);
    sinon.assert.notCalled(stream);
  });

  it("propagates log retrieval errors", async () => {
    const session = new ComputeSession("test-session");
    const job = new ComputeJob("debug-job");
    sinon.stub(session, "execute").resolves(job);
    sinon.stub(job, "getState").resolves("completed");
    const error = new Error("Failed to retrieve log");
    sinon.stub(job.logs, "getJobLog").rejects(error);
    const onLog = sinon.spy();

    try {
      await session.executeDebuggerCode("data _null_; run;", onLog);
      expect.fail("Expected log retrieval to fail");
    } catch (actual) {
      expect(actual).to.equal(error);
    }
    sinon.assert.notCalled(onLog);
  });
});
