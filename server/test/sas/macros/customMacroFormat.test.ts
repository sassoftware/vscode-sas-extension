// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { InsertTextFormat } from "vscode-languageserver";

import { assert } from "chai";

import { CustomMacroStore } from "../../../src/sas/macros/CustomMacroStore";
import { getCompletionItem } from "../../../src/sas/macros/customMacroCompletion";

function completion(name: string, definition: Record<string, unknown>) {
  const store = new CustomMacroStore();
  store.set({ macros: { [name]: definition } });
  const macro = store.get(name);
  assert.isDefined(macro);
  return getCompletionItem(macro!, {
    start: { line: 0, character: 0 },
    end: { line: 0, character: name.length + 1 },
  });
}

describe("custom macro completion formatting", () => {
  it("creates positional and keyword tab stops with a final cursor stop", () => {
    const item = completion("logmsg", {
      parameters: [
        { name: "message" },
        { name: "level", defaultValue: "INFO" },
      ],
    });

    assert.equal(item.label, "%logmsg");
    assert.equal(item.insertTextFormat, InsertTextFormat.Snippet);
    assert.equal(
      item.textEdit?.newText,
      "%logmsg(\n     ${1:message}\n  ,  level  = ${2:INFO}\n)$0;",
    );
  });

  it("generates placeholders for multiple keyword defaults", () => {
    const item = completion("report", {
      parameters: [
        { name: "paramOne", defaultValue: "Hello" },
        { name: "paramTwo", defaultValue: "world" },
        { name: "paramThree", defaultValue: "default" },
      ],
    });

    assert.equal(
      item.textEdit?.newText,
      "%report(\n     paramOne    = ${1:Hello}\n  ,  paramTwo    = ${2:world}\n  ,  paramThree  = ${3:default}\n)$0;",
    );
  });

  it("uses a bare tab stop for an empty keyword default", () => {
    const item = completion("copyds", {
      parameters: [{ name: "out", defaultValue: "" }],
    });

    assert.equal(item.textEdit?.newText, "%copyds(\n     out  = ${1}\n)$0;");
    assert.equal(item.insertTextFormat, InsertTextFormat.Snippet);
  });

  it("inserts the macro name and semicolon when there are no parameters", () => {
    const item = completion("cleanup", { parameters: [] });

    assert.equal(item.textEdit?.newText, "%cleanup;");
    assert.notEqual(item.insertTextFormat, InsertTextFormat.Snippet);
  });

  it("escapes snippet metacharacters in parameter names and defaults", () => {
    const item = getCompletionItem(
      {
        name: "literal",
        parameters: [{ name: "value$}\\", defaultValue: "a$b}c\\d" }],
      },
      {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 7 },
      },
    );

    assert.equal(item.insertTextFormat, InsertTextFormat.Snippet);
    assert.equal(
      item.textEdit?.newText,
      "%literal(\n     value\\$\\}\\\\  = ${1:a\\$b\\}c\\\\d}\n)$0;",
    );
  });

  it("preserves declared parameter order for copyData and SortDS", () => {
    const copyData = completion("copyData", {
      parameters: [
        { name: "in", defaultValue: "" },
        { name: "out", defaultValue: "" },
      ],
    });
    const sortDS = completion("SortDS", {
      parameters: [
        { name: "ds" },
        { name: "out", defaultValue: "" },
        { name: "by", defaultValue: "" },
      ],
    });

    assert.equal(
      copyData.textEdit?.newText,
      "%copyData(\n     in   = ${1}\n  ,  out  = ${2}\n)$0;",
    );
    assert.equal(sortDS.detail, "(ds, out=, by=)");
    assert.equal(
      sortDS.textEdit?.newText,
      "%SortDS(\n     ${1:ds}\n  ,  out  = ${2}\n  ,  by   = ${3}\n)$0;",
    );
  });
});
