import * as vscode from "vscode";

import * as assert from "assert";

import { getTestFixtureContent, getUri, openDoc } from "../utils";

const expected = getTestFixtureContent("formatter/expected.sas").toString();

it("formats sas code well", async () => {
  const docUri = getUri("formatter/unformatted.sas");
  await openDoc(docUri);
  // Executing the command `vscode.executeFormatDocumentProvider` to simulate triggering format
  const edits: vscode.TextEdit[] = await vscode.commands.executeCommand(
    "vscode.executeFormatDocumentProvider",
    docUri,
    {},
  );
  const edit = new vscode.WorkspaceEdit();
  edit.set(docUri, edits);
  await vscode.workspace.applyEdit(edit);
  assert.strictEqual(
    vscode.window.activeTextEditor.document.getText().replace(/\r\n/g, "\n"),
    expected,
  );
});
