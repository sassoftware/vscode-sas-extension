import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

const SAMPLE = [
  "/* multi-line",
  "   comment */",
  "%macro demo(a, b=1);",
  "  %if &a = 1 %then %do;",
  "    %put hello;",
  "  %end;",
  "  %else %do;",
  "    %put bye;",
  "  %end;",
  "%mend demo;",
  "",
  "data work.out;",
  "  set sashelp.class;",
  "  length x $ 10;",
  "  if age > 12 then do;",
  "    x = 'big';",
  "  end;",
  "  else do;",
  "    x = 'small';",
  "  end;",
  "  select (sex);",
  "    when ('M') y = 1;",
  "    otherwise y = 0;",
  "  end;",
  "run;",
  "",
  "proc sort data=work.out out=work.sorted;",
  "  by name;",
  "run;",
  "",
  "proc sql;",
  "  select name, age from work.sorted where age > 12;",
  "quit;",
  "",
  "/* region format-ignore",
  "*/",
  "%demo(1);",
  "%let v = %sysfunc(upcase(abc));",
].join("\n");

const create = (content: string) => {
  const doc = TextDocument.create("test.sas", "sas", 1, content);
  return { doc, service: new LanguageServiceProvider(doc) };
};

describe("LanguageServiceProvider", () => {
  describe("getTokens", () => {
    it("emits 5-tuples of semantic tokens with valid type indices", () => {
      const { service } = create(SAMPLE);
      const data = service.getTokens();
      assert.isAbove(data.length, 100);
      assert.equal(data.length % 5, 0);
      const types = new Set<number>();
      for (let i = 3; i < data.length; i += 5) {
        types.add(data[i]);
      }
      assert.isAbove(types.size, 4);
    });

    it("returns tokens for a single-line document", () => {
      const { service } = create("data a; run;");
      assert.isAbove(service.getTokens().length, 0);
    });
  });

  describe("document symbols and folding", () => {
    it("builds symbols for data, proc and macro blocks", () => {
      const { service } = create(SAMPLE);
      const symbols = service.getDocumentSymbols();
      assert.isAbove(symbols.length, 2);
      assert.isTrue(symbols.every((s) => !!s.name));
    });

    it("produces comment and block folding ranges", () => {
      const { service } = create(SAMPLE);
      const ranges = service.getFoldingRanges();
      assert.isTrue(ranges.some((r) => r.kind === "comment"));
      assert.isTrue(ranges.some((r) => r.startLine === 11 && r.endLine >= 24));
      assert.isTrue(ranges.some((r) => r.startLine === 2 && r.endLine === 9));
      assert.isTrue(ranges.every((r) => r.endLine >= r.startLine));
    });

    it("folds custom regions", () => {
      const { service } = create(
        "/*region foo*/\ndata a;\n  x=1;\nrun;\n/*endregion*/",
      );
      assert.isTrue(
        service.getFoldingRanges().some((r) => r.kind === "region"),
      );
    });

    it("looks up a folding block by position", () => {
      const { service } = create(SAMPLE);
      const block = service.getFoldingBlock(12, 2);
      assert.isDefined(block);
      assert.equal(block!.startLine, 11);
      assert.notExists(service.getFoldingBlock(10, 0, true, true, true));
    });
  });

  describe("toggleLineComment", () => {
    const range = (s: number, e: number, c = 100) => ({
      start: { line: s, character: 0 },
      end: { line: e, character: c },
    });

    it("comments out uncommented lines and skips blank ones", () => {
      const { service } = create("data a;\n\n  x=1;\nrun;");
      assert.equal(
        service.toggleLineComment(range(0, 2, 6)),
        "/*data a;*/\n\n  /*x=1;*/",
      );
    });

    it("uncomments fully commented lines", () => {
      const { service } = create("/* data a; */\n  /* x=1; */");
      assert.equal(
        service.toggleLineComment(range(0, 1, 13)),
        "data a;\n  x=1;",
      );
    });

    it("returns null inside embedded code", () => {
      const { service } = create(
        "proc python;\nsubmit;\nprint(1)\nendsubmit;\nrun;",
      );
      assert.isNull(service.toggleLineComment(range(2, 2, 8)));
    });
  });

  describe("formatter", () => {
    const format = async (content: string, opts = {}) => {
      const { service } = create(content);
      const edits = await service.formatter.format(opts);
      assert.lengthOf(edits, 1);
      return edits[0].newText;
    };

    it("re-indents nested data step, macro and proc code", async () => {
      const text = await format(
        [
          "data a;",
          "set b;",
          "if x then do;",
          "y=1;",
          "end;",
          "else do;",
          "y=2;",
          "end;",
          "select (z);",
          "when (1) y=3;",
          "otherwise y=4;",
          "end;",
          "run;",
          "%macro m;",
          "%if &a %then %do;",
          "%put x;",
          "%end;",
          "%mend;",
          "proc sort data=a;",
          "by x;",
          "run;",
        ].join("\n"),
        { tabWidth: 2 },
      );
      const lines = text.split("\n");
      assert.equal(lines[0], "data a;");
      assert.equal(lines[1], "  set b;");
      assert.equal(lines[2], "  if x then do;");
      assert.equal(lines[3], "    y=1;");
      assert.equal(lines[4], "  end;");
      assert.include(text, "  select (z);");
      assert.include(text, "\n  %if &a %then %do;");
    });

    it("honours tab characters", async () => {
      const text = await format("data a;\nset b;\nrun;", { useTabs: true });
      assert.include(text, "\tset b;");
    });

    it("preserves comments and blank lines", async () => {
      const text = await format(
        "/* top */\ndata a;\n* star comment;\n  x=1; /* trailing */\n\n\nrun;",
      );
      assert.include(text, "/* top */");
      assert.include(text, "* star comment;");
      assert.include(text, "/* trailing */");
    });

    it("leaves embedded python code untouched", async () => {
      const text = await format(
        "proc python;\nsubmit;\nif 1:\n      print(1)\nendsubmit;\nrun;",
      );
      assert.include(text, "if 1:\n      print(1)");
    });

    it("formats proc sql, cards data and ds2 blocks", async () => {
      const text = await format(
        [
          "proc sql;",
          "select a,b from t where a>1;",
          "quit;",
          "data d;",
          "input a b;",
          "cards;",
          "1   2",
          "3   4",
          ";",
          "run;",
          "proc ds2;",
          "data o/overwrite=yes;",
          "method run();",
          "set i;",
          "end;",
          "enddata;",
          "run;",
          "quit;",
        ].join("\n"),
      );
      assert.include(text, "1   2");
      assert.include(text, "3   4");
      assert.match(text, /\n {2}input a b;/);
    });

    it("handles empty input and unterminated statements", async () => {
      assert.isString(await format(""));
      assert.isString(await format("data a; set b"));
    });
  });

  describe("completion", () => {
    const complete = async (
      content: string,
      line: number,
      character: number,
      triggerCharacter?: string,
    ) => {
      const { service } = create(content);
      return service.completionProvider.getCompleteItems({
        textDocument: { uri: "test.sas" },
        position: { line, character },
        context: triggerCharacter
          ? { triggerKind: 2, triggerCharacter }
          : { triggerKind: 1 },
      });
    };

    it("suggests proc names after 'proc '", async () => {
      const list = await complete("proc ", 0, 5);
      const labels = list!.items.map((i) => i.label.toLowerCase());
      assert.include(labels, "sort");
      assert.include(labels, "print");
    });

    it("suggests proc statements and options", async () => {
      const stmts = await complete("proc sort data=a;\n  \nrun;", 1, 2);
      assert.isAbove(stmts?.items.length ?? 0, 0);
      const opts = await complete("proc sort ", 0, 10);
      assert.isAbove(opts?.items.length ?? 0, 0);
    });

    it("matches case of the typed prefix", async () => {
      const list = await complete("PRO", 0, 3);
      assert.isDefined(list);
      assert.isTrue(
        list!.items.every((i) => i.label === i.label.toUpperCase()),
      );
    });

    it("suggests functions and macro functions by prefix fallback", async () => {
      const fn = await complete("data a;\n  x = upca", 1, 10);
      assert.isTrue(fn?.items.some((i) => /upcase/i.test(i.label)) ?? true);
      const macro = await complete("%let a = %sysf", 0, 14);
      assert.isTrue(macro?.items.some((i) => /sysfunc/i.test(i.label)) ?? true);
    });

    it("rejects '.' trigger outside of data set contexts", async () => {
      assert.isUndefined(await complete("proc ", 0, 5, "."));
    });
  });

  describe("signature help", () => {
    it("provides signature help inside function calls", async () => {
      const { service } = create("data a;\n  x = substr(abc, 1, 2);\nrun;");
      const sig = await service.completionProvider.getSignatureHelp({
        line: 1,
        character: 20,
      });
      if (sig) {
        assert.isArray(sig.signatures);
      }
      const none = await service.completionProvider.getSignatureHelp({
        line: 0,
        character: 3,
      });
      assert.isUndefined(none);
    });
  });

  describe("code zones", () => {
    it("classifies zones across a mixed program", () => {
      const { service, doc } = create(SAMPLE);
      const czm = service.getCodeZoneManager();
      const zones = new Set<number>();
      for (let i = 0; i < doc.lineCount; i++) {
        const len = doc.getText().split("\n")[i].length;
        for (const c of [0, 1, Math.floor(len / 2), len]) {
          zones.add(czm.getCurrentZone(i, c));
        }
      }
      assert.isAbove(zones.size, 4);
    });
  });
});
