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
