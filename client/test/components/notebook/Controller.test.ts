// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as vscode from "vscode";

import { expect } from "chai";
import * as path from "path";
import { SinonSandbox, SinonStub, createSandbox } from "sinon";

import { NotebookController } from "../../../src/components/notebook/Controller";
import * as connection from "../../../src/connection";

// Helper functions to create properly typed mock objects
function createMockDocument(
  sandbox: SinonSandbox,
  overrides: Partial<vscode.TextDocument>,
): vscode.TextDocument {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial mock for testing
  return {
    version: 1,
    isDirty: false,
    isClosed: false,
    eol: vscode.EndOfLine.LF,
    lineCount: 1,
    lineAt: sandbox.stub().returns({ text: "" }),
    offsetAt: sandbox.stub().returns(0),
    positionAt: sandbox.stub().returns(new vscode.Position(0, 0)),
    getWordRangeAtPosition: sandbox.stub().returns(undefined),
    validateRange: sandbox.stub().callsFake((range: vscode.Range) => range),
    validatePosition: sandbox
      .stub()
      .callsFake((position: vscode.Position) => position),
    ...overrides,
  } as vscode.TextDocument;
}

function createMockCell(
  overrides: Partial<vscode.NotebookCell>,
): vscode.NotebookCell {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial mock for testing
  return {
    index: 0,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Empty object for mock
    notebook: {} as never,
    kind: vscode.NotebookCellKind.Code,
    metadata: {},
    outputs: [],
    executionSummary: undefined,
    ...overrides,
  } as vscode.NotebookCell;
}

function createMockExecution(
  sandbox: SinonSandbox,
  executionOrder: number,
): vscode.NotebookCellExecution {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Partial mock for testing
  return {
    executionOrder,
    start: sandbox.stub(),
    end: sandbox.stub(),
    clearOutput: sandbox.stub(),
    replaceOutput: sandbox.stub(),
    appendOutput: sandbox.stub(),
    appendOutputItems: sandbox.stub(),
    replaceOutputItems: sandbox.stub(),
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Empty object for mock
    token: {} as never,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Undefined for mock
    cell: undefined as never,
  } as vscode.NotebookCellExecution;
}

describe("NotebookController", () => {
  let sandbox: SinonSandbox;
  let mockSession: {
    setup: SinonStub;
    run: SinonStub;
    cancel: SinonStub;
    close: SinonStub;
    sessionId: SinonStub;
    onExecutionLogFn: undefined;
    onSessionLogFn: undefined;
    _run: SinonStub;
    _close: SinonStub;
    _rejectRun: undefined;
    _connectionPromise: undefined;
    _onSessionLogFn: undefined;
    _onExecutionLogFn: undefined;
    establishConnection: SinonStub;
  };
  let controller: NotebookController;

  beforeEach(() => {
    sandbox = createSandbox();

    // Create mock session with all required methods
    mockSession = {
      setup: sandbox.stub().resolves(),
      run: sandbox.stub().resolves({
        html5: "<html>test output</html>",
      }),
      cancel: sandbox.stub().resolves(),
      close: sandbox.stub().resolves(),
      sessionId: sandbox.stub().returns("mock-session-id"),
      onExecutionLogFn: undefined,
      onSessionLogFn: undefined,
      _run: sandbox.stub().resolves({ html5: "<html>test output</html>" }),
      _close: sandbox.stub().resolves(),
      _rejectRun: undefined,
      _connectionPromise: undefined,
      _onSessionLogFn: undefined,
      _onExecutionLogFn: undefined,
      establishConnection: sandbox.stub().resolves(),
    };

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Mock doesn't fully implement Session
    sandbox.stub(connection, "getSession").returns(mockSession as never);

    controller = new NotebookController();
  });

  afterEach(() => {
    controller.dispose();
    sandbox.restore();
  });

  describe("baseDirectory parameter handling", () => {
    it("should pass baseDirectory to session.run when executing notebook cell", async () => {
      const notebookPath = "/home/user/projects/notebooks/test.sasnb";
      const cellUri = vscode.Uri.parse(
        `vscode-notebook-cell:${notebookPath}#cell1`,
      );

      const mockDocument = createMockDocument(sandbox, {
        uri: cellUri,
        fileName: notebookPath,
        languageId: "sas",
        getText: () => "%put &=_SASPROGRAMDIR;",
        save: sandbox.stub(),
      });

      const mockCell = createMockCell({
        document: mockDocument,
      });

      const mockExecution = createMockExecution(sandbox, 1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testController: any = controller;
      sandbox
        .stub(testController._controller, "createNotebookCellExecution")
        .returns(mockExecution);

      await testController._doExecution(mockCell);

      expect(mockSession.run.calledOnce).to.be.true;
      const runArgs = mockSession.run.firstCall.args;
      expect(runArgs).to.have.lengthOf(2);
      expect(runArgs[1]).to.deep.equal({
        baseDirectory: "/home/user/projects/notebooks",
      });
    });

    it("should pass baseDirectory parameter for Windows-style paths", async () => {
      const notebookPath = "C:\\Users\\user\\notebooks\\test.sasnb";
      const cellUri = vscode.Uri.parse(
        `vscode-notebook-cell:${notebookPath}#cell1`,
      );

      const mockDocument = createMockDocument(sandbox, {
        uri: cellUri,
        fileName: notebookPath,
        languageId: "sas",
        getText: () => "data test; run;",
        save: sandbox.stub(),
      });

      const mockCell = createMockCell({
        document: mockDocument,
      });

      const mockExecution = createMockExecution(sandbox, 1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testController: any = controller;
      sandbox
        .stub(testController._controller, "createNotebookCellExecution")
        .returns(mockExecution);

      await testController._doExecution(mockCell);

      expect(mockSession.run.calledOnce).to.be.true;
      const runArgs = mockSession.run.firstCall.args;
      expect(runArgs).to.have.lengthOf(2);
      expect(runArgs[1]).to.have.property("baseDirectory");
      expect(runArgs[1].baseDirectory).to.be.a("string");
      expect(runArgs[1].baseDirectory).to.equal(path.dirname(notebookPath));
    });

    it("should pass different baseDirectory for cells in different directories", async () => {
      // First cell in directory A
      const firstNotebookPath = "/home/user/projectA/notebook1.sasnb";
      const firstCellUri = vscode.Uri.parse(
        `vscode-notebook-cell:${firstNotebookPath}#cell1`,
      );

      const firstMockDoc = createMockDocument(sandbox, {
        uri: firstCellUri,
        fileName: firstNotebookPath,
        languageId: "sas",
        getText: () => "data test1; run;",
        save: sandbox.stub(),
      });

      const firstMockCell = createMockCell({
        document: firstMockDoc,
      });

      const firstMockExecution = createMockExecution(sandbox, 1);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const testController: any = controller;
      const createExecutionStub = sandbox
        .stub(testController._controller, "createNotebookCellExecution")
        .returns(firstMockExecution);

      await testController._doExecution(firstMockCell);

      expect(mockSession.run.calledOnce).to.be.true;
      const firstRunArgs = mockSession.run.firstCall.args;
      expect(firstRunArgs[1]).to.deep.equal({
        baseDirectory: "/home/user/projectA",
      });

      mockSession.run.resetHistory();

      const secondNotebookPath = "/home/user/projectB/notebook2.sasnb";
      const secondCellUri = vscode.Uri.parse(
        `vscode-notebook-cell:${secondNotebookPath}#cell1`,
      );

      const secondMockDoc = createMockDocument(sandbox, {
        uri: secondCellUri,
        fileName: secondNotebookPath,
        languageId: "sas",
        getText: () => "data test2; run;",
        save: sandbox.stub(),
      });

      const secondMockCell = createMockCell({
        document: secondMockDoc,
      });

      const secondMockExecution = createMockExecution(sandbox, 2);

      // Reuse the existing stub from the first cell execution
      createExecutionStub.returns(secondMockExecution);

      await testController._doExecution(secondMockCell);

      expect(mockSession.run.calledOnce).to.be.true;
      const secondRunArgs = mockSession.run.firstCall.args;
      expect(secondRunArgs[1]).to.deep.equal({
        baseDirectory: "/home/user/projectB",
      });
    });
  });
});
