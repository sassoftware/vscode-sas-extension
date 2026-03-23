import * as vscode from "vscode";

import * as assert from "assert";
import * as sinon from "sinon";

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
    assert.strictEqual(sasContent, expectedContent);
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
