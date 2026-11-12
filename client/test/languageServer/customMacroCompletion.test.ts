import * as vscode from "vscode";

import * as assert from "assert";

import { getUri, openDoc } from "../utils";

describe("Custom macro completion", () => {
  afterEach(async () => {
    await vscode.commands.executeCommand(
      "workbench.action.revertAndCloseActiveEditor",
    );
  });

  it("expands the snippet of a macro defined in the current file", async () => {
    const docUri = getUri("customMacros/addition.sas");
    await openDoc(docUri);
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor, "no active editor");
    const doc = editor.document;
    const prefix = "%add";
    const start = doc.positionAt(doc.getText().lastIndexOf(prefix));
    const end = start.translate(0, prefix.length);

    const list = await vscode.commands.executeCommand<vscode.CompletionList>(
      "vscode.executeCompletionItemProvider",
      docUri,
      end,
    );
    const item = list.items.find(
      (i) =>
        (typeof i.label === "string" ? i.label : i.label.label) === "%addition",
    );
    assert.ok(item, "custom macro completion item not found");
    assert.ok(
      item.insertText instanceof vscode.SnippetString,
      "insertText should be a snippet",
    );

    // accept the completion: replace the typed prefix with the snippet
    await editor.insertSnippet(item.insertText, new vscode.Range(start, end));

    const call = "%addition(a, b)";
    assert.strictEqual(doc.lineAt(start.line).text, call);
    assert.ok(!doc.getText().includes("${"), "literal snippet syntax left");

    const at = (column: number) => start.translate(0, column);
    const first = call.indexOf("a");
    assert.ok(
      editor.selection.isEqual(new vscode.Selection(at(first), at(first + 1))),
      "first parameter should be selected",
    );

    await vscode.commands.executeCommand("jumpToNextSnippetPlaceholder");
    const second = call.indexOf("b");
    assert.ok(
      editor.selection.isEqual(
        new vscode.Selection(at(second), at(second + 1)),
      ),
      "Tab should select the second parameter",
    );

    await vscode.commands.executeCommand("jumpToNextSnippetPlaceholder");
    assert.ok(
      editor.selection.isEmpty &&
        editor.selection.active.isEqual(at(call.length)),
      "last Tab should end after the closing parenthesis",
    );
  });
});
