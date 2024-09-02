import * as vscode from "vscode";

import * as assert from "assert";
import * as sinon from "sinon";

import { getTestFixtureContent, getUri, openNotebookDoc } from "../../utils";

describe("export notebook", () => {
  const writeFileFn = sinon.spy();
  const uri = vscode.Uri.file("/a");
  before(async () => {
    await openNotebookDoc(getUri("sasnb_export.sasnb"));
    sinon.stub(vscode.window, "showSaveDialog").resolves(uri);
    sinon.stub(vscode.workspace, "fs").get(() => ({
      writeFile: writeFileFn,
    }));
  });

  after(() => {
    sinon.restore();
  });

  it("exports the sasnb to sas file correctly", async () => {
    await vscode.commands.executeCommand("SAS.notebook.export");
    assert.strictEqual(
      writeFileFn.calledOnceWithExactly(
        uri,
        getTestFixtureContent("sasnb_export.sas"),
      ),
      true,
    );
  });
});
