// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { MarkupContent, SignatureHelp } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";
import { readFileSync } from "fs";

import {
  clearClientCustomMacros,
  getClientCustomMacro,
  getClientCustomMacros,
  sanitizeCustomMacrosResult,
  setClientCustomMacros,
} from "../../src/sas/CustomMacroStore";
import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

// the build loads messagebundle.properties as text (esbuild "text" loader);
// mirror that under ts-node so getText() works in these tests. The file is
// stored with LF in git; normalize in case of a CRLF (autocrlf) checkout.
if (!require.extensions[".properties"]) {
  require.extensions[".properties"] = (module, filename) => {
    module.exports = readFileSync(filename, "utf8").replace(/\r\n/g, "\n");
  };
}

const CURSOR = "|";

/** Creates a service for `code`; "|" marks the cursor position. */
function setup(code: string) {
  const offset = code.indexOf(CURSOR);
  const text = offset === -1 ? code : code.replace(CURSOR, "");
  const doc = TextDocument.create("file:///custom-macro.sas", "sas", 1, text);
  const service = new LanguageServiceProvider(doc);
  const position = doc.positionAt(offset === -1 ? text.length : offset);
  return { doc, service, position };
}

async function signatureAt(code: string): Promise<SignatureHelp | undefined> {
  const { service, position } = setup(code);
  return service.completionProvider.getSignatureHelp(position);
}

function activeParameterLabel(help: SignatureHelp | undefined) {
  assert.isDefined(help);
  if (!help) {
    return undefined;
  }
  const signature = help.signatures[help.activeSignature ?? 0];
  const parameter = signature.parameters?.[help.activeParameter ?? 0];
  if (!parameter) {
    return undefined;
  }
  const label = parameter.label;
  return typeof label === "string"
    ? label
    : signature.label.substring(label[0], label[1]);
}

function markdown(value: unknown): string {
  assert.isObject(value);
  const content: MarkupContent = Object(value);
  assert.equal(content.kind, "markdown");
  return content.value;
}

async function complete(code: string) {
  const { doc, service, position } = setup(code);
  return service.completionProvider.getCompleteItems({
    textDocument: { uri: doc.uri },
    position,
  });
}

const REPORT_DEF = [
  "/* Prints a report. */",
  "%macro report(ds, var, out=work.result, title=);",
  "%mend report;",
].join("\n");

describe("custom macro store", () => {
  afterEach(() => clearClientCustomMacros());

  it("rejects malformed responses", () => {
    assert.isUndefined(sanitizeCustomMacrosResult(undefined));
    assert.isUndefined(sanitizeCustomMacrosResult(null));
    assert.isUndefined(sanitizeCustomMacrosResult([]));
    assert.isUndefined(sanitizeCustomMacrosResult({ macros: "x" }));
    assert.deepEqual(sanitizeCustomMacrosResult({ macros: [] }), []);
  });

  it("drops invalid entries and fields", () => {
    const result = sanitizeCustomMacrosResult({
      macros: [
        { name: "1bad" },
        { name: "a".repeat(33) },
        "string",
        null,
        {
          name: "good",
          parameters: [
            { name: "p", keyword: "yes", defaultValue: "ignored" },
            { name: "k", keyword: true, defaultValue: "  1  " },
            { name: "bad name" },
            { keyword: true },
          ],
          parmbuff: "true",
          description: 42,
          sourceLabel: "My Folder/a.sas",
          extra: "dropped",
        },
      ],
    });
    assert.deepEqual(result, [
      {
        name: "good",
        parameters: [
          { name: "p", keyword: false },
          { name: "k", keyword: true, defaultValue: "1" },
        ],
        sourceLabel: "My Folder/a.sas",
      },
    ]);
  });

  it("caps long text", () => {
    const result = sanitizeCustomMacrosResult({
      macros: [{ name: "m", description: "x".repeat(5000) }],
    });
    assert.equal(result?.[0].description?.length, 2000);
  });

  it("stores macros case-insensitively, later duplicates win", () => {
    setClientCustomMacros([
      { name: "Util", description: "first" },
      { name: "UTIL", description: "second" },
    ]);
    assert.equal(getClientCustomMacros().length, 1);
    assert.equal(getClientCustomMacro("%util")?.description, "second");
    clearClientCustomMacros();
    assert.isUndefined(getClientCustomMacro("util"));
  });

  it("removes renamed macros when the client replaces its snapshot", () => {
    setClientCustomMacros([{ name: "addition1", sourceLabel: "add1.sas" }]);
    setClientCustomMacros([{ name: "additionA1", sourceLabel: "add1.sas" }]);

    assert.isUndefined(getClientCustomMacro("addition1"));
    assert.equal(getClientCustomMacro("additionA1")?.sourceLabel, "add1.sas");
  });
});

describe("custom macro signature help", () => {
  afterEach(() => clearClientCustomMacros());

  it("shows the signature of a macro defined in the current file", async () => {
    const help = await signatureAt(REPORT_DEF + "\n%report(|");
    assert.isDefined(help);
    assert.equal(
      help?.signatures[0].label,
      "%report(ds, var, out=work.result, title=)",
    );
    assert.equal(activeParameterLabel(help), "ds");
    const documentation = markdown(help?.signatures[0].documentation);
    assert.include(documentation, "Prints a report\\.");
    assert.include(documentation, "Defined in: _current file_");
    assert.deepEqual(help?.signatures[0].parameters?.[0].documentation, {
      kind: "markdown",
      value: "Positional parameter",
    });
  });

  it("tracks positional parameters across lines", async () => {
    const help = await signatureAt(
      REPORT_DEF + "\n%report(sashelp.class,\n   |",
    );
    assert.equal(activeParameterLabel(help), "var");
  });

  it("matches keyword arguments by name, in any order", async () => {
    assert.equal(
      activeParameterLabel(
        await signatureAt(REPORT_DEF + "\n%report(a, title=|"),
      ),
      "title=",
    );
    assert.equal(
      activeParameterLabel(
        await signatureAt(REPORT_DEF + "\n%report(OUT=x, |"),
      ),
      "ds",
    );
  });

  it("ignores commas in quotes, comments, %str and nested parentheses", async () => {
    const help = await signatureAt(
      REPORT_DEF + "\n%report('a,b', /* x, y */ |\n%mend;",
    );
    assert.equal(activeParameterLabel(help), "var");

    const quoted = await signatureAt(REPORT_DEF + "\n%report(%str(c,d), |");
    assert.equal(activeParameterLabel(quoted), "var");

    const escaped = await signatureAt(REPORT_DEF + "\n%report(%str(%(,), |");
    assert.equal(activeParameterLabel(escaped), "var");

    const nested = await signatureAt(REPORT_DEF + "\n%report(%scan(a b, 1), |");
    assert.equal(activeParameterLabel(nested), "var");

    const bare = await signatureAt(REPORT_DEF + "\n%report(ds, title=(1,2,|");
    assert.equal(activeParameterLabel(bare), "title=");
  });

  it("highlights the PARMBUFF parameter for extra arguments", async () => {
    const help = await signatureAt(
      "%macro list(first) / parmbuff;%mend;\n%list(a, b, |",
    );
    assert.equal(help?.signatures[0].label, "%list(first, ...)");
    assert.equal(activeParameterLabel(help), "...");
  });

  it("highlights nothing for unknown arguments without PARMBUFF", async () => {
    const help = await signatureAt("%macro one(a);%mend;\n%one(1, 2, |");
    assert.isDefined(help);
    assert.equal(help?.activeParameter, 1);
    assert.isUndefined(activeParameterLabel(help));
  });

  it("uses client-supplied macros", async () => {
    setClientCustomMacros([
      {
        name: "remote",
        parameters: [{ name: "x", keyword: false }],
        sourceLabel: "My Folder/lib/remote.sas",
      },
    ]);
    const help = await signatureAt("%remote(|");
    assert.equal(help?.signatures[0].label, "%remote(x)");
    assert.include(
      markdown(help?.signatures[0].documentation),
      "My Folder/lib/remote\\.sas",
    );
  });

  it("prefers the current file over client-supplied macros", async () => {
    setClientCustomMacros([
      { name: "dup", parameters: [{ name: "remote", keyword: false }] },
    ]);
    const help = await signatureAt("%macro dup(local);%mend;\n%dup(|");
    assert.equal(help?.signatures[0].label, "%dup(local)");
  });

  it("uses the last definition in the current file", async () => {
    const help = await signatureAt(
      "%macro m(a);%mend;\n%macro m(b);%mend;\n%m(|",
    );
    assert.equal(help?.signatures[0].label, "%m(b)");
  });

  it("never overrides built-in macro functions", async () => {
    setClientCustomMacros([
      { name: "scan", parameters: [{ name: "custom", keyword: false }] },
    ]);
    const help = await signatureAt("%macro scan(local);%mend;\n%scan(|");
    if (help) {
      assert.notInclude(help.signatures[0].label, "custom");
      assert.notInclude(help.signatures[0].label, "local");
    }
  });

  it("returns nothing outside of a call", async () => {
    setClientCustomMacros([{ name: "remote" }]);
    const help = await signatureAt("%remote(a);\ndata x; set y;|");
    assert.isUndefined(help);
  });

  it("does not show custom help for a macro name inside a string", async () => {
    setClientCustomMacros([
      { name: "remote", parameters: [{ name: "x", keyword: false }] },
    ]);
    const help = await signatureAt("title '%remote(|");
    assert.isUndefined(help);
  });
});

describe("custom macro completion", () => {
  afterEach(() => clearClientCustomMacros());

  it("suggests matching custom macros for a % prefix", async () => {
    setClientCustomMacros([
      {
        name: "remote",
        parameters: [
          { name: "a", keyword: false },
          { name: "b", keyword: false },
          { name: "k", keyword: true, defaultValue: "1" },
        ],
        sourceLabel: "My Folder/remote.sas",
      },
      { name: "kwonly", parameters: [{ name: "k", keyword: true }] },
      { name: "noparm" },
    ]);
    const result = await complete("data _null_;\n%re|");
    const item = result?.items.find((i) => i.label === "%remote");
    assert.isDefined(item);
    assert.equal(item?.insertText, "%remote(${1:a}, ${2:b})");
    assert.equal(item?.insertTextFormat, 2);
    assert.equal(item?.detail, "My Folder/remote.sas");
    assert.include(markdown(item?.documentation), "%remote(a, b, k=1)");
    assert.isUndefined(result?.items.find((i) => i.label === "%kwonly"));

    const all = await complete("%|");
    const labels = all?.items.map((i) => i.label) ?? [];
    assert.includeMembers(labels, ["%remote", "%kwonly", "%noparm"]);
    assert.equal(
      all?.items.find((i) => i.label === "%kwonly")?.insertText,
      "%kwonly($0)",
    );
    assert.equal(
      all?.items.find((i) => i.label === "%noparm")?.insertText,
      "%noparm",
    );
  });

  it("suggests macros defined in the current file", async () => {
    const result = await complete(REPORT_DEF + "\n%rep|");
    const item = result?.items.find((i) => i.label === "%report");
    assert.isDefined(item);
    assert.equal(item?.insertText, "%report(${1:ds}, ${2:var})");
  });

  it("does not offer a renamed macro after the client snapshot is replaced", async () => {
    setClientCustomMacros([{ name: "addition1", sourceLabel: "add1.sas" }]);
    setClientCustomMacros([{ name: "additionA1", sourceLabel: "add1.sas" }]);

    const result = await complete("%addi|");
    const labels = result?.items.map((item) => item.label) ?? [];
    assert.include(labels, "%additionA1");
    assert.notInclude(labels, "%addition1");
  });

  it("does not suggest custom macros without a % prefix", async () => {
    setClientCustomMacros([{ name: "remote" }]);
    const result = await complete("data _null_;\nre|");
    assert.isUndefined(result?.items.find((i) => i.label === "%remote"));
  });

  it("does not suggest custom macros in comments", async () => {
    setClientCustomMacros([{ name: "remote" }]);
    const result = await complete("/* %re|");
    assert.isUndefined(result?.items.find((i) => i.label === "%remote"));
  });

  it("does not replace built-in macro statements", async () => {
    setClientCustomMacros([{ name: "let", description: "custom let" }]);
    const result = await complete("%le|");
    const items = result?.items.filter((i) => i.label.toUpperCase() === "%LET");
    for (const item of items ?? []) {
      assert.notEqual(item.data?.customMacro, true);
    }
  });

  it("resolves custom macro items without a syntax lookup", async () => {
    const { service } = setup("");
    const item = {
      label: "%remote",
      documentation: "doc",
      data: { customMacro: true },
    };
    const resolved = await service.completionProvider.getCompleteItemHelp(item);
    assert.strictEqual(resolved, item);
  });
});

describe("custom macro hover", () => {
  afterEach(() => clearClientCustomMacros());

  it("shows the signature and source of a custom macro call", async () => {
    setClientCustomMacros([
      {
        name: "remote",
        parameters: [{ name: "x", keyword: false }],
        description: "Remote <b>macro</b>",
        sourceLabel: "My Folder/remote.sas",
      },
    ]);
    const { service } = setup("%remote(1);");
    const hover = await service.completionProvider.getHelp({
      line: 0,
      character: 3,
    });
    assert.isDefined(hover);
    const value = markdown(hover?.contents);
    assert.include(value, "%remote(x)");
    assert.include(value, "Remote \\<b\\>macro\\</b\\>");
    assert.include(value, "My Folder/remote\\.sas");
  });

  it("shows a macro defined in the current file", async () => {
    const { service } = setup(REPORT_DEF + "\n%report(a, b);");
    const hover = await service.completionProvider.getHelp({
      line: 3,
      character: 2,
    });
    assert.include(
      markdown(hover?.contents),
      "%report(ds, var, out=work.result, title=)",
    );
  });
});

describe("macro definition completion", () => {
  it("resolves completion inside a %macro definition", async () => {
    const result = await Promise.race([
      complete("%macro |"),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 2000),
      ),
    ]);
    assert.notEqual(result, "timeout");
  });
});
