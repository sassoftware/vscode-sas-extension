import * as vscode from "vscode";

import * as assert from "assert";

import { getUri, openDoc } from "./utils";

// Fix: to resolve implicit 'any' type error
let docUri: vscode.Uri;

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

  it("provides signature help", async () => {
    // Executing the command `vscode.executeSignatureHelpProvider` to simulate signature help
    const docUri2 = getUri("SampleCode2.sas");
    await openDoc(docUri2);
    const actualSignatureHelp: vscode.SignatureHelp =
      await vscode.commands.executeCommand(
        "vscode.executeSignatureHelpProvider",
        docUri2,
        new vscode.Position(1, 10),
        "(",
      );
    assert.ok(actualSignatureHelp.signatures.length > 0);
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

  it("provides full DATA step names in document symbol", async () => {
    const docUri3 = getUri("OutlineDataStepNames.sas");
    await openDoc(docUri3);

    let actualDocumentSymbol: Array<
      vscode.DocumentSymbol | vscode.SymbolInformation
    > = [];

    for (let i = 0; i < 20; i++) {
      actualDocumentSymbol =
        (await vscode.commands.executeCommand<
          Array<vscode.DocumentSymbol | vscode.SymbolInformation>
        >("vscode.executeDocumentSymbolProvider", docUri3)) ?? [];

      if (actualDocumentSymbol.length > 0) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    assert.ok(
      actualDocumentSymbol.length > 0,
      "No document symbols returned for OutlineDataStepNames.sas",
    );

    const names = actualDocumentSymbol.map((symbol) =>
      symbol.name.toLowerCase(),
    );

    assert.ok(
      names.includes("data ___&danal."),
      `Expected outline item "DATA ___&danal.", got: ${actualDocumentSymbol
        .map((symbol) => symbol.name)
        .join(", ")}`,
    );

    assert.ok(
      names.includes("data _null_"),
      `Expected outline item "DATA _null_", got: ${actualDocumentSymbol
        .map((symbol) => symbol.name)
        .join(", ")}`,
    );
  });
});
