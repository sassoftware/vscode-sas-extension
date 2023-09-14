import * as assert from "assert";
import * as vscode from "vscode";

import { getUri, openDoc } from "./utils";

let docUri;

describe("lsp", () => {
  before(async () => {
    docUri = getUri("SampleCode.sas");
    await openDoc(docUri);
  });

  it("provides completion items", async () => {
    // Executing the command `vscode.executeCompletionItemProvider` to simulate triggering completion
    const actualCompletionList: vscode.CompletionList =
      await vscode.commands.executeCommand(
        "vscode.executeCompletionItemProvider",
        docUri,
        new vscode.Position(0, 0),
      );
    assert.ok(actualCompletionList.items.length > 0);
  });

  it("provides hover", async () => {
    // Executing the command `vscode.executeHoverProvider` to simulate mouse hovering
    const [actualHover]: vscode.Hover[] = await vscode.commands.executeCommand(
      "vscode.executeHoverProvider",
      docUri,
      new vscode.Position(0, 0),
    );
    assert.ok(actualHover.contents[0]);
  });

  it("provides document symbol", async () => {
    // Executing the command `vscode.executeDocumentSymbolProvider` to simulate outline
    const actualDocumentSymbol: vscode.DocumentSymbol[] =
      await vscode.commands.executeCommand(
        "vscode.executeDocumentSymbolProvider",
        docUri,
      );
    assert.ok(actualDocumentSymbol.length > 0);
  });
});
