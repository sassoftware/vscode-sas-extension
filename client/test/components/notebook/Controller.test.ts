import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

import assert from "assert";
import { AxiosError } from "axios";
import proxyquire from "proxyquire";
import sinon from "sinon";

import { SASCodeDocument } from "../../../src/components/utils/SASCodeDocument";
import type { LogLine } from "../../../src/connection";
import { useLogStore, useRunStore } from "../../../src/store";

describe("Notebook execution preparation", () => {
  beforeEach(() => {
    useRunStore.getState().setIsExecutingCode(false);
  });

  function createController(source?: string) {
    const execution = {
      start: sinon.stub(),
      clearOutput: sinon.stub(),
      replaceOutput: sinon.stub(),
      appendOutput: sinon.stub(),
      end: sinon.stub(),
    };
    const controller = {
      executeHandler: sinon.stub().resolves(),
      interruptHandler: sinon.stub(),
      dispose: sinon.stub(),
      createNotebookCellExecution: sinon.stub().returns(execution),
    };
    const session: {
      setup: sinon.SinonStub;
      run: sinon.SinonStub;
      cancel: sinon.SinonStub;
      onExecutionLogFn?: (lines: LogLine[]) => void;
      onSessionLogFn?: (lines: LogLine[]) => void;
    } = {
      setup: sinon.stub().resolves(),
      run: sinon.stub().resolves({}),
      cancel: sinon.stub(),
      onExecutionLogFn: undefined,
    };
    const prepare = sinon.stub().resolves("prepared notebook code");
    const cleanOutput = sinon.stub().returns(true);
    const progress = sinon.stub().callsFake((_options, task) => task());
    const appendExecutionLog = sinon.stub();
    const appendSessionLog = sinon.stub();
    const executeCommand = sinon.stub().resolves();
    class CodeDocument {
      getWrappedNotebookCode = prepare;
      getPythonAutodisplayId() {
        return undefined;
      }
      getWrappedCode() {
        return "original notebook code";
      }
      getBaseDirectory() {
        return "/notebook";
      }
    }
    const {
      NotebookController,
    }: typeof import("../../../src/components/notebook/Controller") =
      proxyquire("../../../src/components/notebook/Controller", {
        vscode: {
          "@noCallThru": true,
          l10n: vscode.l10n,
          ProgressLocation: vscode.ProgressLocation,
          CancellationTokenSource: vscode.CancellationTokenSource,
          NotebookCellOutput: vscode.NotebookCellOutput,
          NotebookCellOutputItem: vscode.NotebookCellOutputItem,
          commands: { executeCommand },
          notebooks: {
            createNotebookController: sinon.stub().returns(controller),
          },
          window: { withProgress: progress, showErrorMessage: sinon.stub() },
        },
        "../../connection": { getSession: () => session },
        "../../store": { useRunStore },
        "../logViewer": {
          "@noCallThru": true,
          appendExecutionLogFn: appendExecutionLog,
          appendSessionLogFn: appendSessionLog,
        },
        "../utils/SASCodeDocument": {
          SASCodeDocument:
            source === undefined ? CodeDocument : SASCodeDocument,
        },
        "../utils/SASCodeDocumentHelper": {
          getCodeDocumentConstructionParameters: () =>
            source === undefined
              ? {}
              : {
                  languageId: "python",
                  code: source,
                  selectedCode: "",
                  fileName: "/notebook/cell.py",
                  checkKeyword: async () => false,
                },
        },
        "../utils/settings": {
          getNotebookCleanOutput: cleanOutput,
        },
      });
    const client = sinon.createStubInstance(LanguageClient);
    const provider = new NotebookController(client);
    return {
      provider,
      controller,
      execution,
      session,
      prepare,
      cleanOutput,
      progress,
      client,
      appendExecutionLog,
      appendSessionLog,
      executeCommand,
    };
  }

  it("does not prepare code or start a session during construction", () => {
    const { prepare, session } = createController();
    assert.strictEqual(prepare.callCount, 0);
    assert.strictEqual(session.setup.callCount, 0);
    assert.strictEqual(session.run.callCount, 0);
  });

  function createProgramRunner(
    session: ReturnType<typeof createController>["session"],
  ) {
    const parameters = {
      languageId: "sas",
      code: "data _null_; run;",
      selectedCode: "",
      fileName: "/program.sas",
      checkKeyword: async () => false,
    };
    const codeDoc = new SASCodeDocument(parameters);
    const executeCommand = sinon.stub().resolves();
    const runCommands: typeof import("../../../src/commands/run") = proxyquire(
      "../../../src/commands/run",
      {
        vscode: {
          "@noCallThru": true,
          commands: { executeCommand },
          l10n: vscode.l10n,
          ProgressLocation: vscode.ProgressLocation,
          window: {
            activeTextEditor: { document: {} },
            withProgress: sinon
              .stub()
              .callsFake((_options, task) =>
                task(undefined, { onCancellationRequested: sinon.stub() }),
              ),
            showErrorMessage: sinon.stub(),
          },
        },
        "../components/ResultPanel": { showResult: sinon.stub() },
        "../components/logViewer": {
          appendExecutionLogFn: sinon.stub(),
          appendSessionLogFn: sinon.stub(),
          setFileName: sinon.stub(),
        },
        "../components/logViewer/sasDiagnostics": {
          sasDiagnostic: {
            generateLogFn: sinon.stub().callsFake((_doc, callback) => callback),
          },
        },
        "../components/utils/SASCodeDocument": { SASCodeDocument },
        "../components/utils/SASCodeDocumentHelper": {
          getCodeDocumentConstructionParameters: () => parameters,
        },
        "../components/utils/settings": { isOutputHtmlEnabled: () => false },
        "../connection": { getSession: () => session },
        "../store": { useRunStore },
        "./profile": {
          profileConfig: { getActiveProfile: () => "test" },
          switchProfile: sinon.stub(),
        },
      },
    );
    return { runCommands, codeDoc, executeCommand };
  }

  it("publishes one lifecycle for each batch, not each cell", async () => {
    const { controller, session, executeCommand } = createController();
    const transitions: boolean[] = [];
    const unsubscribe = useRunStore.subscribe(
      (state) => state.isExecutingCode,
      (executing) => transitions.push(executing),
    );
    session.setup.callsFake(async () => {
      assert.strictEqual(useRunStore.getState().isExecutingCode, true);
      assert.strictEqual(useRunStore.getState().isUserExecuting, true);
    });
    try {
      await controller.executeHandler([
        { document: { languageId: "sas" } },
        { document: { languageId: "sas" } },
        { document: { languageId: "sql" } },
      ]);
      await controller.executeHandler([{ document: { languageId: "sas" } }]);
      assert.deepStrictEqual(transitions, [true, false, true, false]);
      assert.strictEqual(session.run.callCount, 4);
      assert.deepStrictEqual(executeCommand.args, [
        ["setContext", "SAS.running", true],
        ["setContext", "SAS.running", false],
        ["setContext", "SAS.running", true],
        ["setContext", "SAS.running", false],
      ]);
    } finally {
      unsubscribe();
    }
  });

  it("does not publish lifecycle events for an empty batch", async () => {
    const { controller, session, executeCommand } = createController();
    await controller.executeHandler([]);
    assert.strictEqual(session.setup.callCount, 0);
    assert.strictEqual(executeCommand.callCount, 0);
    assert.strictEqual(useRunStore.getState().isExecutingCode, false);
  });

  for (const stage of ["setup", "run"]) {
    it(`releases the batch lifecycle after ${stage} rejects`, async () => {
      const { controller, session, executeCommand } = createController();
      const operation = stage === "setup" ? session.setup : session.run;
      operation.rejects(new Error("Execution failed"));
      await controller.executeHandler([{ document: { languageId: "sas" } }]);
      assert.strictEqual(useRunStore.getState().isExecutingCode, false);
      assert.deepStrictEqual(executeCommand.lastCall.args, [
        "setContext",
        "SAS.running",
        false,
      ]);
      operation.resolves({});
      await controller.executeHandler([{ document: { languageId: "sas" } }]);
      assert.strictEqual(session.setup.callCount, 2);
      assert.strictEqual(useRunStore.getState().isExecutingCode, false);
    });
  }

  it("does not acquire or release a running .sas program", async () => {
    const { controller, session, executeCommand } = createController();
    const { runCommands } = createProgramRunner(session);
    let finish!: (result: object) => void;
    session.run.returns(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const program = runCommands.run();
    await Promise.resolve();
    await controller.executeHandler([{ document: { languageId: "sas" } }]);
    assert.strictEqual(useRunStore.getState().isExecutingCode, true);
    assert.strictEqual(session.setup.callCount, 1);
    assert.strictEqual(session.run.callCount, 1);
    assert.strictEqual(executeCommand.callCount, 0);
    finish({});
    await program;
    assert.strictEqual(useRunStore.getState().isExecutingCode, false);
  });

  it("does not let skipped .sas commands or tasks release a notebook batch", async () => {
    const { controller, session } = createController();
    const { runCommands, codeDoc, executeCommand } =
      createProgramRunner(session);
    let finish!: (result: object) => void;
    session.run.returns(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const notebook = controller.executeHandler([
      { document: { languageId: "sas" } },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    await runCommands.run();
    await runCommands.runTask(codeDoc);
    assert.strictEqual(useRunStore.getState().isExecutingCode, true);
    assert.strictEqual(session.run.callCount, 1);
    assert.strictEqual(executeCommand.callCount, 0);
    finish({});
    await notebook;
    assert.strictEqual(useRunStore.getState().isExecutingCode, false);
  });

  it("holds task ownership through cancellation and disposes its close listener", async () => {
    const { controller, session } = createController();
    const { runCommands, codeDoc } = createProgramRunner(session);
    const messages = new vscode.EventEmitter<string>();
    const closed = new vscode.EventEmitter<number>();
    let finish!: (result: object) => void;
    session.run.onFirstCall().returns(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    try {
      const task = runCommands.runTask(codeDoc, messages, closed);
      await Promise.resolve();
      closed.fire(1);
      await Promise.resolve();
      assert.strictEqual(session.cancel.callCount, 1);
      assert.strictEqual(useRunStore.getState().isExecutingCode, true);
      await controller.executeHandler([{ document: { languageId: "sas" } }]);
      assert.strictEqual(session.run.callCount, 1);
      finish({});
      await task;
      assert.strictEqual(useRunStore.getState().isExecutingCode, false);

      session.run.onSecondCall().returns(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const notebook = controller.executeHandler([
        { document: { languageId: "sas" } },
      ]);
      await Promise.resolve();
      await Promise.resolve();
      closed.fire(1);
      await Promise.resolve();
      assert.strictEqual(session.cancel.callCount, 1);
      assert.strictEqual(useRunStore.getState().isExecutingCode, true);
      finish({});
      await notebook;
    } finally {
      messages.dispose();
      closed.dispose();
    }
  });

  for (const clear of [true, false]) {
    it(`honors real log viewer lifecycle with clearOnExecutionStart: ${clear}`, async () => {
      const channels: {
        lines: string[];
        dispose: sinon.SinonStub;
        show: sinon.SinonStub;
      }[] = [];
      const createOutputChannel = sinon.stub().callsFake(() => {
        const lines: string[] = [];
        const channel = {
          lines,
          appendLine(line: string) {
            this.lines.push(line);
          },
          dispose: sinon.stub(),
          show: sinon.stub(),
        };
        channels.push(channel);
        return channel;
      });
      const runSubscribe = sinon.spy(useRunStore, "subscribe");
      const logSubscribe = sinon.spy(useLogStore, "subscribe");
      const logViewer: typeof import("../../../src/components/logViewer") =
        proxyquire("../../../src/components/logViewer", {
          vscode: {
            "@noCallThru": true,
            window: { createOutputChannel },
            l10n: vscode.l10n,
          },
          "../../store": { useRunStore, useLogStore },
          "../utils/settings": {
            clearLogOnExecutionStart: () => clear,
            showLogOnExecutionStart: () => true,
            showLogOnExecutionFinish: () => true,
          },
        });
      const subscriptions = [
        ...runSubscribe.returnValues,
        ...logSubscribe.returnValues,
      ];
      runSubscribe.restore();
      logSubscribe.restore();
      const {
        controller,
        session,
        execution,
        appendExecutionLog,
        appendSessionLog,
      } = createController();
      appendExecutionLog.callsFake(logViewer.appendExecutionLogFn);
      appendSessionLog.callsFake(logViewer.appendSessionLogFn);
      session.setup.callsFake(async () =>
        session.onSessionLogFn([{ type: "note", line: "Startup" }]),
      );
      session.run.callsFake(async () => {
        const last = session.run.callCount === 3;
        session.onExecutionLogFn([
          {
            type: last ? "error" : "note",
            line: `Cell ${session.run.callCount}`,
          },
        ]);
        return {};
      });
      try {
        await controller.executeHandler([
          { document: { languageId: "sas" } },
          { document: { languageId: "sas" } },
          { document: { languageId: "sql" } },
        ]);
        assert.strictEqual(channels.length, 1);
        assert.deepStrictEqual(channels[0].lines, [
          "Startup",
          "Cell 1",
          "Cell 2",
          "Cell 3",
        ]);
        assert.strictEqual(execution.end.thirdCall.args[0], false);
        await controller.executeHandler([{ document: { languageId: "sas" } }]);
        assert.strictEqual(channels.length, clear ? 2 : 1);
        assert.strictEqual(channels[0].dispose.callCount, clear ? 1 : 0);
        assert.deepStrictEqual(
          channels[channels.length - 1].lines,
          clear
            ? ["Startup", "Cell 4"]
            : ["Startup", "Cell 1", "Cell 2", "Cell 3", "Startup", "Cell 4"],
        );
        assert.strictEqual(execution.end.lastCall.args[0], true);
        assert.ok(channels.every((channel) => channel.show.callCount >= 2));
      } finally {
        subscriptions.forEach((unsubscribe) => unsubscribe());
        useLogStore.getState().setProducedExecutionLogOutput(false);
      }
    });
  }

  it("routes session startup logs to SAS Log", async () => {
    const { controller, session, appendSessionLog } = createController();
    const logs: LogLine[] = [{ type: "note", line: "Session startup" }];
    session.setup.callsFake(async () => session.onSessionLogFn(logs));

    await controller.executeHandler([{ document: { languageId: "sas" } }]);

    assert.deepStrictEqual(appendSessionLog.firstCall.args, [logs]);
  });

  it("awaits prepared code and passes the existing language client", async () => {
    const { controller, execution, session, prepare, client } =
      createController();
    let complete!: (code: string) => void;
    prepare.returns(
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
    );
    const pending = controller.executeHandler([
      { document: { languageId: "python" } },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(session.run.callCount, 0);
    complete("prepared notebook code");
    await pending;
    assert.strictEqual(prepare.firstCall.args[0], client);
    assert.deepStrictEqual(session.run.firstCall.args, [
      "prepared notebook code",
      { baseDirectory: "/notebook" },
    ]);
    assert.strictEqual(execution.end.firstCall.args[0], true);
  });

  it("does not submit a cell interrupted during detection", async () => {
    const { controller, execution, session, prepare, progress } =
      createController();
    let complete!: (code: string) => void;
    prepare.returns(
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
    );
    const pending = controller.executeHandler([
      { document: { languageId: "python" } },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    controller.interruptHandler();
    complete("prepared notebook code");
    await pending;
    await progress.firstCall.returnValue;
    assert.strictEqual(session.cancel.callCount, 0);
    assert.strictEqual(session.run.callCount, 0);
    assert.strictEqual(execution.end.callCount, 1);
    assert.strictEqual(useRunStore.getState().isExecutingCode, false);
  });

  it("serializes overlapping preparation and preserves output ownership", async () => {
    const { controller, session, prepare, execution } = createController();
    let complete!: (code: string) => void;
    prepare.onFirstCall().returns(
      new Promise<string>((resolve) => {
        complete = resolve;
      }),
    );
    const first = controller.executeHandler([
      { document: { languageId: "python" } },
    ]);
    const second = controller.executeHandler([
      { document: { languageId: "python" } },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    assert.strictEqual(prepare.callCount, 1);
    assert.strictEqual(session.run.callCount, 0);
    assert.strictEqual(session.onExecutionLogFn, undefined);
    session.run.callsFake(async () => {
      assert.ok(session.onExecutionLogFn);

      session.onExecutionLogFn([
        { type: "normal", line: ">>> " },
        { type: "normal", line: `cell ${session.run.callCount}` },
        { type: "normal", line: ">>> " },
      ]);

      return {};
    });
    complete("first code");
    await Promise.all([first, second]);
    assert.strictEqual(prepare.callCount, 2);
    assert.strictEqual(session.run.firstCall.args[0], "first code");
    assert.strictEqual(
      session.run.secondCall.args[0],
      "prepared notebook code",
    );
    const outputs = execution.replaceOutput
      .getCalls()
      .map((call) => new TextDecoder().decode(call.args[0][0].items[0].data));
    assert.ok(outputs[0].includes("cell 1"));
    assert.ok(!outputs[0].includes("cell 2"));
    assert.ok(outputs[1].includes("cell 2"));
    assert.strictEqual(execution.end.callCount, 2);
  });

  it("interrupts the active run, drops old queued work, and allows a fresh batch", async () => {
    const { controller, session, execution } = createController();
    let complete!: (result: object) => void;
    session.run.onFirstCall().returns(
      new Promise((resolve) => {
        complete = resolve;
      }),
    );
    const first = controller.executeHandler([
      { document: { languageId: "sas" } },
    ]);
    const queued = controller.executeHandler([
      { document: { languageId: "sas" } },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    controller.interruptHandler();
    const fresh = controller.executeHandler([
      { document: { languageId: "sas" } },
    ]);
    assert.strictEqual(session.cancel.callCount, 1);
    complete({});
    await Promise.all([first, queued, fresh]);
    assert.strictEqual(session.run.callCount, 2);
    assert.strictEqual(execution.end.firstCall.args[0], undefined);
    assert.strictEqual(execution.end.secondCall.args[0], true);
    assert.strictEqual(useRunStore.getState().isExecutingCode, false);
  });

  it("cancels preparation and discards queued work on disposal", async () => {
    const { provider, controller, session, prepare, execution } =
      createController();
    prepare.callsFake(
      (_client, token: vscode.CancellationToken) =>
        new Promise<string>((resolve) => {
          token.onCancellationRequested(() => resolve("cancelled preparation"));
        }),
    );
    const first = controller.executeHandler([
      { document: { languageId: "python" } },
    ]);
    const queued = controller.executeHandler([
      { document: { languageId: "python" } },
    ]);
    await Promise.resolve();
    await Promise.resolve();
    provider.dispose();
    await Promise.all([first, queued]);
    assert.strictEqual(session.run.callCount, 0);
    assert.strictEqual(execution.end.callCount, 1);
    assert.strictEqual(controller.dispose.callCount, 1);
    assert.strictEqual(useRunStore.getState().isExecutingCode, false);
  });

  it("executes rapid multi-cell batches in submission order", async () => {
    const { controller, session, execution } = createController();
    await Promise.all(
      Array.from({ length: 10 }, () =>
        controller.executeHandler([
          { document: { languageId: "sas" } },
          { document: { languageId: "python" } },
        ]),
      ),
    );
    assert.strictEqual(session.run.callCount, 20);
    assert.strictEqual(execution.end.callCount, 20);
    assert.strictEqual(session.setup.callCount, 10);
  });

  for (const clean of [true, false]) {
    it(`uses ${clean ? "clean" : "raw"} mode to control Python autodisplay`, async () => {
      const source = "print('stdout')\n42";
      const { controller, client, cleanOutput, session } =
        createController(source);
      cleanOutput.returns(clean);
      client.isRunning.returns(true);
      client.sendRequest.resolves({
        isExpression: true,
        expressionText: "42",
        startOffset: source.lastIndexOf("42"),
        endOffset: source.length,
      });
      const original = new SASCodeDocument({
        languageId: "python",
        code: source,
        selectedCode: "",
        fileName: "/notebook/cell.py",
        checkKeyword: async () => false,
      }).getWrappedCode();
      const prepareSpy = sinon.spy(
        SASCodeDocument.prototype,
        "getWrappedNotebookCode",
      );
      try {
        await controller.executeHandler([
          { document: { languageId: "python" } },
        ]);
        // const clean = visibilityMode === "clean";
        assert.strictEqual(prepareSpy.callCount, clean ? 1 : 0);
        assert.strictEqual(client.sendRequest.callCount, clean ? 1 : 0);
        const code = session.run.firstCall.args[0];
        if (clean) {
          assert.strictEqual(
            client.sendRequest.firstCall.args[0],
            "sas/pythonFinalExpression",
          );
          assert.deepStrictEqual(client.sendRequest.firstCall.args[1], {
            code: source,
          });
          const token = client.sendRequest.firstCall.args[2];
          assert.ok(token);
          assert.strictEqual(token.isCancellationRequested, false);
          assert.ok(code.includes("print('stdout')\n__sas_"));
          assert.ok(code.includes(" = ((42))"));
          assert.match(code, /__SAS_AUTODISPLAY_[a-f0-9]{32}_BEGIN__/);
          assert.strictEqual(code, await prepareSpy.firstCall.returnValue);
        } else {
          assert.strictEqual(client.isRunning.callCount, 0);
          assert.strictEqual(code, original);
          assert.ok(!code.includes("__SAS_AUTODISPLAY_"));
        }
        assert.deepStrictEqual(session.run.firstCall.args[1], {
          baseDirectory: "/notebook",
        });
      } finally {
        prepareSpy.restore();
      }
    });

    it(`renders Python output through the ${clean ? "clean" : "raw"} pipeline`, async () => {
      const source = "42";
      const { controller, client, cleanOutput, session, execution } =
        createController(source);
      cleanOutput.returns(clean);
      client.isRunning.returns(true);
      client.sendRequest.resolves({
        isExpression: true,
        expressionText: source,
        startOffset: 0,
        endOffset: source.length,
      });
      const logs: LogLine[] = [
        { type: "note", line: "SAS boilerplate" },
        { type: "normal", line: ">>> " },
      ];
      session.run.callsFake(async (code: string) => {
        if (clean) {
          const id = /__SAS_AUTODISPLAY_([a-f0-9]{32})_BEGIN__/.exec(code)?.[1];
          assert.ok(id);
          logs.push({
            type: "normal",
            line: `__SAS_AUTODISPLAY_${id}_BEGIN__"42"__SAS_AUTODISPLAY_${id}_END__`,
          });
        } else {
          assert.ok(!code.includes("__SAS_AUTODISPLAY_"));
          logs.push({ type: "normal", line: "42" });
        }
        logs.push({ type: "normal", line: ">>> " });
        assert.ok(session.onExecutionLogFn);
        session.onExecutionLogFn(logs);
        return {};
      });
      await controller.executeHandler([{ document: { languageId: "python" } }]);
      const item = execution.replaceOutput.firstCall.args[0][0].items[0];
      assert.strictEqual(item.mime, "application/vnd.sas.compute.log.lines");
      assert.deepStrictEqual(
        JSON.parse(new TextDecoder().decode(item.data)),
        clean ? [{ type: "normal", line: "42" }] : logs,
      );
      assert.strictEqual(execution.end.firstCall.args[0], true);
    });
  }

  for (const clean of [true, false]) {
    for (const languageId of ["python", "sas", "sql", "r"]) {
      it(`preserves output rendering for ${languageId} when cleanOutput is ${clean}`, async () => {
        const {
          controller,
          prepare,
          session,
          cleanOutput,
          execution,
          appendExecutionLog,
        } = createController();
        cleanOutput.returns(clean);
        const logs: LogLine[] = [
          { type: "note", line: "SAS boilerplate" },
          { type: "normal", line: ">>> " },
          { type: "normal", line: "stdout" },
          { type: "normal", line: "__SAS_AUTODISPLAY__hello" },
          { type: "normal", line: ">>> " },
        ];
        session.run.callsFake(async () => {
          assert.ok(session.onExecutionLogFn);
          session.onExecutionLogFn(logs);
          return { html5: "<p>ODS output</p>" };
        });
        await controller.executeHandler([{ document: { languageId } }]);
        assert.strictEqual(
          prepare.callCount,
          languageId === "python" && clean ? 1 : 0,
        );
        const outputs: vscode.NotebookCellOutput[] =
          execution.replaceOutput.firstCall.args[0];
        assert.strictEqual(outputs.length, languageId === "python" ? 2 : 1);
        assert.ok(outputs.every((output) => output.items.length === 1));
        const items = outputs.map((output) => output.items[0]);
        assert.strictEqual(items[0].mime, "application/vnd.sas.ods.html5");
        assert.strictEqual(
          new TextDecoder().decode(items[0].data),
          "<p>ODS output</p>",
        );
        if (languageId === "python") {
          assert.notStrictEqual(outputs[0], outputs[1]);
          assert.strictEqual(
            items[1].mime,
            "application/vnd.sas.compute.log.lines",
          );
          assert.deepStrictEqual(
            JSON.parse(new TextDecoder().decode(items[1].data)),
            clean ? logs.slice(2, 4) : logs,
          );
        }
        assert.deepStrictEqual(appendExecutionLog.firstCall.args, [logs]);
        assert.strictEqual(execution.end.firstCall.args[0], true);
      });
    }
  }

  for (const errorType of ["python", "sas", "execution"]) {
    it(`preserves ${errorType} errors in clean mode`, async () => {
      const { controller, session, cleanOutput, execution } =
        createController();
      cleanOutput.returns(true);
      const logs: LogLine[] =
        errorType === "python"
          ? [
              { type: "error", line: "ERROR: Unhandled Python exception." },
              { type: "normal", line: ">>> " },
              {
                type: "normal",
                line: "NameError: name 'missing' is not defined",
              },
              { type: "normal", line: ">>> " },
            ]
          : [
              { type: "error", line: "ERROR: Python is not configured." },
              { type: "warning", line: "WARNING: setup failed." },
            ];
      session.run.callsFake(async () => {
        if (errorType === "execution") {
          throw new Error("session execution failed");
        }
        assert.ok(session.onExecutionLogFn);
        session.onExecutionLogFn(logs);
        return { html5: "<p>ODS output</p>" };
      });
      await controller.executeHandler([{ document: { languageId: "python" } }]);
      const outputs: vscode.NotebookCellOutput[] =
        execution.replaceOutput.firstCall.args[0];
      assert.strictEqual(outputs.length, errorType === "execution" ? 1 : 2);
      assert.ok(outputs.every((output) => output.items.length === 1));
      const items = outputs.map((output) => output.items[0]);
      const item = items[items.length - 1];
      const output = JSON.parse(new TextDecoder().decode(item.data));
      if (errorType === "sas") {
        assert.strictEqual(item.mime, "application/vnd.sas.compute.log.lines");
        assert.deepStrictEqual(output, logs);
      } else {
        assert.strictEqual(item.mime, "application/vnd.code.notebook.error");
        assert.strictEqual(
          output.name,
          errorType === "python" ? "NameError" : "Error",
        );
        assert.strictEqual(
          output.message,
          errorType === "python"
            ? "name 'missing' is not defined"
            : "session execution failed",
        );
        assert.ok(output.stack.includes(output.name));
      }
      if (errorType !== "execution") {
        assert.strictEqual(items[0].mime, "application/vnd.sas.ods.html5");
        assert.strictEqual(
          new TextDecoder().decode(items[0].data),
          "<p>ODS output</p>",
        );
      }
      assert.strictEqual(execution.end.firstCall.args[0], false);
    });
  }

  for (const html5 of ["", "<p>ODS output</p>"]) {
    for (const languageId of ["python", "sas", "sql", "r"]) {
      it(`skips empty raw logs for ${languageId} with HTML: ${!!html5}`, async () => {
        const { controller, session, cleanOutput, execution } =
          createController();
        cleanOutput.returns(false);
        session.run.resolves({ html5 });

        await controller.executeHandler([{ document: { languageId } }]);

        const outputs: vscode.NotebookCellOutput[] =
          execution.replaceOutput.firstCall.args[0];
        assert.strictEqual(outputs.length, html5 ? 1 : 0);
        if (html5) {
          assert.strictEqual(outputs[0].items.length, 1);
          assert.strictEqual(
            outputs[0].items[0].mime,
            "application/vnd.sas.ods.html5",
          );
        }
        assert.strictEqual(execution.end.firstCall.args[0], true);
      });
    }

    it(`skips cleaned Python boilerplate with HTML: ${!!html5}`, async () => {
      const { controller, session, execution } = createController();
      session.run.callsFake(async () => {
        session.onExecutionLogFn([{ type: "note", line: "SAS boilerplate" }]);
        return { html5 };
      });

      await controller.executeHandler([{ document: { languageId: "python" } }]);

      const outputs: vscode.NotebookCellOutput[] =
        execution.replaceOutput.firstCall.args[0];
      assert.strictEqual(outputs.length, html5 ? 1 : 0);
      if (html5) {
        assert.strictEqual(outputs[0].items.length, 1);
        assert.strictEqual(
          outputs[0].items[0].mime,
          "application/vnd.sas.ods.html5",
        );
      }
      assert.strictEqual(execution.end.firstCall.args[0], true);
    });

    for (const languageId of ["sas", "sql", "r"]) {
      it(`routes ${languageId} diagnostics to SAS Log and fails with HTML: ${!!html5}`, async () => {
        const { controller, session, execution, appendExecutionLog } =
          createController();
        const logs: LogLine[] = [
          { type: "note", line: "SAS context" },
          { type: "error", line: "ERROR 79-322: Expecting a FROM." },
          { type: "warning", line: "WARNING: Statement not executed." },
        ];
        session.run.callsFake(async () => {
          session.onExecutionLogFn(logs);
          return { html5 };
        });

        await controller.executeHandler([{ document: { languageId } }]);

        const outputs: vscode.NotebookCellOutput[] =
          execution.replaceOutput.firstCall.args[0];
        assert.strictEqual(outputs.length, html5 ? 1 : 0);
        assert.ok(outputs.every((output) => output.items.length === 1));
        if (html5) {
          assert.strictEqual(
            outputs[0].items[0].mime,
            "application/vnd.sas.ods.html5",
          );
        }
        assert.deepStrictEqual(appendExecutionLog.firstCall.args, [logs]);
        assert.strictEqual(execution.end.firstCall.args[0], false);
      });
    }
  }

  for (const hasLogs of [true, false]) {
    it(`preserves Python exception output with collected logs: ${hasLogs}`, async () => {
      const { controller, session, execution, appendExecutionLog } =
        createController();
      const logs: LogLine[] = [{ type: "note", line: "Before ABORT" }];
      session.run.callsFake(async () => {
        if (hasLogs) {
          session.onExecutionLogFn(logs);
        }
        throw new Error("Session stopped");
      });

      await controller.executeHandler([{ document: { languageId: "python" } }]);

      const outputs: vscode.NotebookCellOutput[] =
        execution.replaceOutput.firstCall.args[0];
      assert.strictEqual(outputs.length, hasLogs ? 2 : 1);
      assert.ok(outputs.every((output) => output.items.length === 1));
      if (hasLogs) {
        assert.deepStrictEqual(appendExecutionLog.firstCall.args, [logs]);
        const logItem = outputs[0].items[0];
        assert.strictEqual(
          logItem.mime,
          "application/vnd.sas.compute.log.lines",
        );
        assert.deepStrictEqual(
          JSON.parse(new TextDecoder().decode(logItem.data)),
          logs,
        );
      }
      const errorItem = outputs[outputs.length - 1].items[0];
      assert.strictEqual(errorItem.mime, "application/vnd.code.notebook.error");
      assert.strictEqual(
        JSON.parse(new TextDecoder().decode(errorItem.data)).message,
        "Session stopped",
      );
      assert.strictEqual(execution.end.firstCall.args[0], false);
    });
  }

  for (const languageId of ["sas", "sql", "r"]) {
    for (const errorCode of [undefined, 5113]) {
      it(`keeps ${languageId} HTTP failure diagnostics out of notebook outputs (code: ${errorCode})`, async () => {
        const { controller, session, execution, appendExecutionLog } =
          createController();
        const logs: LogLine[] = [
          { type: "note", line: "Previous steps completed" },
          {
            type: "error",
            line: "ERROR: Execution terminated by an ABORT statement.",
          },
        ];
        const message =
          errorCode === 5113
            ? "The session requested is currently in a failed or stopped state."
            : "Execution terminated";
        const error = Object.assign(
          new AxiosError("Request failed with status code 400"),
          {
            response: {
              status: 400,
              data: { errorCode, message, details: ["Compute server detail"] },
            },
            config: { headers: { Authorization: "Bearer private-token" } },
          },
        );
        error.stack = "AxiosError: failure\n    at internalClientStack";
        session.run.callsFake(async () => {
          assert.ok(session.onExecutionLogFn);
          session.onExecutionLogFn(logs);
          throw error;
        });

        await controller.executeHandler([{ document: { languageId } }]);

        assert.strictEqual(execution.replaceOutput.callCount, 0);
        assert.strictEqual(execution.appendOutput.callCount, 1);
        const output: vscode.NotebookCellOutput =
          execution.appendOutput.firstCall.args[0];
        assert.strictEqual(output.items.length, 1);
        assert.strictEqual(output.items[0].mime, "text/plain");
        assert.strictEqual(
          new TextDecoder().decode(output.items[0].data),
          "Execution failed. See SAS Log for details.",
        );
        assert.deepStrictEqual(appendExecutionLog.firstCall.args, [logs]);
        const context: LogLine[] = appendExecutionLog.secondCall.args[0];
        assert.strictEqual(context[0].type, "error");
        assert.ok(context[0].line.includes("HTTP 400"));
        assert.ok(context[0].line.includes(message));
        assert.ok(context[0].line.includes("Compute server detail"));
        if (errorCode) {
          assert.ok(context[0].line.includes(`Compute error ${errorCode}`));
        }
        assert.ok(!context[0].line.includes("private-token"));
        assert.ok(!context[0].line.includes("internalClientStack"));
        assert.strictEqual(execution.end.firstCall.args[0], false);
        assert.strictEqual(useRunStore.getState().isExecutingCode, false);
      });
    }

    it(`shows a concise ${languageId} failure even when no logs arrived`, async () => {
      const { controller, session, execution, appendExecutionLog } =
        createController();
      session.run.rejects(new Error("Connection lost"));

      await controller.executeHandler([{ document: { languageId } }]);

      assert.strictEqual(execution.replaceOutput.callCount, 0);
      const output: vscode.NotebookCellOutput =
        execution.appendOutput.firstCall.args[0];
      assert.strictEqual(output.items[0].mime, "text/plain");
      assert.deepStrictEqual(appendExecutionLog.firstCall.args, [
        [{ type: "error", line: "Connection lost" }],
      ]);
      assert.strictEqual(execution.end.firstCall.args[0], false);
    });
  }

  it("keeps a completed cell's HTML when the following cell throws", async () => {
    const { controller, session, execution } = createController();
    session.run
      .onFirstCall()
      .resolves({ html5: "<table>Student Records</table>" });
    session.run.onSecondCall().rejects(new Error("Execution terminated"));

    await controller.executeHandler([
      { document: { languageId: "sas" } },
      { document: { languageId: "sas" } },
    ]);

    assert.strictEqual(execution.replaceOutput.callCount, 1);
    const outputs: vscode.NotebookCellOutput[] =
      execution.replaceOutput.firstCall.args[0];
    assert.strictEqual(
      outputs[0].items[0].mime,
      "application/vnd.sas.ods.html5",
    );
    assert.strictEqual(
      new TextDecoder().decode(outputs[0].items[0].data),
      "<table>Student Records</table>",
    );
    assert.strictEqual(execution.appendOutput.callCount, 1);
    assert.strictEqual(execution.end.firstCall.args[0], true);
    assert.strictEqual(execution.end.secondCall.args[0], false);
  });

  it("does not carry SAS error status into the next cell", async () => {
    const { controller, session, execution } = createController();
    session.run.onFirstCall().callsFake(async () => {
      session.onExecutionLogFn([{ type: "error", line: "Syntax failure" }]);
      return { html5: "<p>Partial results</p>" };
    });
    session.run.onSecondCall().resolves({ html5: "<p>Valid results</p>" });

    await controller.executeHandler([
      { document: { languageId: "sas" } },
      { document: { languageId: "sas" } },
    ]);

    assert.strictEqual(execution.end.firstCall.args[0], false);
    assert.strictEqual(execution.end.secondCall.args[0], true);
    assert.strictEqual(session.run.callCount, 2);
  });

  for (const languageId of ["sas", "r", "sql"]) {
    it(`retains complete ${languageId} notes and warnings in SAS Log without failing`, async () => {
      const { controller, session, execution, appendExecutionLog } =
        createController();
      const first: LogLine[] = [
        { type: "source", line: "put 'ERROR: printed text';" },
        { type: "normal", line: "ERROR: printed text" },
        { type: "note", line: "NOTE: Execution completed" },
      ];
      const second: LogLine[] = [
        { type: "warning", line: "WARNING: Review results" },
        { type: "note", line: "real time 0.01 seconds" },
      ];
      session.run.callsFake(async () => {
        session.onExecutionLogFn(first);
        session.onExecutionLogFn(second);
        return { html5: "<p>Results</p>" };
      });

      await controller.executeHandler([{ document: { languageId } }]);

      assert.deepStrictEqual(
        appendExecutionLog.getCalls().map((call) => call.args[0]),
        [first, second],
      );
      const outputs: vscode.NotebookCellOutput[] =
        execution.replaceOutput.firstCall.args[0];
      assert.strictEqual(outputs.length, 1);
      assert.strictEqual(outputs[0].items.length, 1);
      assert.strictEqual(
        outputs[0].items[0].mime,
        "application/vnd.sas.ods.html5",
      );
      assert.strictEqual(execution.end.firstCall.args[0], true);
    });

    it(`preserves ${languageId} execution`, async () => {
      const { controller, prepare, session, cleanOutput } = createController();

      cleanOutput.returns(true);

      await controller.executeHandler([{ document: { languageId } }]);

      assert.strictEqual(prepare.callCount, 0);
      assert.strictEqual(
        session.run.firstCall.args[0],
        "original notebook code",
      );
    });
  }
});
