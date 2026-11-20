import { Disposable, commands, extensions, window, workspace } from "vscode";
import type { BaseLanguageClient } from "vscode-languageclient";

import type { DebugProtocol } from "@vscode/debugprotocol";

import { AxiosHeaders, AxiosResponse } from "axios";
import { expect } from "chai";
import * as path from "path";
import * as sinon from "sinon";

import { profileConfig } from "../../../src/commands/profile";
import {
  DEBUG_DOCUMENT_SCHEME,
  debugDocumentProvider,
} from "../../../src/components/debugger/DebugDocumentProvider";
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
    await this.launchRequest(response, {
      position: { line: 0, character: 0 },
      ...args,
    });
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

  async step(command: "next" | "stepIn" | "continue" = "next") {
    const response = { ...request(command), body: {} };
    if (command === "next") {
      await this.nextRequest(response);
    } else if (command === "continue") {
      await this.continueRequest(response);
    } else {
      await this.stepInRequest(response);
    }
    return response;
  }

  async setBreakpoints(lines: number[]) {
    const response: DebugProtocol.SetBreakpointsResponse = {
      ...request("setBreakpoints"),
      body: { breakpoints: [] },
    };
    await this.setBreakPointsRequest(response, {
      source: {},
      breakpoints: lines.map((line) => ({ line })),
    });
    return response;
  }
}

const DEBUG_HEADER = "/* DEBUGGING */\n";

// Reports the whole requested document as a single DATA step block
function createLanguageClient(): BaseLanguageClient {
  const client = {
    isRunning: () => true,
    sendRequest: async (
      _method: string,
      params: { textDocument: { uri: string } },
    ) => {
      const document = workspace.textDocuments.find(
        (open) => open.uri.toString() === params.textDocument.uri,
      );
      const end = document.lineAt(document.lineCount - 1).range.end;
      return {
        type: 0,
        startLine: 0,
        startCol: 0,
        endLine: end.line,
        endCol: end.character,
      };
    },
  };
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return client as unknown as BaseLanguageClient;
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
  executeDebuggerCommand = sinon.stub().resolves("step-job");
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
  let responses: sinon.SinonStub;
  let debugDocuments: Disposable;

  before(async () => {
    // The bundled extension registers its own provider instance, which cannot
    // resolve documents created by the provider instance imported here
    await extensions.getExtension("SAS.sas-lsp")?.activate();
    debugDocuments = workspace.registerTextDocumentContentProvider(
      DEBUG_DOCUMENT_SCHEME,
      debugDocumentProvider,
    );
  });

  after(() => debugDocuments.dispose());

  beforeEach(() => {
    adapter = new TestDebugSession(createLanguageClient());
    responses = sinon.stub(adapter, "sendResponse");
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
    const debugEditor = window.activeTextEditor;
    expect(debugEditor.document.uri.toString()).not.to.equal(
      document.uri.toString(),
    );
    expect(debugEditor.document.uri.scheme).to.equal("sas-debug");
    expect(debugEditor.document.languageId).to.equal("sas");
    expect(debugEditor.document.getText()).to.equal(DEBUG_HEADER + code);
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
    expect(window.activeTextEditor.document.uri.toString()).not.to.equal(
      program.uri.toString(),
    );
    expect(window.activeTextEditor.document.getText()).to.equal(
      DEBUG_HEADER + code,
    );
    expect(program.getText()).to.equal(code);
    expect(other.getText()).to.equal("data _null_; x = 99; run;");
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
      await window.showTextDocument(document);
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
        "1    options dsoptions=ldebug notes source;",
        "2    data _null_;",
        "3      a = 1 + 2;",
        "4      name = 'x';",
        "5    run;",
        "Stopped at line 3 column 3",
        `3      ${stopSource}`,
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
      const debugDocument = window.activeTextEditor.document;
      expect(debugDocument.uri.toString()).not.to.equal(
        document.uri.toString(),
      );
      expect(debugDocument.getText()).to.equal(DEBUG_HEADER + program);
      return debugDocument;
    };

    it("stops at the mapped document line after the job completes", async () => {
      const document = await launchWithLog(debuggerLog("a = 1 + 2;"));

      sinon.assert.calledWithMatch(events, {
        event: "stopped",
        body: { reason: "step", threadId: 1 },
      });
      const { stackFrames } = adapter.stackTrace();
      expect(stackFrames).to.have.length(1);
      expect(stackFrames[0]).to.include({ line: 3, column: 3 });
      expect(stackFrames[0].source.path).to.equal(document.uri.toString());
    });

    it("lists all variables in a single scope", async () => {
      await launchWithLog(debuggerLog("a = 1 + 2;"));

      expect(adapter.scopes().scopes.map((scope) => scope.name)).to.deep.equal([
        "Variables",
      ]);
      const [variablesScope] = adapter.scopes().scopes;
      expect(
        adapter.variables(variablesScope.variablesReference).variables,
      ).to.deep.equal([
        { name: "a", value: ".", type: "NUM(8)", variablesReference: 0 },
        { name: "name", value: '""', type: "CHAR(1)", variablesReference: 0 },
        { name: "_ERROR_", value: "0", type: "NUM(8)", variablesReference: 0 },
        { name: "_N_", value: "1", type: "NUM(8)", variablesReference: 0 },
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

    for (const command of ["next", "stepIn", "continue"] as const) {
      const sasCommand = command === "continue" ? "go;" : "step;";
      it(`submits only ${sasCommand} for ${command} and updates the stopped line`, async () => {
        const document = await launchWithLog(debuggerLog("a = 1 + 2;"));
        events.resetHistory();
        session.executeDebuggerCommand.callsFake(
          async (
            _command: string,
            _checkVariableChanges: boolean,
            onLog: connection.OnLogFn,
          ) => {
            onLog([{ type: "normal", line: "Stepped to line 4 column 3" }]);
            onLog([
              { type: "normal", line: "4      name = 'x';" },
              { type: "error", line: "A diagnostic" },
              { type: "normal", line: "DEBUG>" },
            ]);
            return "step-job";
          },
        );

        const response = await adapter.step(command);

        expect(response.success).to.equal(true);
        if (command === "continue") {
          expect(response.body).to.deep.equal({ allThreadsContinued: true });
        }
        sinon.assert.calledOnceWithExactly(
          session.executeDebuggerCommand,
          sasCommand,
          true,
          sinon.match.func,
        );
        sinon.assert.calledOnce(session.executeDebuggerCode);
        sinon.assert.calledOnce(setup);
        sinon.assert.calledWithMatch(events, {
          event: "output",
          body: {
            output: "Stepped to line 4 column 3\n",
            category: "console",
          },
        });
        sinon.assert.calledWithMatch(events, {
          event: "output",
          body: { output: "A diagnostic\n", category: "stderr" },
        });
        sinon.assert.calledWithMatch(events, {
          event: "stopped",
          body: { reason: "step", threadId: 1 },
        });
        const [frame] = adapter.stackTrace().stackFrames;
        expect(frame).to.include({ line: 4, column: 3 });
        expect(frame.source.path).to.equal(document.uri.toString());
        // DESCRIBE attributes from the launch are kept; this stop has no values
        expect(adapter.variables(1).variables).to.deep.equal(
          [
            ["a", "NUM(8)"],
            ["name", "CHAR(1)"],
            ["_ERROR_", "NUM(8)"],
            ["_N_", "NUM(8)"],
          ].map(([name, type]) => ({
            name,
            value: "",
            type,
            variablesReference: 0,
          })),
        );
        expect(useRunStore.getState().isExecutingCode).to.equal(false);
      });
    }

    it("submits a break command for each requested line without changing the stop", async () => {
      await launchWithLog(debuggerLog("a = 1 + 2;"));
      events.resetHistory();
      const previousVariables = adapter.variables(1);
      responses.resetHistory();
      session.executeDebuggerCommand.callsFake(
        async (
          _command: string,
          _checkVariableChanges: boolean,
          onLog: connection.OnLogFn,
        ) => {
          onLog([{ type: "normal", line: "DEBUG> break command accepted" }]);
          return "break-job";
        },
      );

      const response = await adapter.setBreakpoints([3, 4]);

      expect(response.success).to.equal(true);
      expect(
        session.executeDebuggerCommand.args.map(([command, check]) => [
          command,
          check,
        ]),
      ).to.deep.equal([
        ["break 3;", false],
        ["break 4;", false],
      ]);
      expect(response.body.breakpoints.map(({ line }) => line)).to.deep.equal([
        3, 4,
      ]);
      sinon.assert.calledOnceWithExactly(responses, response);
      sinon.assert.calledWithMatch(events, {
        event: "output",
        body: { output: "DEBUG> break command accepted\n" },
      });
      sinon.assert.neverCalledWithMatch(events, { event: "stopped" });
      expect(adapter.stackTrace().stackFrames[0].line).to.equal(3);
      expect(adapter.variables(1)).to.deep.equal(previousVariables);
      expect(useRunStore.getState().isExecutingCode).to.equal(false);
    });

    it("reports breakpoint command failures without submitting the remaining commands", async () => {
      await launchWithLog(debuggerLog("a = 1 + 2;"));
      session.executeDebuggerCommand.rejects(
        new Error("Cannot set breakpoint"),
      );
      responses.resetHistory();

      const response = await adapter.setBreakpoints([3, 4]);

      expect(response.success).to.equal(false);
      expect(response.message).to.contain("Cannot set breakpoint");
      sinon.assert.calledOnce(session.executeDebuggerCommand);
      sinon.assert.calledOnce(responses);
      expect(adapter.stackTrace().stackFrames[0].line).to.equal(3);
    });

    it("handles an empty breakpoint list without submitting a command", async () => {
      const response = await adapter.setBreakpoints([]);

      expect(response.success).to.equal(true);
      expect(response.body.breakpoints).to.deep.equal([]);
      sinon.assert.notCalled(session.executeDebuggerCommand);
    });

    it("does not reuse the previous stop when a command log has no stop", async () => {
      await launchWithLog(debuggerLog("a = 1 + 2;"));
      events.resetHistory();
      session.executeDebuggerCommand.callsFake(
        async (
          _command: string,
          _checkVariableChanges: boolean,
          onLog: connection.OnLogFn,
        ) => {
          onLog([{ type: "note", line: "NOTE: DATA step finished." }]);
          return "step-job";
        },
      );

      await adapter.step();

      sinon.assert.neverCalledWithMatch(events, { event: "stopped" });
      expect(adapter.stackTrace().stackFrames).to.deep.equal([]);
    });

    it("reports command failures and preserves the previous stop", async () => {
      await launchWithLog(debuggerLog("a = 1 + 2;"));
      events.resetHistory();
      session.executeDebuggerCommand.rejects(new Error("Command failed"));

      const response = await adapter.step();

      expect(response.success).to.equal(false);
      expect(response.message).to.contain("Command failed");
      sinon.assert.calledWithMatch(events, {
        event: "output",
        body: { category: "stderr" },
      });
      sinon.assert.neverCalledWithMatch(events, { event: "stopped" });
      expect(adapter.stackTrace().stackFrames[0].line).to.equal(3);
      expect(useRunStore.getState().isExecutingCode).to.equal(false);
    });

    it("rejects a step while SAS code is running", async () => {
      await launchWithLog(debuggerLog("a = 1 + 2;"));
      useRunStore.getState().setIsExecutingCode(true);

      const response = await adapter.step();

      expect(response.success).to.equal(false);
      sinon.assert.notCalled(session.executeDebuggerCommand);
      expect(useRunStore.getState().isExecutingCode).to.equal(true);
    });

    it("rejects a step before the debugger has stopped", async () => {
      const response = await adapter.step();

      expect(response.success).to.equal(false);
      sinon.assert.notCalled(session.executeDebuggerCommand);
    });
  });
});

describe("Compute debugger submission", () => {
  afterEach(() => sinon.restore());

  for (const checkVariableChanges of [false, true]) {
    it(`submits a debugger command ${checkVariableChanges ? "with" : "without"} a hidden examine`, async () => {
      const session = new ComputeSession("test-session");
      const job = new ComputeJob("step-job");
      sinon.stub(job, "getState").resolves("completed");
      const execute = sinon.stub(session, "execute").resolves(job);
      const lines: connection.LogLine[] = [
        { type: "normal", line: "Stepped to line 13 column 3" },
      ];
      sinon.stub(job.logs, "getJobLog").resolves(logResponse({ items: lines }));
      const onLog = sinon.spy();

      expect(
        await session.executeDebuggerCommand(
          "step;",
          checkVariableChanges,
          onLog,
        ),
      ).to.equal("step-job");

      sinon.assert.calledOnceWithExactly(execute, {
        code: checkVariableChanges
          ? ["step;", "examine _all_; /*hideInLog*/"]
          : ["step;"],
      });
      sinon.assert.calledOnceWithExactly(onLog, lines);
    });
  }

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
          "resetline;",
          "options dsoptions=ldebug notes source;",
          "data _null_;",
          "  x = 123;",
          "run;",
          "describe _all_; /*hideInLog*/",
          "examine _all_; /*hideInLog*/",
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
