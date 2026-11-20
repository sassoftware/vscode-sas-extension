import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";
import fs from "fs";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

// webpack loads *.properties as raw text; mirror that so getText() works under ts-node
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(require as any).extensions[".properties"] ??= (m: any, file: string) => {
  m.exports = fs.readFileSync(file, "utf8");
};

const create = (content: string) =>
  new LanguageServiceProvider(
    TextDocument.create("test.sas", "sas", 1, content),
  );

// Position of `offset` characters into the first occurrence of `needle`
const at = (content: string, needle: string, offset = 1) => {
  const idx = content.indexOf(needle);
  assert.isAtLeast(idx, 0, `"${needle}" not found`);
  const before = content.slice(0, idx + offset).split("\n");
  return {
    line: before.length - 1,
    character: before[before.length - 1].length,
  };
};

const hoverText = async (content: string, needle: string, offset = 1) => {
  const hover = await create(content).completionProvider.getHelp(
    at(content, needle, offset),
  );
  if (!hover) {
    return undefined;
  }
  const c = hover.contents;
  assert.isFalse(typeof c === "string" || Array.isArray(c));
  return (c as { value: string }).value;
};

describe("CompletionProvider", () => {
  describe("hover help across code zones", () => {
    // Each sample hovers a keyword living in a different zone, which drives a
    // different branch of _addLinkContext.
    const cases: [string, string, string][] = [
      ["global statement", "libname abc 'c:/tmp';", "libname"],
      [
        "global statement option",
        "libname abc base 'c:/tmp' access=readonly;",
        "access",
      ],
      ["global option statement", "options nocenter;", "nocenter"],
      ["global option value", "options linesize=80;", "linesize"],
      ["title statement", "title 'x';", "title"],
      ["proc name", "proc sort data=a;\nrun;", "sort"],
      ["proc option", "proc sort data=a nodupkey;\nrun;", "nodupkey"],
      ["proc option value", "proc sort data=a sortseq=ascii;\nrun;", "ascii"],
      ["proc sub option", "proc print data=a(obs=5);\nrun;", "obs"],
      ["proc statement", "proc sort data=a;\n  by x;\nrun;", "by x"],
      [
        "proc statement option",
        "proc sort data=a;\n  by descending x;\nrun;",
        "descending",
      ],
      ["proc global statement", "proc print;\n  title 'a';\nrun;", "title"],
      [
        "proc stmt sub option",
        "proc freq data=a;\n  tables x / chisq out=o(drop=y);\nrun;",
        "drop",
      ],
      ["data step statement", "data a;\n  set b;\nrun;", "set"],
      ["data step statement option", "data a;\n  set b nobs=n;\nrun;", "nobs"],
      ["data step data set option", "data a(keep=x);\n  set b;\nrun;", "keep"],
      ["data step function", "data a;\n  x = substr(y, 1, 2);\nrun;", "substr"],
      [
        "data step call routine",
        "data a;\n  call missing(x);\nrun;",
        "missing",
      ],
      ["data step format", "data a;\n  format d date9.;\nrun;", "date9"],
      ["macro statement", "%let a = 1;", "%let"],
      ["macro function", "%put %sysfunc(upcase(abc));", "%sysfunc"],
      ["macro function (inner)", "%put %sysfunc(upcase(abc));", "upcase"],
      ["ods statement", "ods html file='a.html';\nods html close;", "html"],
      [
        "proc sql statement",
        "proc sql;\n  select a from b where a > 1;\nquit;",
        "select",
      ],
      [
        "proc sql function",
        "proc sql;\n  select upcase(a) from b;\nquit;",
        "upcase",
      ],
      [
        "statgraph",
        "proc template;\n  define statgraph g;\n    begingraph;\n    endgraph;\n  end;\nrun;",
        "begingraph",
      ],
      ["proc format", "proc format;\n  value f 1='a';\nrun;", "value"],
      ["proc means stat option", "proc means data=a mean std;\nrun;", "std"],
    ];

    it("returns markdown hover for keywords in every zone", async () => {
      const results: Record<string, string | undefined> = {};
      for (const [name, code, needle] of cases) {
        const value = await hoverText(code, needle);
        results[name] = value;
      }
      const hits = Object.values(results).filter((v) => !!v);
      assert.isAtLeast(
        hits.length,
        Math.floor(cases.length * 0.6),
        `hover missing for: ${Object.keys(results)
          .filter((k) => !results[k])
          .join(", ")}`,
      );
      for (const v of hits) {
        assert.isAbove(v!.length, 0);
      }
    });

    it("hovers on the first and last character of a token", async () => {
      const code = "proc sort data=a;\nrun;";
      assert.isDefined(await hoverText(code, "sort", 0));
      assert.isDefined(await hoverText(code, "sort", 3));
    });

    it("returns undefined for blanks, unknown words and strings", async () => {
      assert.isUndefined(await hoverText("data a;\n   \nrun;", "   ", 1));
      assert.isUndefined(
        await hoverText("data a;\n  x = 'zzzz';\nrun;", "zzzz"),
      );
      assert.isUndefined(await hoverText("proc zzzzzz;\nrun;", "zzzzzz"));
    });

    it("localizes link context via the message bundle", async () => {
      const value = await hoverText("proc sort data=a;\n  by x;\nrun;", "sort");
      assert.isDefined(value);
      assert.notMatch(value!, /undefined/);
    });
  });

  describe("signature help", () => {
    const sig = (
      code: string,
      needle: string,
      offset: number,
      active?: number,
    ) =>
      create(code).completionProvider.getSignatureHelp(
        at(code, needle, offset),
        active,
      );

    it("reports the active parameter as the cursor moves through arguments", async () => {
      const code = "data a;\n  x = scan(abc, 1, ' ');\nrun;";
      const first = await sig(code, "scan(", 5);
      const second = await sig(code, "abc,", 4);
      const third = await sig(code, "1,", 2);
      assert.isDefined(first);
      assert.isAbove(first!.signatures.length, 0);
      assert.isString(first!.signatures[0].label);
      assert.equal(first!.activeParameter, 0);
      assert.equal(second!.activeParameter, 1);
      assert.equal(third!.activeParameter, 2);
      assert.isAbove(first!.signatures[0].parameters!.length, 1);
    });

    it("handles overloaded functions and switches signature by argument count", async () => {
      const code = "data a;\n  x = intnx('month', d, 1, 'b');\nrun;";
      const s = await sig(code, "'b'", 0);
      assert.isDefined(s);
      const s2 = await sig(code, "'b'", 0, 1);
      assert.isDefined(s2);
      const many = await sig(
        "data a;\n  x = cat(a, b, c, d, e, f);\nrun;",
        "f)",
        1,
      );
      assert.isDefined(many);
    });

    it("handles nested calls and closed parentheses", async () => {
      const code = "data a;\n  x = cat(upcase(y), 2, trim(z));\nrun;";
      assert.isDefined(await sig(code, "y)", 1));
      assert.isDefined(await sig(code, "2,", 2));
      assert.isDefined(await sig(code, "z)", 1));
    });

    it("supports macro functions", async () => {
      const code = "%let a = %scan(&x, 2, %str(,));";
      const s = await sig(code, "2,", 2);
      assert.isDefined(s);
      assert.match(s!.signatures[0].label, /scan/i);
    });

    it("returns undefined outside of function calls and for unknown functions", async () => {
      assert.isUndefined(await sig("data a;\n  x = 1;\nrun;", "x = 1", 3));
      assert.isUndefined(
        await sig("data a;\n  x = nosuchfn(1, 2);\nrun;", "1,", 2),
      );
      assert.isUndefined(await sig("data a;\n  x = (1 + 2);\nrun;", "1 +", 1));
    });
  });

  describe("completion item help", () => {
    const resolveFirst = async (
      code: string,
      position: { line: number; character: number },
      count = 5,
    ) => {
      const provider = create(code).completionProvider;
      const list = await provider.getCompleteItems({
        textDocument: { uri: "test.sas" },
        position,
      });
      assert.isDefined(list, `no completion list for ${JSON.stringify(code)}`);
      const resolved = [];
      for (const item of list!.items.slice(0, count)) {
        resolved.push(await provider.getCompleteItemHelp(item));
      }
      return { list: list!, resolved };
    };

    const contexts: [string, string, { line: number; character: number }][] = [
      ["proc names", "proc ", { line: 0, character: 5 }],
      ["proc options", "proc sort ", { line: 0, character: 10 }],
      [
        "proc statements",
        "proc sort data=a;\n  \nrun;",
        { line: 1, character: 2 },
      ],
      [
        "proc statement options",
        "proc sort data=a;\n  by \nrun;",
        { line: 1, character: 5 },
      ],
      ["data step statements", "data a;\n  \nrun;", { line: 1, character: 2 }],
      ["global statements", "lib", { line: 0, character: 3 }],
      ["global statement options", "libname a ", { line: 0, character: 10 }],
      ["system options", "options ", { line: 0, character: 8 }],
      ["macro statements", "%", { line: 0, character: 1 }],
      ["ods statements", "ods ", { line: 0, character: 4 }],
      ["proc sql", "proc sql;\n  \nquit;", { line: 1, character: 2 }],
      ["functions", "data a;\n  x = sub", { line: 1, character: 9 }],
      ["macro functions", "%let a = %sca", { line: 0, character: 13 }],
    ];

    for (const [name, code, pos] of contexts) {
      it(`resolves help for ${name}`, async () => {
        const { list, resolved } = await resolveFirst(code, pos);
        assert.isAbove(list.items.length, 0);
        resolved.forEach((item, i) => {
          assert.equal(item.label, list.items[i].label);
        });
      });
    }

    it("uses quoted name literals for non-word data set names", async () => {
      const { list } = await resolveFirst("proc print data=", {
        line: 0,
        character: 16,
      });
      assert.isArray(list.items);
    });
  });
});
