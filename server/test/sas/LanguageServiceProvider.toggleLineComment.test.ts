import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

const toggleComment = (
  content: string,
  startLine = 0,
  endLine?: number,
): string | null => {
  const document = TextDocument.create("toggle-comment.sas", "sas", 1, content);
  const lines = content.split(/\r\n|\r|\n/);
  const service = new LanguageServiceProvider(document);
  const actualEndLine = endLine ?? lines.length - 1;

  return service.toggleLineComment({
    start: { line: startLine, character: 0 },
    end: {
      line: actualEndLine,
      character: lines[actualEndLine].length,
    },
  });
};

describe("SAS toggle line comment", () => {
  it("wraps each non-blank selected line and preserves indentation", () => {
    assert.equal(
      toggleComment("  endsubmit;\n  run;"),
      "  /*endsubmit;*/\n  /*run;*/",
    );
  });

  it("removes per-line wrappers when every non-blank line is wrapped", () => {
    assert.equal(
      toggleComment("  /*endsubmit;*/\n  /*run;*/"),
      "  endsubmit;\n  run;",
    );
  });

  it("leaves blank lines unwrapped", () => {
    assert.equal(
      toggleComment("  endsubmit;\n   \n  run;"),
      "  /*endsubmit;*/\n   \n  /*run;*/",
    );
  });

  it("toggles a single line on and off", () => {
    const commented = toggleComment("  run;");

    assert.equal(commented, "  /*run;*/");
    assert.equal(toggleComment(commented!), "  run;");
  });

  it("adds comments if only some non-blank lines are already wrapped", () => {
    assert.equal(
      toggleComment("/*already commented*/\nrun;"),
      "/*already commented*/\n/*run;*/",
    );
  });

  it("does not add wrappers inside an existing multiline block comment", () => {
    assert.equal(
      toggleComment(
        "/* existing comment\ninside comment\nend comment */\nrun;",
      ),
      "/* existing comment\ninside comment\nend comment */\n/*run;*/",
    );
  });

  it("comments selected ENDSUBMIT and RUN statements", () => {
    const content = [
      "proc python;",
      "submit;",
      'print("test")',
      "endsubmit;",
      "run;",
    ].join("\n");

    assert.equal(toggleComment(content, 3, 4), "/*endsubmit;*/\n/*run;*/");
  });

  it("uses a SAS block comment for a single ENDSUBMIT line", () => {
    const content = [
      "proc python;",
      "submit;",
      'print("test")',
      "endsubmit;",
      "run;",
    ].join("\n");

    assert.equal(toggleComment(content, 3, 3), "/*endsubmit;*/");
  });

  it("removes a single SAS block comment around ENDSUBMIT without falling back to native comments", () => {
    const content = [
      "proc python;",
      "submit;",
      'print("test")',
      "/*endsubmit;*/",
      "run;",
    ].join("\n");

    assert.equal(toggleComment(content, 3, 3), "endsubmit;");
  });

  it("leaves a single embedded Python line to native comment handling", () => {
    const content = [
      "proc python;",
      "submit;",
      'print("test")',
      "endsubmit;",
      "run;",
    ].join("\n");

    assert.isNull(toggleComment(content, 2, 2));
  });

  it("comments each line when the whole PROC PYTHON block is selected", () => {
    const content = [
      "proc python;",
      "submit;",
      'print("test")',
      "endsubmit;",
      "run;",
    ].join("\n");

    assert.equal(
      toggleComment(content),
      [
        "/*proc python;*/",
        "/*submit;*/",
        '/*print("test")*/',
        "/*endsubmit;*/",
        "/*run;*/",
      ].join("\n"),
    );
  });
});
