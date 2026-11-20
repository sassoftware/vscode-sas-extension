import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

const getSemicolonTriggeredIndentEdits = (
  content: string,
  line: number,
  tabSize = 2,
  useSpace = true,
) => {
  const doc = TextDocument.create("test.sas", "sas", 1, content);
  const languageService = new LanguageServiceProvider(doc);
  const lineText = doc.getText().split(/\r?\n/)[line] ?? "";

  return languageService.formatOnTypeProvider.getIndentEdit(
    line,
    lineText.length,
    ";",
    tabSize,
    useSpace,
  );
};

describe("FormatOnTypeProvider semicolon indentation", () => {
  it("does not auto-indent a new single-line proc statement after backspacing to column 0", () => {
    const content = [
      "proc print data=test;",
      '  title "title";',
      "  format pf70 best8.;",
      "proc print data=sashelp.cars; run;",
    ].join("\n");

    const edits = getSemicolonTriggeredIndentEdits(content, 3);

    assert.deepEqual(edits, []);
  });

  //regression test for pre-existing behavior
  it("keeps existing multiple-run indentation behavior for multi-line proc blocks", () => {
    const content = [
      "proc catalog;",
      "  contents out=a;",
      "run;",
      "  copy out=a;",
      "  run;",
      "quit;",
    ].join("\n");

    const edits = getSemicolonTriggeredIndentEdits(content, 2);

    assert.lengthOf(edits, 1);
    assert.strictEqual(edits[0].newText, "  ");
  });
});

type Edit = [line: number, endChar: number, text: string];

const getEdits = (
  content: string,
  line: number,
  trigger: string,
  tabSize = 2,
  useSpace = true,
): Edit[] => {
  const doc = TextDocument.create("test.sas", "sas", 1, content);
  const provider = new LanguageServiceProvider(doc).formatOnTypeProvider;
  const lineText = doc.getText().split(/\r?\n/)[line] ?? "";
  const col = trigger === "\n" ? 0 : lineText.length;
  return provider
    .getIndentEdit(line, col, trigger, tabSize, useSpace)
    .map((e) => [e.range.start.line, e.range.end.character, e.newText]);
};

// `line` is the new line created by pressing Enter
const enter = (
  content: string,
  line: number,
  tabSize?: number,
  useSpace?: boolean,
) => getEdits(content, line, "\n", tabSize, useSpace);

describe("FormatOnTypeProvider enter-triggered indentation", () => {
  it("indents after block-opening statements (DATA, PROC, %MACRO)", () => {
    assert.deepEqual(enter("data a;\n", 1), [[1, 0, "  "]]);
    assert.deepEqual(enter("proc sort;\n", 1), [[1, 0, "  "]]);
    assert.deepEqual(enter("%macro m;\n", 1), [[1, 0, "  "]]);
    // a misaligned opener snaps the next line to the next tab stop
    assert.deepEqual(enter(" data a;\n", 1), [[1, 0, "  "]]);
  });

  it("keeps the current indentation after an ordinary statement", () => {
    assert.deepEqual(enter("data a;\n  x=1;\n", 2), [[2, 0, "  "]]);
    assert.deepEqual(enter("data a;\n  set b\n    c;\n", 3), [[3, 0, "    "]]);
  });

  it("dedents after RUN, QUIT and %MEND", () => {
    assert.deepEqual(enter("data a;\nrun;\n    ", 2), [[2, 4, ""]]);
    assert.deepEqual(enter("%macro m;\n%mend;\n  ", 2), [[2, 2, ""]]);
    assert.deepEqual(enter("proc sql;\n  select a\n  from b;\nquit;\n", 4), []);
  });

  it("returns no edit when the next line is already indented correctly", () => {
    assert.deepEqual(enter("data a;\n  ", 1), []);
  });

  it("returns no edit for empty or all-blank documents", () => {
    assert.deepEqual(enter("", 0), []);
    assert.deepEqual(enter("\n\n", 2), []);
  });

  it("skips blank lines when looking for the reference line", () => {
    assert.deepEqual(enter("data a;\n\n\n", 3), [[3, 0, "  "]]);
    assert.deepEqual(enter("data a;\n\n  x=1;\nrun;", 1), [[1, 0, "  "]]);
  });

  it("handles an Enter pressed past the last line", () => {
    assert.deepEqual(enter("data a;", 1), [[1, 0, "  "]]);
  });

  it("treats an unterminated statement as no indentation change", () => {
    assert.deepEqual(enter("data a\n", 1), []);
  });

  it("ignores comments when locating the previous statement", () => {
    assert.deepEqual(enter("data a;\n  /* c */\n", 2), [[2, 0, "  "]]);
  });

  it("builds tab/space indentation when tabs are in use", () => {
    assert.deepEqual(enter("data a;\n", 1, 4, false), [[1, 0, "\t"]]);
    assert.deepEqual(enter("data a;\n\tx=1;\n", 2, 4, false), [[2, 0, "\t"]]);
    // remainder smaller than a tab stop is padded with spaces
    assert.deepEqual(enter("data a;\n  x=1;\n", 2, 4, false), [[2, 0, "  "]]);
  });

  it("returns the next line to column 0 after PROC PYTHON submit/interactive", () => {
    assert.deepEqual(enter("proc python;\n  submit;\n    ", 2), [[2, 4, ""]]);
    assert.deepEqual(enter("proc python;\n  interactive;\n    ", 2), [
      [2, 4, ""],
    ]);
    assert.deepEqual(enter("proc python;\n  i;\n    ", 2), [[2, 4, ""]]);
    // other procs do not get the python treatment
    assert.deepEqual(enter("proc r;\n  submit;\n", 2), [[2, 0, "  "]]);
  });
});

describe("FormatOnTypeProvider semicolon-triggered indentation", () => {
  const semi = (content: string, line: number, tabSize?: number) =>
    getEdits(content, line, ";", tabSize);

  it("ignores unsupported trigger characters", () => {
    assert.deepEqual(getEdits("data a;", 0, "x"), []);
    assert.deepEqual(getEdits("data a;", 0, ")"), []);
  });

  it("returns no edit for empty or first-line input", () => {
    assert.deepEqual(semi("", 0), []);
    assert.deepEqual(semi("data a;", 0), []);
  });

  it("dedents RUN after a statement that is still open on the previous line", () => {
    assert.deepEqual(semi("data a;\n  x = 1\n    run;", 2), [[2, 4, "  "]]);
    assert.deepEqual(semi("data a;\n  set b;\n    run;", 2), [[2, 4, ""]]);
    assert.deepEqual(semi("data a;\n  x=1;\n    /* c */ run;", 2), [
      [2, 4, ""],
    ]);
  });

  it("dedents RUN when it follows an unterminated string", () => {
    assert.deepEqual(semi("data a;\n  x = 'abc\n    run;", 2), [[2, 4, "  "]]);
  });

  it("dedents %MEND, with or without a macro name", () => {
    assert.deepEqual(semi("%macro m;\n  %put x;\n      %mend;", 2), [
      [2, 6, ""],
    ]);
    assert.deepEqual(semi("%macro m;\n  %put x;\n      %mend m;", 2), [
      [2, 6, ""],
    ]);
    assert.deepEqual(
      semi("%macro m;\n  %if 1 %then %do;\n    x;\n  %end;\n      %mend;", 4),
      [[4, 6, ""]],
    );
  });

  it("leaves correctly indented statements alone", () => {
    assert.deepEqual(semi("data a;\n  set b;\nrun;", 1), []);
    assert.deepEqual(semi("data a;\n  set b;\nrun;", 2), []);
  });

  it("does not touch statements of a different block type", () => {
    assert.deepEqual(semi("data a;\n  proc sort;\nrun;", 1), []);
    assert.deepEqual(semi("proc sort;\n  set a;\nrun;", 1), []);
  });

  it("does not touch embedded python code", () => {
    assert.deepEqual(
      semi("proc python;\nsubmit;\nprint(1)\n    endsubmit;\nrun;", 3),
      [],
    );
  });

  it("respects tab settings for block statements", () => {
    assert.deepEqual(
      getEdits("proc sort data=a;\n      by x;\nrun;", 1, ";", 4, false),
      [],
    );
  });
});
