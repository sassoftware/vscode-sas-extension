// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { LanguageServiceProvider } from "../../../src/sas/LanguageServiceProvider";
import { CustomMacroStore } from "../../../src/sas/macros/CustomMacroStore";

function createService(code: string, macros: Record<string, unknown> = {}) {
  const document = TextDocument.create(
    "file:///custom-macro-provider.sas",
    "sas",
    1,
    code,
  );
  const service = new LanguageServiceProvider(document);
  const store = new CustomMacroStore();
  store.set({ macros });
  service.completionProvider.setCustomMacroSupport(store);
  return { document, service };
}

describe("custom macro language-service behavior", () => {
  it("completes custom macro names case-insensitively with signature and insertion", async () => {
    const { document, service } = createService("%sort", {
      SortDS: {
        parameters: [{ name: "ds" }, { name: "out", defaultValue: "" }],
      },
    });

    const result = await service.completionProvider.getCompleteItems({
      textDocument: { uri: document.uri },
      position: document.positionAt(document.getText().length),
    });
    const item = result?.items.find(
      (candidate) => candidate.label === "%SortDS",
    );

    assert.isDefined(item);
    assert.equal(item?.detail, "(ds, out=)");
    assert.equal(
      item?.textEdit && "newText" in item.textEdit
        ? item.textEdit.newText
        : undefined,
      "%SortDS(\n     ${1:ds}\n  ,  out  = ${2}\n)$0;",
    );
  });

  it("provides custom signature help and tracks positional and keyword arguments", async () => {
    const code = "%SortDS(data, out=)";
    const { document, service } = createService(code, {
      SortDS: {
        parameters: [{ name: "data" }, { name: "out", defaultValue: "" }],
      },
    });

    const help = await service.completionProvider.getSignatureHelp(
      document.positionAt(code.length - 1),
    );

    assert.isDefined(help);
    assert.equal(help?.signatures[0].label, "%SortDS(data, out=)");
    assert.equal(help?.activeParameter, 1);
  });

  it("ignores commas inside nested expressions when selecting the active parameter", async () => {
    const code = "%SortDS(%str(a,b), )";
    const { document, service } = createService(code, {
      SortDS: {
        parameters: [
          { name: "data" },
          { name: "other" },
          { name: "out", defaultValue: "" },
        ],
      },
    });

    const help = await service.completionProvider.getSignatureHelp(
      document.positionAt(code.length - 1),
    );

    assert.equal(help?.activeParameter, 1);
  });

  it("returns macro documentation on hover", async () => {
    const code = "%SortDS(data)";
    const { document, service } = createService(code, {
      SortDS: {
        parameters: [{ name: "data" }],
        documentation: "Sort a dataset.",
      },
    });

    const help = await service.completionProvider.getHelp(
      document.positionAt(code.indexOf("SortDS") + 2),
    );

    assert.deepEqual(help?.contents, {
      kind: "markdown",
      value: "Sort a dataset.",
    });
  });

  it("does not offer custom macro names in comments", async () => {
    const code = "* %sort;";
    const { document, service } = createService(code, {
      SortDS: { parameters: [] },
    });

    const result = await service.completionProvider.getCompleteItems({
      textDocument: { uri: document.uri },
      position: document.positionAt(code.length - 1),
    });

    assert.isFalse(
      (result?.items.map((item) => item.label) ?? []).includes("%SortDS"),
    );
  });

  it("resolves completion requests in a macro declaration without suggestions", async () => {
    const code = "%macro custom ";
    const { document, service } = createService(code, {
      CustomMacro: { parameters: [] },
    });

    const result = await service.completionProvider.getCompleteItems({
      textDocument: { uri: document.uri },
      position: document.positionAt(code.length),
    });

    assert.isFalse(
      (result?.items.map((item) => item.label) ?? []).includes("%CustomMacro"),
    );
  });
});
