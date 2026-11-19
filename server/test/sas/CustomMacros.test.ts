// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  InsertTextFormat,
  MarkupContent,
  SignatureHelp,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";
import { readFileSync } from "fs";

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
  service.completionProvider.setSnippetSupport(true);
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

describe("custom macro signature help", () => {
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

  it("uses the last definition in the current file", async () => {
    const help = await signatureAt(
      "%macro m(a);%mend;\n%macro m(b);%mend;\n%m(|",
    );
    assert.equal(help?.signatures[0].label, "%m(b)");
  });

  it("never overrides built-in macro functions", async () => {
    const help = await signatureAt("%macro scan(local);%mend;\n%scan(|");
    if (help) {
      assert.notInclude(help.signatures[0].label, "local");
    }
  });

  it("returns nothing outside of a call", async () => {
    const help = await signatureAt(
      "%macro remote(x);%mend;\n%remote(a);\ndata x; set y;|",
    );
    assert.isUndefined(help);
  });

  it("does not show custom help for a macro name inside a string", async () => {
    const help = await signatureAt("%macro remote(x);%mend;\ntitle '%remote(|");
    assert.isUndefined(help);
  });

  it("does not show signature help for macros outside the current document", async () => {
    const help = await signatureAt("%remote(|");
    assert.isUndefined(help);
  });

  it("does not parse the document for non-macro calls", async () => {
    const { service, position } = setup(
      "%macro m(a);%mend;\ndata x; y = substr(|",
    );
    await service.completionProvider.getSignatureHelp(position);
    assert.isUndefined(service.completionProvider["fileMacros"]);
  });
});

describe("custom macro completion", () => {
  it("suggests matching custom macros for a % prefix", async () => {
    const result = await complete(
      "%macro remote(a, b, k=1);%mend;\n%macro kwonly(k=);%mend;\n%macro noparm;%mend;\ndata _null_;\n%re|",
    );
    const item = result?.items.find((i) => i.label === "%remote");
    assert.isDefined(item);
    assert.equal(item?.insertText, "%remote(${1:a}, ${2:b}, k=${3:1})$0");
    assert.equal(item?.insertTextFormat, 2);
    assert.include(markdown(item?.documentation), "%remote(a, b, k=1)");
    assert.isUndefined(result?.items.find((i) => i.label === "%kwonly"));

    const all = await complete(
      "%macro remote(a, b, k=1);%mend;\n%macro kwonly(k=);%mend;\n%macro noparm;%mend;\n%|",
    );
    const labels = all?.items.map((i) => i.label) ?? [];
    assert.includeMembers(labels, ["%remote", "%kwonly", "%noparm"]);
    assert.equal(
      all?.items.find((i) => i.label === "%kwonly")?.insertText,
      "%kwonly(k=${1:})$0",
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
    assert.equal(
      item?.insertText,
      "%report(${1:ds}, ${2:var}, out=${3:work.result}, title=${4:})$0",
    );
  });

  it("does not suggest custom macros without a % prefix", async () => {
    const result = await complete("%macro remote;%mend;\ndata _null_;\nre|");
    assert.isUndefined(result?.items.find((i) => i.label === "%remote"));
  });

  it("does not suggest custom macros in comments", async () => {
    const result = await complete("%macro remote;%mend;\n/* %re|");
    assert.isUndefined(result?.items.find((i) => i.label === "%remote"));
  });

  it("does not replace built-in macro statements", async () => {
    const result = await complete("%macro let(custom);%mend;\n%le|");
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

describe("custom macro completion snippets", () => {
  async function itemFor(definition: string, name: string) {
    const result = await complete(definition + "\n%" + name + "|");
    const item = result?.items.find((i) => i.label === "%" + name);
    assert.isDefined(item);
    return item;
  }

  it("A: positional parameters become numbered placeholders", async () => {
    const item = await itemFor("%macro addition1(a, b);%mend;", "addition1");
    assert.equal(item?.label, "%addition1");
    assert.equal(item?.insertText, "%addition1(${1:a}, ${2:b})$0");
    assert.equal(item?.insertTextFormat, InsertTextFormat.Snippet);
  });

  it("B: keyword parameters become named-argument placeholders", async () => {
    const item = await itemFor("%macro addition2(a=, b=);%mend;", "addition2");
    assert.equal(item?.label, "%addition2");
    assert.equal(item?.insertText, "%addition2(a=${1:}, b=${2:})$0");
    assert.equal(item?.insertTextFormat, InsertTextFormat.Snippet);
  });

  it("C: mixed parameters keep positional first and use defaults", async () => {
    const item = await itemFor("%macro addition3(a, b=20);%mend;", "addition3");
    assert.equal(item?.label, "%addition3");
    assert.equal(item?.insertText, "%addition3(${1:a}, b=${2:20})$0");
    assert.equal(item?.insertTextFormat, InsertTextFormat.Snippet);
  });

  it("D: no parameters produce no placeholders", async () => {
    const item = await itemFor("%macro addition4();%mend;", "addition4");
    assert.equal(item?.label, "%addition4");
    assert.equal(item?.insertText, "%addition4()$0");
    assert.notInclude(String(item?.insertText), "${");
  });

  it("does not add a placeholder for PARMBUFF", async () => {
    const item = await itemFor("%macro list(first) / parmbuff;%mend;", "list");
    assert.equal(item?.insertText, "%list(${1:first})$0");
  });

  it("never puts snippet syntax in the label", async () => {
    const result = await complete(
      "%macro addition1(a, b);%mend;\n%macro addition3(a, b=20);%mend;\n%add|",
    );
    const items = result?.items.filter((i) => i.data?.customMacro) ?? [];
    assert.isNotEmpty(items);
    for (const item of items) {
      assert.notInclude(item.label, "${");
      assert.notInclude(item.filterText ?? "", "${");
      assert.equal(item.insertTextFormat, InsertTextFormat.Snippet);
    }
  });

  it("escapes snippet special characters in default values", async () => {
    const item = await itemFor("%macro esc(a=$x, b=y}, c=\\z);%mend;", "esc");
    assert.equal(
      item?.insertText,
      "%esc(a=${1:\\$x}, b=${2:y\\}}, c=${3:\\\\z})$0",
    );
  });

  it("inserts a plain call when the client has no snippet support", async () => {
    const { doc, service, position } = setup(
      "%macro addition3(a, b=20);%mend;\n%add|",
    );
    service.completionProvider.setSnippetSupport(false);
    const result = await service.completionProvider.getCompleteItems({
      textDocument: { uri: doc.uri },
      position,
    });
    const item = result?.items.find((i) => i.label === "%addition3");
    assert.equal(item?.insertText, "%addition3(a, b=20)");
    assert.equal(item?.insertTextFormat, InsertTextFormat.PlainText);
  });
});

describe("custom macro hover", () => {
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
