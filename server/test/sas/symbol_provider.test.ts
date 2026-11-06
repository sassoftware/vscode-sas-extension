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

  it("recognizes quoted macro variable names in CALL SYMPUT variants", () => {
    const { document, provider } = createProvider(
      "call symput('singleName', 'value');\ncall symputx(\"doubleName\", \"value\");\n%put &SINGLENAME &DOUBLENAME;",
    );

    const singleNameReferences = provider.getReferences(
      document.uri,
      { line: 0, character: 18 },
      true,
    );
    const doubleNameReferences = provider.getReferences(
      document.uri,
      { line: 1, character: 19 },
      true,
    );

    assert.deepEqual(
      singleNameReferences.map((reference) => reference.range.start.line),
      [0, 2],
    );
    assert.deepEqual(
      doubleNameReferences.map((reference) => reference.range.start.line),
      [1, 2],
    );
  });

  it("finds macro variable names passed literally to SYMGET and SYMEXIST", () => {
    const { document, provider } = createProvider(
      '%let myMacroVar=abc123;\nvalue1 = symget(\'myMacroVar\');\nvalue2 = symget("&myMacroVar");\nvalue3 = symget(&myMacroVar);\nexists = symexist("myMacroVar");',
    );

    const references = provider.getReferences(
      document.uri,
      { line: 0, character: 7 },
      true,
    );
    const edit = provider.rename(
      document.uri,
      { line: 1, character: 19 },
      "renamedMacroVar",
    );

    assert.deepEqual(
      references.map((reference) => reference.range.start.line),
      [0, 1, 2, 3, 4],
    );
    assert.deepEqual(
      edit?.changes?.[document.uri]?.map((item) => item.range.start.line),
      [0, 1, 2, 3, 4],
    );
  });

  it("finds macro variables referenced by macro statements and functions", () => {
    const { document, provider } = createProvider(
      "%let deletedFlag=1;\n%let checkedFlag=1;\n%let localFlag=1;\n%macro macroReferences;\n  %symdel deletedFlag;\n  %sysexist(checkedFlag);\n  %symglobal(checkedFlag);\n  %symlocal(localFlag);\n%mend macroReferences;\n%put &deletedFlag &checkedFlag &localFlag;",
    );

    const deletedReferences = provider.getReferences(
      document.uri,
      { line: 0, character: 7 },
      true,
    );
    const checkedReferences = provider.getReferences(
      document.uri,
      { line: 1, character: 7 },
      true,
    );
    const localReferences = provider.getReferences(
      document.uri,
      { line: 2, character: 7 },
      true,
    );
    const rename = provider.rename(
      document.uri,
      { line: 4, character: 12 },
      "removedFlag",
    );

    assert.deepEqual(
      deletedReferences.map((reference) => reference.range.start.line),
      [0, 4, 9],
    );
    assert.deepEqual(
      checkedReferences.map((reference) => reference.range.start.line),
      [1, 5, 6, 9],
    );
    assert.deepEqual(
      localReferences.map((reference) => reference.range.start.line),
      [2, 7, 9],
    );
    assert.deepEqual(
      rename?.changes?.[document.uri]?.map((edit) => edit.range.start.line),
      [0, 4, 9],
    );
  });

  it("recognizes macro-variable targets in SYSLPUT and SYSRPUT", () => {
    const { document, provider } = createProvider(
      "%syslput pushedFlag=value;\n%sysrput returnedFlag=value;",
    );

    const syslputReferences = provider.getReferences(
      document.uri,
      { line: 0, character: 10 },
      true,
    );
    const sysrputReferences = provider.getReferences(
      document.uri,
      { line: 1, character: 10 },
      true,
    );

    assert.deepEqual(
      syslputReferences.map((reference) => reference.range.start.line),
      [0],
    );
    assert.deepEqual(
      sysrputReferences.map((reference) => reference.range.start.line),
      [1],
    );
  });

  it("finds macro program names in macro deletion and query functions", () => {
    const { document, provider } = createProvider(
      "%macro cleanupMacro;\n%mend cleanupMacro;\n%sysmacdelete cleanupMacro;\n%sysmacexec(cleanupMacro);\n%sysmacexist(cleanupMacro);",
    );

    const references = provider.getReferences(
      document.uri,
      { line: 0, character: 8 },
      true,
    );
    const rename = provider.rename(
      document.uri,
      { line: 2, character: 16 },
      "removeMacro",
    );

    assert.deepEqual(
      references.map((reference) => reference.range.start.line),
      [0, 1, 2, 3, 4],
    );
    assert.deepEqual(
      rename?.changes?.[document.uri]?.map((edit) => edit.range.start.line),
      [0, 1, 2, 3, 4],
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

  it("keeps positional and keyword macro parameters local to their macros", () => {
    const { document, provider } = createProvider(
      "%let dsname=sashelp.cars;\n%let varname=model;\n%macro mymacro1(dsname);\nproc print data=&dsname;\nrun;\n%mend mymacro1;\n%macro mymacro2(dsname=, varname=);\nproc print data=&dsname;\n  var &varname;\nrun;\n%mend;\n%mymacro1(sashelp.class);\n%mymacro2(varname=name height weight, dsname=sashelp.class);\n%let dsname=sashelp.fitness;\n%mymacro2(varname=name);",
    );

    const globalDatasetReferences = provider.getReferences(
      document.uri,
      { line: 0, character: 7 },
      true,
    );
    const positionalParameterReferences = provider.getReferences(
      document.uri,
      { line: 2, character: 17 },
      true,
    );
    const keywordDatasetParameterReferences = provider.getReferences(
      document.uri,
      { line: 6, character: 22 },
      true,
    );
    const keywordVariableParameterReferences = provider.getReferences(
      document.uri,
      { line: 6, character: 31 },
      true,
    );
    const positionalParameterRename = provider.rename(
      document.uri,
      { line: 2, character: 17 },
      "macroDataSet1",
    );
    const globalDatasetRename = provider.rename(
      document.uri,
      { line: 0, character: 7 },
      "globalDataSet",
    );
    const keywordDatasetRename = provider.rename(
      document.uri,
      { line: 6, character: 22 },
      "macroDataSet",
    );
    const keywordVariableRename = provider.rename(
      document.uri,
      { line: 6, character: 31 },
      "macroVariable",
    );

    assert.deepEqual(
      globalDatasetReferences.map((reference) => reference.range.start.line),
      [0, 13],
    );
    assert.deepEqual(
      positionalParameterReferences.map(
        (reference) => reference.range.start.line,
      ),
      [2, 3],
    );
    assert.deepEqual(
      keywordDatasetParameterReferences.map(
        (reference) => reference.range.start.line,
      ),
      [6, 7],
    );
    assert.deepEqual(
      keywordVariableParameterReferences.map(
        (reference) => reference.range.start.line,
      ),
      [6, 8],
    );
    assert.deepEqual(
      globalDatasetRename?.changes?.[document.uri]?.map(
        (edit) => edit.range.start.line,
      ),
      [0, 13],
    );
    assert.deepEqual(
      positionalParameterRename?.changes?.[document.uri]?.map(
        (edit) => edit.range.start.line,
      ),
      [2, 3],
    );
    assert.deepEqual(
      keywordDatasetRename?.changes?.[document.uri]?.map(
        (edit) => edit.range.start.line,
      ),
      [6, 7],
    );
    assert.deepEqual(
      keywordVariableRename?.changes?.[document.uri]?.map(
        (edit) => edit.range.start.line,
      ),
      [6, 8],
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

  it("keeps datasets with the same member name in different libraries separate", () => {
    const { document, provider } = createProvider(
      "data work.sales;\nrun;\ndata prod.sales;\nrun;\nproc print data=work.sales;\nrun;\nproc print data=prod.sales;\nrun;",
    );

    const workReferences = provider.getReferences(
      document.uri,
      { line: 0, character: 12 },
      true,
    );
    const prodEdit = provider.rename(
      document.uri,
      { line: 2, character: 12 },
      "orders",
    );

    assert.deepEqual(
      workReferences.map((location) => location.range.start.line),
      [0, 4],
    );
    assert.deepEqual(
      prodEdit?.changes?.[document.uri]?.map((edit) => edit.range.start.line),
      [2, 6],
    );
    assert.isUndefined(provider.prepareRename({ line: 0, character: 6 }));
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

  it("does not treat SAS keywords or function calls as variables", () => {
    const { document, provider } = createProvider(
      "data example;\n  if value > 0 then result = sum(value, 1);\n  sum = 2;\n  result = sum + 1;\nrun;",
    );

    const sumReferences = provider.getReferences(
      document.uri,
      { line: 2, character: 3 },
      true,
    );
    const sumEdit = provider.rename(
      document.uri,
      { line: 2, character: 3 },
      "total",
    );

    assert.isUndefined(provider.prepareRename({ line: 1, character: 3 }));
    assert.isUndefined(provider.prepareRename({ line: 1, character: 39 }));
    assert.deepEqual(
      sumReferences.map((location) => location.range.start.line),
      [2, 3],
    );
    assert.deepEqual(
      sumEdit?.changes?.[document.uri]?.map((edit) => edit.range.start.line),
      [2, 3],
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
