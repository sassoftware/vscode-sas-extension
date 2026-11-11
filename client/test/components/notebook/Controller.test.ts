import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

import assert from "assert";
import { AxiosError } from "axios";
import proxyquire from "proxyquire";
import sinon from "sinon";

import { SASCodeDocument } from "../../../src/components/utils/SASCodeDocument";
import type { LogLine } from "../../../src/connection";

describe("Notebook execution preparation", () => {
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
    const applyEdit = sinon.stub().resolves(true);
    const updateCellMetadata = sinon.stub().callsFake((index, metadata) => ({
      index,
      metadata,
    }));
    class WorkspaceEdit {
      set = sinon.stub();
    }
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
          NotebookEdit: { updateCellMetadata },
          WorkspaceEdit,
          workspace: { applyEdit },
          notebooks: {
            createNotebookController: sinon.stub().returns(controller),
          },
          window: { withProgress: progress, showErrorMessage: sinon.stub() },
        },
        "../../connection": { getSession: () => session },
        "../logViewer": {
          "@noCallThru": true,
          appendExecutionLogFn: appendExecutionLog,
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
    const executeHandler = controller.executeHandler;
    controller.executeHandler = sinon
      .stub()
      .callsFake((cells: Array<{ document: { languageId: string } }>) =>
        executeHandler(
          cells.map((cell, index) => ({
            index,
            metadata: { existing: "kept" },
            notebook: { uri: "notebook", isClosed: false },
            ...cell,
          })),
        ),
      );
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
      applyEdit,
      updateCellMetadata,
    };
  }

  it("does not prepare code or start a session during construction", () => {
    const { prepare, session } = createController();
    assert.strictEqual(prepare.callCount, 0);
    assert.strictEqual(session.setup.callCount, 0);
    assert.strictEqual(session.run.callCount, 0);
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
          updateCellMetadata,
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
        const items = execution.replaceOutput.firstCall.args[0][0].items;
        assert.strictEqual(items[0].mime, "application/vnd.sas.ods.html5");
        assert.strictEqual(
          new TextDecoder().decode(items[0].data),
          "<p>ODS output</p>",
        );
        if (languageId === "python") {
          assert.strictEqual(items.length, 2);
          assert.strictEqual(
            items[1].mime,
            "application/vnd.sas.compute.log.lines",
          );
          assert.deepStrictEqual(
            JSON.parse(new TextDecoder().decode(items[1].data)),
            clean ? logs.slice(2, 4) : logs,
          );
          assert.strictEqual(appendExecutionLog.callCount, 0);
          assert.strictEqual(updateCellMetadata.callCount, 0);
        } else {
          assert.strictEqual(items.length, 1);
          assert.deepStrictEqual(appendExecutionLog.firstCall.args, [logs]);
          assert.deepStrictEqual(updateCellMetadata.firstCall.args, [
            0,
            { existing: "kept", sasExecutionLog: logs },
          ]);
        }
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
      const items = execution.replaceOutput.firstCall.args[0][0].items;
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

  for (const languageId of ["sas", "sql", "r"]) {
    for (const html5 of ["", "<p>Partial results</p>"]) {
      it(`routes ${languageId} errors to SAS Log with HTML: ${!!html5}`, async () => {
        const {
          controller,
          session,
          execution,
          appendExecutionLog,
          updateCellMetadata,
        } = createController();
        const logs: LogLine[] = [
          { type: "note", line: "NOTE: Step completed" },
          { type: "error", line: "ERROR 79-322: Expecting a FROM." },
        ];
        session.run.callsFake(async () => {
          assert.ok(session.onExecutionLogFn);
          session.onExecutionLogFn(logs);
          return { html5 };
        });

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
        assert.deepStrictEqual(appendExecutionLog.firstCall.args, [logs]);
        assert.deepStrictEqual(updateCellMetadata.firstCall.args, [
          0,
          { existing: "kept", sasExecutionLog: logs },
        ]);
        assert.strictEqual(execution.end.firstCall.args[0], false);
      });
    }

    it(`shows a concise ${languageId} ABEND failure and retains diagnostics`, async () => {
      const {
        controller,
        session,
        execution,
        appendExecutionLog,
        updateCellMetadata,
      } = createController();
      const logs: LogLine[] = [
        {
          type: "error",
          line: "ERROR: Execution terminated by an ABORT statement.",
        },
      ];
      const error = Object.assign(
        new AxiosError("Request failed with status code 400"),
        {
          response: {
            status: 400,
            data: { errorCode: 5113, message: "secret-token" },
          },
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
      const output: vscode.NotebookCellOutput =
        execution.appendOutput.firstCall.args[0];
      assert.strictEqual(output.items.length, 1);
      assert.strictEqual(output.items[0].mime, "text/plain");
      assert.strictEqual(
        new TextDecoder().decode(output.items[0].data),
        "Execution failed. See SAS Log for details.",
      );
      assert.deepStrictEqual(appendExecutionLog.firstCall.args, [logs]);
      assert.deepStrictEqual(appendExecutionLog.secondCall.args, [
        [
          {
            type: "error",
            line: "Execution failed.\nHTTP 400\nCompute error 5113",
          },
        ],
      ]);
      assert.deepStrictEqual(updateCellMetadata.firstCall.args, [
        0,
        { existing: "kept", sasExecutionLog: logs },
      ]);
      assert.strictEqual(execution.end.firstCall.args[0], false);
    });
  }

  it("keeps Python exception output and logging unchanged", async () => {
    const {
      controller,
      session,
      execution,
      appendExecutionLog,
      updateCellMetadata,
    } = createController();
    session.run.callsFake(async () => {
      assert.ok(session.onExecutionLogFn);
      session.onExecutionLogFn([{ type: "normal", line: "Python text" }]);
      throw new Error("Python execution failed");
    });

    await controller.executeHandler([{ document: { languageId: "python" } }]);

    const outputs: vscode.NotebookCellOutput[] =
      execution.replaceOutput.firstCall.args[0];
    assert.strictEqual(outputs.length, 1);
    assert.strictEqual(outputs[0].items.length, 1);
    assert.strictEqual(
      outputs[0].items[0].mime,
      "application/vnd.code.notebook.error",
    );
    assert.strictEqual(appendExecutionLog.callCount, 0);
    assert.strictEqual(updateCellMetadata.callCount, 0);
    assert.strictEqual(execution.end.firstCall.args[0], false);
  });

  it("keeps the original empty raw Python log output", async () => {
    const { controller, session, cleanOutput, execution, appendExecutionLog } =
      createController();
    cleanOutput.returns(false);
    session.run.resolves({ html5: "<p>Result</p>" });

    await controller.executeHandler([{ document: { languageId: "python" } }]);

    const outputs: vscode.NotebookCellOutput[] =
      execution.replaceOutput.firstCall.args[0];
    assert.strictEqual(outputs.length, 1);
    assert.deepStrictEqual(
      outputs[0].items.map((item) => item.mime),
      [
        "application/vnd.sas.ods.html5",
        "application/vnd.sas.compute.log.lines",
      ],
    );
    assert.deepStrictEqual(
      JSON.parse(new TextDecoder().decode(outputs[0].items[1].data)),
      [],
    );
    assert.strictEqual(appendExecutionLog.callCount, 0);
  });

  for (const outcome of ["success", "sas error", "exception"]) {
    it(`waits for log metadata before completing a ${outcome} execution`, async () => {
      const { controller, session, execution, applyEdit } = createController();
      let finishEdit!: (value: boolean) => void;
      let notifyEditStarted!: () => void;
      const editStarted = new Promise<void>((resolve) => {
        notifyEditStarted = resolve;
      });
      applyEdit.callsFake(() => {
        notifyEditStarted();
        return new Promise<boolean>((resolve) => {
          finishEdit = resolve;
        });
      });
      session.run.callsFake(async () => {
        assert.ok(session.onExecutionLogFn);
        session.onExecutionLogFn([
          { type: outcome === "sas error" ? "error" : "note", line: "Log" },
        ]);
        if (outcome === "exception") {
          throw new Error("Execution failed");
        }
        return {};
      });

      const pending = controller.executeHandler([
        { document: { languageId: "sas" } },
      ]);
      await editStarted;
      assert.strictEqual(execution.end.callCount, 0);
      finishEdit(true);
      await pending;

      assert.strictEqual(execution.end.callCount, 1);
      assert.strictEqual(
        execution.end.firstCall.args[0],
        outcome === "success",
      );
    });
  }

  it("completes an interrupted cell after its metadata edit settles", async () => {
    const { controller, session, execution, applyEdit, progress } =
      createController();
    let finishEdit!: (value: boolean) => void;
    let notifyEditStarted!: () => void;
    const editStarted = new Promise<void>((resolve) => {
      notifyEditStarted = resolve;
    });
    applyEdit.callsFake(() => {
      notifyEditStarted();
      return new Promise<boolean>((resolve) => {
        finishEdit = resolve;
      });
    });

    const pending = controller.executeHandler([
      { document: { languageId: "sas" } },
    ]);
    await editStarted;
    controller.interruptHandler();
    assert.strictEqual(execution.end.callCount, 0);
    assert.strictEqual(session.cancel.callCount, 0);
    finishEdit(true);
    await pending;
    await progress.firstCall.returnValue;

    assert.strictEqual(execution.end.callCount, 1);
    assert.strictEqual(execution.end.firstCall.args[0], undefined);
  });

  it("ends execution when the metadata edit throws", async () => {
    const { controller, execution, appendExecutionLog, applyEdit } =
      createController();
    applyEdit.throws(new Error("Edit failed"));

    await controller.executeHandler([{ document: { languageId: "sas" } }]);

    assert.strictEqual(execution.end.callCount, 1);
    assert.strictEqual(execution.end.firstCall.args[0], true);
    assert.strictEqual(appendExecutionLog.firstCall.args[0][0].type, "warning");
  });

  it("warns in SAS Log when export metadata cannot be saved", async () => {
    const { controller, session, appendExecutionLog, applyEdit } =
      createController();
    applyEdit.resolves(false);
    session.run.resolves({});

    await controller.executeHandler([{ document: { languageId: "sas" } }]);

    assert.deepStrictEqual(appendExecutionLog.firstCall.args, [
      [
        {
          type: "warning",
          line: "Unable to retain the SAS log for notebook export.",
        },
      ],
    ]);
  });

  for (const languageId of ["sas", "r", "sql"]) {
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
