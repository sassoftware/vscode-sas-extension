// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import {
  isValidMacroName,
  parseMacroDefinitions,
} from "../../src/sas/MacroDefinitionParser";

describe("parseMacroDefinitions", () => {
  it("parses positional and keyword parameters", () => {
    const macros = parseMacroDefinitions(
      "%macro report(ds, var, out=work.result, title=);\n%mend;",
    );
    assert.deepEqual(macros, [
      {
        name: "report",
        parameters: [
          { name: "ds", keyword: false },
          { name: "var", keyword: false },
          { name: "out", keyword: true, defaultValue: "work.result" },
          { name: "title", keyword: true },
        ],
      },
    ]);
  });

  it("parses a macro without parameters", () => {
    const macros = parseMacroDefinitions("%MACRO hello;\n%put hi;\n%MEND;");
    assert.equal(macros.length, 1);
    assert.equal(macros[0].name, "hello");
    assert.isUndefined(macros[0].parameters);
  });

  it("keeps commas inside quotes, parentheses and %str in defaults", () => {
    const macros = parseMacroDefinitions(
      "%macro m(a=%str(x,y), b='1,2', c=(3,4), d=%nrstr(%(,), e);%mend;",
    );
    assert.deepEqual(
      macros[0].parameters?.map((p) => [p.name, p.keyword, p.defaultValue]),
      [
        ["a", true, "%str(x,y)"],
        ["b", true, "'1,2'"],
        ["c", true, "(3,4)"],
        ["d", true, "%nrstr(%(,)"],
        ["e", false, undefined],
      ],
    );
  });

  it("parses parameters across several lines", () => {
    const macros = parseMacroDefinitions(
      "%macro multi(\n  first,\n  /* a comment, with comma */\n  second=  1  2\n);\n%mend;",
    );
    assert.deepEqual(macros[0].parameters, [
      { name: "first", keyword: false },
      { name: "second", keyword: true, defaultValue: "1 2" },
    ]);
  });

  it("detects PARMBUFF, PBUFF and DES= options", () => {
    const macros = parseMacroDefinitions(
      [
        "%macro a / parmbuff;%mend;",
        "%macro b(x) / PBUFF des='It''s b';%mend;",
        '%macro c / des="not parmbuff" store;%mend;',
      ].join("\n"),
    );
    assert.deepEqual(
      macros.map((m) => [m.name, m.parmbuff, m.description]),
      [
        ["a", true, undefined],
        ["b", true, "It's b"],
        ["c", undefined, "not parmbuff"],
      ],
    );
  });

  it("uses an immediately preceding comment as description", () => {
    const macros = parseMacroDefinitions(
      [
        "/* Adds two numbers. */",
        "%macro add(a, b);%mend;",
        "* not a description;",
        "data _null_; run;",
        "%macro other;%mend;",
        "%* Macro comment description;",
        "%macro third;%mend;",
      ].join("\n"),
    );
    assert.deepEqual(
      macros.map((m) => [m.name, m.description]),
      [
        ["add", "Adds two numbers."],
        ["other", undefined],
        ["third", "Macro comment description"],
      ],
    );
  });

  it("prefers DES= over a leading comment", () => {
    const macros = parseMacroDefinitions(
      "/* comment */\n%macro m / des='from des';%mend;",
    );
    assert.equal(macros[0].description, "from des");
  });

  it("ignores %macro inside comments and strings", () => {
    const macros = parseMacroDefinitions(
      [
        "/* %macro inblock(a); */",
        "* %macro instar(a);",
        "%* %macro inmacrocomment(a);",
        "%put '%macro insingle(a);';",
        'title "%macro indouble(a);";',
        "%macro real;%mend;",
      ].join("\n"),
    );
    assert.deepEqual(
      macros.map((m) => m.name),
      ["real"],
    );
  });

  it("skips dynamic, invalid and too long names", () => {
    const longName = "a".repeat(33);
    const macros = parseMacroDefinitions(
      [
        "%macro &name;%mend;",
        "%macro a&b;%mend;",
        `%macro ${longName};%mend;`,
        `%macro ${"b".repeat(32)};%mend;`,
      ].join("\n"),
    );
    assert.deepEqual(
      macros.map((m) => m.name),
      ["b".repeat(32)],
    );
  });

  it("returns nested definitions in source order", () => {
    const macros = parseMacroDefinitions(
      "%macro outer;\n  %macro inner(x);\n  %mend inner;\n%mend outer;",
    );
    assert.deepEqual(
      macros.map((m) => m.name),
      ["outer", "inner"],
    );
  });

  it("attaches the source label", () => {
    const macros = parseMacroDefinitions(
      "%macro m;%mend;",
      "My Folder/util.sas",
    );
    assert.equal(macros[0].sourceLabel, "My Folder/util.sas");
  });

  it("does not treat %macro as part of a longer word", () => {
    const macros = parseMacroDefinitions("%macros(x);\n%macro ok;%mend;");
    assert.deepEqual(
      macros.map((m) => m.name),
      ["ok"],
    );
  });
});

describe("isValidMacroName", () => {
  it("validates SAS macro names", () => {
    assert.isTrue(isValidMacroName("_abc1"));
    assert.isTrue(isValidMacroName("a".repeat(32)));
    assert.isFalse(isValidMacroName("a".repeat(33)));
    assert.isFalse(isValidMacroName("1abc"));
    assert.isFalse(isValidMacroName("a-b"));
    assert.isFalse(isValidMacroName(""));
    assert.isFalse(isValidMacroName(42));
  });
});
