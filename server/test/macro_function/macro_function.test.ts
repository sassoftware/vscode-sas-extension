// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { CodeZoneManager } from "../../src/sas/CodeZoneManager";
import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

const createCodeZoneManager = (content: string): CodeZoneManager => {
  const document = TextDocument.create(
    "macro-function-test.sas",
    "sas",
    1,
    content,
  );
  return new LanguageServiceProvider(document).getCodeZoneManager();
};

const getZone = (content: string, line = 0, character = 1): number =>
  createCodeZoneManager(content).getCurrentZone(line, character);

const MACRO_IF_CASE = [
  "%macro untag(title);",
  "  %do %while (%scan(&title,&stbk)>0);",
  "    %if (%qsubstr(&title,1,1)=&stbk) %then %do;",
  "    %end;",
  '    title "&title";',
  "%mend untag;",
].join("\n");

describe("Test code zone for macro functions", () => {
  it("classifies %SCAN as MACRO_FUNC instead of MACRO_STMT", () => {
    assert.equal(
      getZone("%SCAN(&var,1)"),
      CodeZoneManager.ZONE_TYPE.MACRO_FUNC,
    );
  });

  ["%LENGTH(&var)", "%SYSFUNC(DATE())", "%QSUBSTR(&var,1,3)"].forEach(
    (macroFunction) => {
      it(`classifies ${macroFunction} as MACRO_FUNC`, () => {
        assert.equal(
          getZone(macroFunction),
          CodeZoneManager.ZONE_TYPE.MACRO_FUNC,
        );
      });
    },
  );

  [
    "%LET value=1;",
    "%IF &x=1 %THEN %PUT TEST;",
    "%DO i=1 %TO 10;",
    "%MACRO test;",
    "%MEND;",
  ].forEach((macroStatement) => {
    it(`classifies ${macroStatement.split(/\s/)[0]} as MACRO_STMT`, () => {
      assert.equal(
        getZone(macroStatement),
        CodeZoneManager.ZONE_TYPE.MACRO_STMT,
      );
    });
  });

  it("classifies %IF with a parenthesized condition as MACRO_STMT", () => {
    assert.equal(
      getZone(MACRO_IF_CASE, 2, 5),
      CodeZoneManager.ZONE_TYPE.MACRO_STMT,
    );
  });

  it("provides %IF statement hover help with a parenthesized condition", async () => {
    const document = TextDocument.create(
      "macro-if-hover-test.sas",
      "sas",
      1,
      MACRO_IF_CASE,
    );
    const languageServer = new LanguageServiceProvider(document);
    Reflect.set(
      languageServer.completionProvider,
      "_addLinkContext",
      () => "%IF statement hover",
    );

    const hover = await languageServer.completionProvider.getHelp({
      line: 2,
      character: 5,
    });

    assert.isDefined(hover, "hover should be available for %IF");
    if (
      !hover ||
      typeof hover.contents === "string" ||
      Array.isArray(hover.contents)
    ) {
      assert.fail("hover should contain markdown for %IF");
      return;
    }
    assert.match(hover.contents.value, /%IF/i);
  });

  it("provides %SCAN macro function hover help when hovering on the % sign", async () => {
    const content = "%SCAN(&var,1)";
    const document = TextDocument.create(
      "macro-func-hover-test.sas",
      "sas",
      1,
      content,
    );
    const languageServer = new LanguageServiceProvider(document);
    Reflect.set(
      languageServer.completionProvider,
      "_addLinkContext",
      () => "%SCAN macro function hover",
    );

    for (const character of [0, 1, content.indexOf("SCAN") + 2]) {
      const hover = await languageServer.completionProvider.getHelp({
        line: 0,
        character,
      });

      assert.isDefined(
        hover,
        `hover should be available for %SCAN at character ${character}`,
      );
      if (
        !hover ||
        typeof hover.contents === "string" ||
        Array.isArray(hover.contents)
      ) {
        assert.fail("hover should contain markdown for %SCAN");
        return;
      }
      assert.match(hover.contents.value, /%SCAN/i);
    }
  });

  it("returns MACRO_FUNC inside PROC scope", () => {
    assert.equal(
      getZone("proc sql;\n%SCAN(&var,1)\nquit;", 1),
      CodeZoneManager.ZONE_TYPE.MACRO_FUNC,
    );
  });

  it("returns MACRO_FUNC inside DATA step scope", () => {
    assert.equal(
      getZone("data _null_;\n%LENGTH(&var)\nrun;", 1),
      CodeZoneManager.ZONE_TYPE.MACRO_FUNC,
    );
  });

  it("returns MACRO_FUNC inside macro scope", () => {
    assert.equal(
      getZone("%macro test;\n%QSUBSTR(&var,1,3)\n%mend;", 1),
      CodeZoneManager.ZONE_TYPE.MACRO_FUNC,
    );
  });

  ["%SYSFUNC(DATEPART(DATETIME()))", "%SYSFUNC(PUTN(DATE(),DATE9.))"].forEach(
    (macroFunction) => {
      it(`classifies nested ${macroFunction} as MACRO_FUNC`, () => {
        assert.equal(
          getZone(macroFunction),
          CodeZoneManager.ZONE_TYPE.MACRO_FUNC,
        );
      });
    },
  );

  it("classifies %SCAN at each cursor position", () => {
    const macroFunction = "%SCAN(&var,1)";
    const positions = [
      { character: 1, zone: CodeZoneManager.ZONE_TYPE.MACRO_FUNC },
      {
        character: macroFunction.indexOf("&var") + 1,
        zone: CodeZoneManager.ZONE_TYPE.MACRO_STMT_BODY,
      },
      {
        character: macroFunction.length,
        zone: CodeZoneManager.ZONE_TYPE.MACRO_STMT_BODY,
      },
      {
        character: macroFunction.indexOf("("),
        zone: CodeZoneManager.ZONE_TYPE.MACRO_FUNC,
      },
    ];

    positions.forEach(({ character, zone }) => {
      assert.equal(getZone(macroFunction, 0, character), zone);
    });
  });
});
