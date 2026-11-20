import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/node";

import assert from "assert";
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
          notebooks: {
            createNotebookController: sinon.stub().returns(controller),
          },
          window: { withProgress: progress, showErrorMessage: sinon.stub() },
        },
        "../../connection": { getSession: () => session },
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
        const { controller, prepare, session, cleanOutput, execution } =
          createController();
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
        assert.strictEqual(
          items[1].mime,
          "application/vnd.sas.compute.log.lines",
        );
        assert.deepStrictEqual(
          JSON.parse(new TextDecoder().decode(items[1].data)),
          languageId === "python" && clean ? logs.slice(2, 4) : logs,
        );
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
