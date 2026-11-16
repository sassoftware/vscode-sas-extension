import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

const analyze = (source: string) => {
  const document = TextDocument.create("lexer-ex-test.sas", "sas", 1, source);
  const service = new LanguageServiceProvider(document);
  return {
    lines: source.split(/\r?\n/),
    symbols: service.getDocumentSymbols(),
    folding: service.getFoldingRanges(),
  };
};

const assertFolded = (
  folding: ReturnType<typeof analyze>["folding"],
  startLine: number,
  endLine: number,
) => {
  assert.isTrue(
    folding.some(
      (range) => range.startLine === startLine && range.endLine === endLine,
    ),
    `Expected a fold from line ${startLine} through line ${endLine}`,
  );
};

describe("LexerEx editor-visible section boundaries", () => {
  it("keeps PROC SQL, DS2, and FCMP scopes open through their own terminators", () => {
    const source = [
      "proc sql;",
      "  select 'run; proc fake;' as source_text from sashelp.class;",
      "quit;",
      "proc ds2;",
      "  data work.out / overwrite=yes;",
      "    method run();",
      "      set sashelp.class;",
      "    end;",
      "  enddata;",
      "run;",
      "quit;",
      "proc fcmp outlib=work.funcs.math;",
      "  function twice(x);",
      "    return(2*x);",
      "  endsub;",
      "run;",
    ].join("\n");
    const result = analyze(source);

    assert.deepEqual(
      result.symbols.map((symbol) => symbol.name),
      ["PROC SQL", "PROC DS2", "PROC FCMP"],
    );
    assert.deepEqual(
      result.symbols.map((symbol) => [
        symbol.range.start.line,
        symbol.range.end.line,
      ]),
      [
        [0, 2],
        [3, 10],
        [11, 15],
      ],
    );
    assertFolded(result.folding, 0, 2);
    assertFolded(result.folding, 3, 10);
    assertFolded(result.folding, 11, 15);
  });

  it("folds PROC PYTHON and PROC R around embedded code, not SAS-like text inside it", () => {
    const source = [
      "proc python;",
      "  submit;",
      '    sample = "data fake; proc fake; run;"',
      "  endsubmit;",
      "run;",
      "proc r;",
      "  submit;",
      "    sample <- 'data fake; proc fake; run;'",
      "  endsubmit;",
      "run;",
    ].join("\n");
    const result = analyze(source);

    assert.deepEqual(
      result.symbols.map((symbol) => symbol.name),
      ["PROC PYTHON", "PROC R"],
    );
    assert.deepEqual(
      result.symbols.map((symbol) => [
        symbol.range.start.line,
        symbol.range.end.line,
      ]),
      [
        [0, 4],
        [5, 9],
      ],
    );
    assertFolded(result.folding, 0, 4);
    assertFolded(result.folding, 5, 9);
  });

  it("preserves nested macro and DATA step hierarchy in document symbols", () => {
    const source = [
      "%macro outer;",
      "  %macro inner(ds=);",
      "    %if %length(&ds) %then %do;",
      "      data work.result;",
      "        set &ds;",
      "      run;",
      "    %end;",
      "  %mend inner;",
      "%mend outer;",
    ].join("\n");
    const result = analyze(source);
    const outer = result.symbols[0]!;
    const inner = outer.children?.[0];
    const dataStep = inner?.children?.[0];

    assert.equal(outer.name, "%MACRO outer");
    assert.deepEqual(
      outer.children?.map((symbol) => symbol.name),
      ["%MACRO inner"],
    );
    assert.deepEqual(
      inner?.children?.map((symbol) => symbol.name),
      ["DATA work.result"],
    );
    assert.isDefined(inner);
    assert.isDefined(dataStep);
    assert.deepEqual(
      [
        outer.range.start.line,
        outer.range.end.line,
        inner?.range.start.line,
        inner?.range.end.line,
        dataStep?.range.start.line,
        dataStep?.range.end.line,
      ],
      [0, 8, 1, 7, 3, 5],
    );
    assertFolded(result.folding, 0, 8);
    assertFolded(result.folding, 1, 7);
    assertFolded(result.folding, 3, 5);
  });

  it("keeps CARDS-family and PARMCARDS-family payloads out of section parsing", () => {
    const source = [
      "data work.card_rows;",
      "  input row $;",
      "  cards;",
      "PROC FAKE",
      "DATA FAKE",
      ";",
      "run;",
      "data work.text_rows;",
      "  input row $;",
      "  datalines;",
      "PROC FAKE",
      "DATA FAKE",
      ";",
      "run;",
      "proc explode;",
      "parmcards;",
      "PROC FAKE",
      ";",
      "run;",
      "proc explode;",
      "parmcards4;",
      "DATA FAKE",
      ";;;;",
      "run;",
      "data work.raw;",
      "  input row $;",
      "  datalines4;",
      "DATA FAKE",
      ";;;;",
      "run;",
    ].join("\n");
    const document = TextDocument.create(
      "lexer-ex-cards.sas",
      "sas",
      1,
      source,
    );
    const service = new LanguageServiceProvider(document);

    assert.deepEqual(
      service.getDocumentSymbols().map((symbol) => symbol.name),
      [
        "DATA work.card_rows",
        "DATA work.text_rows",
        "PROC EXPLODE",
        "PROC EXPLODE",
        "DATA work.raw",
      ],
    );
    assert.deepEqual(
      service
        .getFoldingRanges()
        .map((range) => [range.startLine, range.endLine]),
      [
        [0, 6],
        [7, 13],
        [14, 18],
        [19, 23],
        [24, 29],
      ],
    );

    const change = {
      text: "x",
      removedText: "",
      type: "textChanged",
      oldRange: {
        start: { line: 0, column: 0 },
        end: { line: 29, column: 4 },
      },
      newRange: {
        start: { line: 0, column: 0 },
        end: { line: 0, column: 1 },
      },
    };
    const parseRange = service.syntaxProvider.getParseRange(change);

    assert.equal(parseRange.removedBlocks.count, 5);
    assert.equal(parseRange.endLine, 29);
  });

  it("parses PROC TEMPLATE statgraph, tagset, and event blocks", () => {
    const source = [
      "proc template;",
      "define tagset tagsets.demo;",
      "  define event table_start;",
      '    put "<table>";',
      "  end;",
      '  default_event = "x";',
      "end;",
      "begingraph;",
      "  layout overlay;",
      '    entry "hello";',
      "  endlayout;",
      "endgraph;",
      "run;",
    ].join("\n");
    const result = analyze(source);

    assert.deepEqual(
      result.symbols.map((symbol) => symbol.name),
      ["PROC TEMPLATE"],
    );
    assert.deepEqual(
      result.symbols.map((symbol) => [
        symbol.range.start.line,
        symbol.range.end.line,
      ]),
      [[0, 12]],
    );
    assertFolded(result.folding, 0, 12);
  });

  it("recognizes special multiword statements in DATASETS and TRANSREG", () => {
    const lines = [
      "proc datasets library=work;",
      "ic create index=(name);",
      "quit;",
      "proc transreg;",
      "model identity(name)=identity(name);",
      "run;",
    ];
    const source = lines.join("\n");
    const document = TextDocument.create(
      "lexer-ex-special-proc.sas",
      "sas",
      1,
      source,
    );
    const service = new LanguageServiceProvider(document);

    assert.deepEqual(
      service.getDocumentSymbols().map((symbol) => symbol.name),
      ["PROC DATASETS", "PROC TRANSREG"],
    );
    assertFolded(service.getFoldingRanges(), 0, 2);
    assertFolded(service.getFoldingRanges(), 3, 5);

    const getTokenStyle = (line: number, text: string) => {
      const lineText = lines[line];
      const tokens = service.syntaxProvider.getSyntax(line);
      const tokenIndex = tokens.findIndex(
        (token, index) =>
          lineText
            .slice(token.start, tokens[index + 1]?.start ?? lineText.length)
            .trim() === text,
      );
      assert.isAtLeast(tokenIndex, 0, `Expected token ${text} on line ${line}`);
      return tokens[tokenIndex].style;
    };

    assert.equal(getTokenStyle(1, "ic"), "keyword");
    assert.equal(getTokenStyle(1, "create"), "keyword");
    assert.equal(getTokenStyle(4, "model"), "keyword");
  });

  it("promotes nested custom regions across DATA, PROC, and MACRO transitions", () => {
    const source = [
      "proc sort data=sashelp.class;",
      "  by name;",
      "  /* region outer */",
      "    /* region inner */",
      "    data work.nested;",
      "      set sashelp.class;",
      "    run;",
      "    /* endregion */",
      "  /* endregion */",
      "proc print data=work.nested;",
      "run;",
      "%macro helper;",
      "  %put ok;",
      "%mend helper;",
      "data work.after;",
      "  set work.nested;",
      "run;",
      "proc print data=work.after;",
      "run;",
    ].join("\n");
    const result = analyze(source);
    const outerRegion = result.symbols[1];
    const innerRegion = outerRegion.children?.[0];

    assert.deepEqual(
      result.symbols.map((symbol) => symbol.name),
      [
        "PROC SORT",
        "/* REGION OUTER */",
        "PROC PRINT",
        "%MACRO helper",
        "DATA work.after",
        "PROC PRINT",
      ],
    );
    assert.deepEqual(
      outerRegion.children?.map((symbol) => symbol.name),
      ["/* REGION INNER */"],
    );
    assert.deepEqual(
      innerRegion?.children?.map((symbol) => symbol.name),
      ["DATA work.nested"],
    );
    assert.deepEqual(
      result.folding.map((range) => [
        range.startLine,
        range.endLine,
        range.kind,
      ]),
      [
        [0, 1, undefined],
        [2, 8, "region"],
        [3, 7, "region"],
        [4, 6, undefined],
        [9, 10, undefined],
        [11, 13, undefined],
        [14, 16, undefined],
        [17, 18, undefined],
      ],
    );
  });

  it("does not create sections from block comments or quoted SAS literals", () => {
    const source = [
      "/* Header comment containing PROC FAKE;",
      "   DATA fake; RUN; */",
      "data work.values;",
      '  message = "escaped quote: ""; PROC fake; DATA fake; RUN;";',
      "  day = '21OCT2026'd;",
      "  clock = '09:30't;",
      "  stamp = '21OCT2026:09:30:00'dt;",
      "  'odd name'n = 'PROC fake; RUN;';",
      "run;",
    ].join("\n");
    const result = analyze(source);

    assert.deepEqual(
      result.symbols.map((symbol) => symbol.name),
      ["DATA work.values"],
    );
    assertFolded(result.folding, 2, 8);
    assert.isTrue(
      result.folding.some(
        (range) =>
          range.kind === "comment" &&
          range.startLine === 0 &&
          range.endLine === 1,
      ),
    );
  });

  it("extends an unfinished DATA block to the document end", () => {
    const source = "data work.pending;\n  x = 1;";
    const result = analyze(source);

    assert.deepEqual(
      result.symbols.map((symbol) => symbol.name),
      ["DATA work.pending"],
    );
    assert.deepEqual(
      [result.symbols[0].range.start.line, result.symbols[0].range.end.line],
      [0, 1],
    );
    assertFolded(result.folding, 0, 1);
  });
});
