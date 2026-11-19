import * as vscode from "vscode";

import * as assert from "assert";
import proxyquire from "proxyquire";
import * as sinon from "sinon";

import {
  NotebookSerializer,
  getStoredSasLog,
} from "../../../src/components/notebook/Serializer";
import { getTestFixtureContent, getUri, openNotebookDoc } from "../../utils";

describe("export notebook", () => {
  let writeFileFn: sinon.SinonSpy;
  let showQuickPickStub: sinon.SinonStub;
  let showSaveDialogStub: sinon.SinonStub;

  beforeEach(async () => {
    writeFileFn = sinon.spy();
    await openNotebookDoc(getUri("sasnb_export.sasnb"));
    showQuickPickStub = sinon.stub(vscode.window, "showQuickPick");
    showSaveDialogStub = sinon.stub(vscode.window, "showSaveDialog");
    sinon.stub(vscode.workspace, "fs").get(() => ({
      writeFile: writeFileFn,
    }));
  });

  afterEach(() => {
    sinon.restore();
  });

  it("exports the sasnb to sas file correctly", async () => {
    const uri = vscode.Uri.file("/test.sas");
    showQuickPickStub.resolves({
      label: "SAS Code",
      description: "Export as SAS program file",
      format: "sas",
      extension: "sas",
    });
    showSaveDialogStub.resolves(uri);

    await vscode.commands.executeCommand("SAS.notebook.export");

    assert.strictEqual(writeFileFn.calledOnce, true);
    assert.strictEqual(writeFileFn.firstCall.args[0], uri);

    const sasContent = new TextDecoder().decode(writeFileFn.firstCall.args[1]);
    const expectedContent = new TextDecoder().decode(
      getTestFixtureContent("sasnb_export.sas"),
    );
    const normalizeLineEndings = (text: string) => text.replace(/\r\n/g, "\n");
    assert.strictEqual(
      normalizeLineEndings(sasContent),
      normalizeLineEndings(expectedContent),
    );
  });

  it("cancels export when no format is selected", async () => {
    showQuickPickStub.resolves(undefined);

    await vscode.commands.executeCommand("SAS.notebook.export");
    assert.strictEqual(writeFileFn.called, false);
  });

  it("cancels export when no save location is selected", async () => {
    showQuickPickStub.resolves({
      label: "SAS Code",
      description: "Export as SAS program file",
      format: "sas",
      extension: "sas",
    });
    showSaveDialogStub.resolves(undefined);

    await vscode.commands.executeCommand("SAS.notebook.export");
    assert.strictEqual(writeFileFn.called, false);
  });
});

describe("notebook SAS log export", () => {
  const logs = [
    { type: "note", line: "NOTE: Step completed" },
    { type: "error", line: "ERROR 79-322" },
  ];

  function createCell(metadata: object, outputs: object[], languageId = "sql") {
    return {
      kind: vscode.NotebookCellKind.Code,
      metadata,
      document: { languageId, getText: () => "select * from test;" },
      outputs,
    };
  }

  for (const includeLog of [true, false]) {
    it(`exports stored SAS diagnostics only when includeLog is ${includeLog}`, async () => {
      const exporter = proxyquire(
        "../../../src/components/notebook/exporters/toHTML",
        {
          vscode: {
            "@noCallThru": true,
            ColorThemeKind: vscode.ColorThemeKind,
            NotebookCellKind: vscode.NotebookCellKind,
            window: { activeColorTheme: { kind: vscode.ColorThemeKind.Light } },
          },
          fs: {
            "@noCallThru": true,
            readFileSync: (file: string) =>
              Buffer.from(file.endsWith("default.html") ? "${content}" : ""),
          },
          "../../utils/settings": {
            includeLogInNotebookExport: () => includeLog,
          },
          "../Serializer": { "@noCallThru": true, getStoredSasLog },
        },
      );
      const cell = createCell({ sasExecutionLog: logs }, []);

      const html = await exporter.exportToHTML(
        { getCells: () => [cell] },
        undefined,
      );

      assert.strictEqual(html.includes("NOTE: Step completed"), includeLog);
      assert.strictEqual(html.includes("ERROR 79-322"), includeLog);
    });
  }

  for (const source of ["stored", "reopened", "legacy"]) {
    it(`saves ${source} SAS log content`, async () => {
      let metadata = source === "legacy" ? {} : { sasExecutionLog: logs };
      if (source === "reopened") {
        const serializer = new NotebookSerializer();
        const notebookCell = new vscode.NotebookCellData(
          vscode.NotebookCellKind.Code,
          "select * from test;",
          "sql",
        );
        notebookCell.metadata = metadata;
        const encoded = await serializer.serializeNotebook(
          new vscode.NotebookData([notebookCell]),
        );
        metadata = (await serializer.deserializeNotebook(encoded)).cells[0]
          .metadata;
      }
      const outputs =
        source === "legacy"
          ? [
              {
                items: [
                  {
                    mime: "application/vnd.sas.compute.log.lines",
                    data: Buffer.from(JSON.stringify(logs)),
                  },
                ],
              },
            ]
          : [];
      const cell = createCell(metadata, outputs);
      const showQuickPick = sinon.stub().resolves({ outputType: "log" });
      const showSaveDialog = sinon
        .stub()
        .resolves(vscode.Uri.file("/result.log"));
      const writeFile = sinon.stub().resolves();
      const exporter: typeof import("../../../src/components/notebook/exporters") =
        proxyquire("../../../src/components/notebook/exporters", {
          vscode: {
            "@noCallThru": true,
            Uri: vscode.Uri,
            l10n: vscode.l10n,
            window: {
              activeNotebookEditor: {
                notebook: { cellAt: () => cell, uri: { path: "/test.sasnb" } },
                selection: { start: 0 },
              },
              showQuickPick,
              showSaveDialog,
              showInformationMessage: sinon.stub(),
            },
            workspace: { fs: { writeFile } },
          },
          "../Serializer": { "@noCallThru": true, getStoredSasLog },
          "./toHTML": { exportToHTML: sinon.stub() },
          "./toSAS": { exportToSAS: sinon.stub() },
        });

      await exporter.saveOutput();

      assert.strictEqual(showQuickPick.firstCall.args[0][0].outputType, "log");
      assert.strictEqual(
        new TextDecoder().decode(writeFile.firstCall.args[1]),
        "NOTE: Step completed\nERROR 79-322",
      );
    });
  }

  it("does not treat SAS metadata as Python log output", () => {
    const cell = createCell({ sasExecutionLog: logs }, [], "python");
    const readLog = sinon.stub().callsFake(getStoredSasLog);
    assert.strictEqual(readLog(cell), undefined);
  });
});
