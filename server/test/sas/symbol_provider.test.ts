import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

const createProvider = (content: string) => {
  const document = TextDocument.create(
    "file:///symbols.sas",
    "sas",
    1,
    content,
  );
  return {
    document,
    provider: new LanguageServiceProvider(document).symbolProvider,
  };
};

describe("SAS symbol provider", () => {
  it("finds and renames macro variables referenced inside strings", () => {
    const { document, provider } = createProvider(
      '%let banana=yellow;\ndata fruit;\n  apple = "&banana";\nrun;',
    );

    const references = provider.getReferences(
      document.uri,
      { line: 0, character: 6 },
      true,
    );
    const edit = provider.rename(
      document.uri,
      { line: 2, character: 13 },
      "plantain",
    );

    assert.deepEqual(
      references.map((reference) => reference.range.start.line),
      [0, 2],
    );
    assert.deepEqual(
      edit?.changes?.[document.uri]?.map((item) => item.newText),
      ["plantain", "plantain"],
    );
  });

  it("finds macro variables in double-quoted strings and preserves suffixes", () => {
    const { document, provider } = createProvider(
      "%let banana=yellow;\nvalue = \"&BANANA.\";\nsingle = '&banana';\n&banana2;",
    );

    const references = provider.getReferences(
      document.uri,
      { line: 0, character: 6 },
      true,
    );
    const edit = provider.rename(
      document.uri,
      { line: 1, character: 12 },
      "plantain",
    );

    assert.deepEqual(
      references.map((reference) => reference.range.start.line),
      [0, 1],
    );
    assert.deepEqual(
      edit?.changes?.[document.uri]?.map((item) => item.range.end.character),
      [11, 16],
    );
  });

  it("finds macro variables declared by CALL SYMPUT variants", () => {
    const { document, provider } = createProvider(
      'call symputx("colour", "blue");\n%put &colour;',
    );

    const references = provider.getReferences(
      document.uri,
      { line: 0, character: 15 },
      true,
    );

    assert.deepEqual(
      references.map((reference) => reference.range.start.line),
      [0, 1],
    );
  });

  it("separates global and local macro variables with the same name", () => {
    const { document, provider } = createProvider(
      "%global scopeFlag;\n%let scopeFlag=GLOBAL;\n%macro firstScope;\n  %local scopeFlag;\n  %let scopeFlag=FIRST;\n  %put first=&scopeFlag;\n%mend firstScope;\n%macro secondScope;\n  %local scopeFlag;\n  %let scopeFlag=SECOND;\n  %put second=&scopeFlag;\n%mend secondScope;\n%macro readsGlobal;\n  %put inherited=&scopeFlag;\n%mend readsGlobal;\n%put outside=&scopeFlag;",
    );

    const globalReferences = provider.getReferences(
      document.uri,
      { line: 1, character: 8 },
      true,
    );
    const firstLocalReferences = provider.getReferences(
      document.uri,
      { line: 3, character: 11 },
      true,
    );
    const firstLocalEdit = provider.rename(
      document.uri,
      { line: 3, character: 11 },
      "firstFlag",
    );
    const secondLocalEdit = provider.rename(
      document.uri,
      { line: 8, character: 11 },
      "secondFlag",
    );

    assert.deepEqual(
      globalReferences.map((reference) => reference.range.start.line),
      [0, 1, 13, 15],
    );
    assert.deepEqual(
      firstLocalReferences.map((reference) => reference.range.start.line),
      [3, 4, 5],
    );
    assert.deepEqual(
      firstLocalEdit?.changes?.[document.uri]?.map(
        (edit) => edit.range.start.line,
      ),
      [3, 4, 5],
    );
    assert.deepEqual(
      secondLocalEdit?.changes?.[document.uri]?.map(
        (edit) => edit.range.start.line,
      ),
      [8, 9, 10],
    );
  });

  it("treats a macro %LET as local when no global variable exists", () => {
    const { document, provider } = createProvider(
      "%macro localByLet;\n  %let generatedFlag=LOCAL;\n  %put &generatedFlag;\n%mend localByLet;\n%put &generatedFlag;",
    );

    const localReferences = provider.getReferences(
      document.uri,
      { line: 1, character: 8 },
      true,
    );

    assert.deepEqual(
      localReferences.map((reference) => reference.range.start.line),
      [1, 2],
    );
  });

  it("renames macro parameters together with their references", () => {
    const { document, provider } = createProvider(
      "%macro parameterScope(paramFlag);\n  %put parameter=&paramFlag;\n%mend parameterScope;\n%parameterScope(VALUE);",
    );

    const references = provider.getReferences(
      document.uri,
      { line: 0, character: 23 },
      true,
    );
    const edit = provider.rename(
      document.uri,
      { line: 1, character: 20 },
      "inputFlag",
    );

    assert.deepEqual(
      references.map((reference) => reference.range.start.line),
      [0, 1],
    );
    assert.deepEqual(
      edit?.changes?.[document.uri]?.map((item) => item.newText),
      ["inputFlag", "inputFlag"],
    );
  });

  it("finds macro program definitions and invocations", () => {
    const { document, provider } = createProvider(
      "%macro report;\n%mend report;\n%report;",
    );

    const references = provider.getReferences(
      document.uri,
      { line: 2, character: 2 },
      true,
    );

    assert.deepEqual(
      references.map((location) => location.range.start.line),
      [0, 1, 2],
    );
  });

  it("finds dataset names in DATA and PROC options", () => {
    const { document, provider } = createProvider(
      "data work.fruit;\nrun;\nproc print data=work.fruit;\nrun;",
    );

    const references = provider.getReferences(
      document.uri,
      { line: 0, character: 12 },
      true,
    );

    assert.deepEqual(
      references.map((location) => location.range.start.line),
      [0, 2],
    );
  });

  it("finds datasets in SET, MERGE, and APPEND BASE contexts", () => {
    const { document, provider } = createProvider(
      "data work.sales;\nrun;\ndata work.copy;\n  set work.sales;\n  merge work.sales;\nrun;\nproc append base=work.sales data=work.copy;\nrun;",
    );

    const references = provider.getReferences(
      document.uri,
      { line: 0, character: 12 },
      true,
    );

    assert.deepEqual(
      references.map((location) => location.range.start.line),
      [0, 3, 4, 6],
    );
  });

  it("finds and renames ordinary DATA step variables", () => {
    const { document, provider } = createProvider(
      'data example;\n  amount = 1;\n  total = amount * 2;\n  label = "amount";\nrun;',
    );

    const references = provider.getReferences(
      document.uri,
      { line: 1, character: 3 },
      true,
    );
    const edit = provider.rename(
      document.uri,
      { line: 1, character: 3 },
      "sales_amount",
    );

    assert.deepEqual(
      references.map((reference) => reference.range.start.line),
      [1, 2],
    );
    assert.deepEqual(
      edit?.changes?.[document.uri]?.map((item) => item.newText),
      ["sales_amount", "sales_amount"],
    );
  });

  it("scopes ordinary variables to the enclosing DATA step", () => {
    const { document, provider } = createProvider(
      "data a;\n  testVar = 1;\n  result = testVar + 1;\nrun;\ndata b;\n  testVar = 2;\n  result = testVar + 2;\nrun;",
    );

    const references = provider.getReferences(
      document.uri,
      { line: 1, character: 3 },
      true,
    );
    const edit = provider.rename(
      document.uri,
      { line: 2, character: 12 },
      "firstTestVar",
    );

    assert.deepEqual(
      references.map((reference) => reference.range.start.line),
      [1, 2],
    );
    assert.deepEqual(
      edit?.changes?.[document.uri]?.map((item) => item.range.start.line),
      [1, 2],
    );
  });

  it("excludes macro declarations in comments from rename edits", () => {
    const { document, provider } = createProvider(
      "%macro report;\n%mend report;\n/* %macro report; %mend report; */\n%report;",
    );

    const edit = provider.rename(
      document.uri,
      { line: 3, character: 2 },
      "summary",
    );

    assert.deepEqual(
      edit?.changes?.[document.uri]?.map((item) => item.range.start.line),
      [0, 1, 3],
    );
  });

  it("excludes macro variable declarations in comments from rename edits", () => {
    const { document, provider } = createProvider(
      "%let banana=yellow;\n/* %let banana=comment; */\n%* %let banana=comment;\n%put &banana;",
    );

    const edit = provider.rename(
      document.uri,
      { line: 3, character: 6 },
      "plantain",
    );

    assert.deepEqual(
      edit?.changes?.[document.uri]?.map((item) => item.range.start.line),
      [0, 3],
    );
  });

  it("rejects invalid rename names and omits declarations when requested", () => {
    const { document, provider } = createProvider(
      '%let banana=yellow;\nvalue = "&banana";',
    );

    const references = provider.getReferences(
      document.uri,
      { line: 0, character: 6 },
      false,
    );

    assert.deepEqual(
      references.map((reference) => reference.range.start.line),
      [1],
    );
    assert.isUndefined(
      provider.rename(document.uri, { line: 0, character: 6 }, "bad name"),
    );
  });

  it("does not rename identifiers inside comments", () => {
    const { provider } = createProvider("data fruit;\n* fruit;\nrun;");

    assert.isUndefined(provider.prepareRename({ line: 1, character: 3 }));
  });
});
