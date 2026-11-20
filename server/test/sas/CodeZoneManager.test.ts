import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { CodeZoneManager } from "../../src/sas/CodeZoneManager";
import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

const createManager = (source: string) => {
  const document = TextDocument.create("code-zone-test.sas", "sas", 1, source);
  return new LanguageServiceProvider(document).getCodeZoneManager();
};

const positionOf = (source: string, text: string, offset = 1) => {
  const index = source.indexOf(text);
  assert.isAtLeast(
    index,
    0,
    `Expected source to contain ${JSON.stringify(text)}`,
  );
  const prefix = source.slice(0, index + offset).split("\n");
  return {
    line: prefix.length - 1,
    col: prefix[prefix.length - 1].length,
  };
};

const zoneAt = (source: string, text: string, offset = 1) => {
  const manager = createManager(source);
  const { line, col } = positionOf(source, text, offset);
  return { manager, zone: manager.getCurrentZone(line, col) };
};

describe("CodeZoneManager public cursor classification", () => {
  it("provides PROC statement and option context for a sort step", () => {
    const source = [
      "proc sort data=sashelp.class nodupkey;",
      "  by descending age;",
      "run;",
    ].join("\n");

    const option = zoneAt(source, "nodupkey");
    assert.equal(option.zone, CodeZoneManager.ZONE_TYPE.PROC_OPT);
    assert.equal(option.manager.getProcName(), "SORT");
    assert.equal(option.manager.getStmtName(), "SORT");

    const statement = zoneAt(source, "descending");
    assert.equal(statement.zone, CodeZoneManager.ZONE_TYPE.PROC_STMT_OPT);
    assert.equal(statement.manager.getProcName(), "SORT");
    assert.equal(statement.manager.getStmtName(), "BY");
    assert.equal(statement.manager.getOptionName(), "DESCENDING");
  });

  it("distinguishes a PROC data option from its value", () => {
    const source = "proc sort data=sashelp.class;\nrun;";
    const optionValue = zoneAt(source, "sashelp.class");

    assert.equal(optionValue.zone, CodeZoneManager.ZONE_TYPE.PROC_OPT_VALUE);
    assert.equal(optionValue.manager.getProcName(), "SORT");
    assert.equal(optionValue.manager.getOptionName(), "DATA");
  });

  it("classifies DATA step input dataset options and preserves their context", () => {
    const source = [
      "data work.out;",
      "  set sashelp.class(keep=name age);",
      "run;",
    ].join("\n");

    const optionName = zoneAt(source, "keep");
    assert.equal(optionName.zone, CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_NAME);
    assert.equal(optionName.manager.getStmtName(), "SET");
    assert.equal(optionName.manager.getSubOptionName(), "KEEP");

    const optionValue = zoneAt(source, "name");
    assert.equal(
      optionValue.zone,
      CodeZoneManager.ZONE_TYPE.DATA_SET_OPT_VALUE,
    );
  });

  it("provides global statement option and value context for LIBNAME", () => {
    const source = "libname demo '/sas/data' access=readonly;";

    const option = zoneAt(source, "access");
    assert.equal(option.zone, CodeZoneManager.ZONE_TYPE.GBL_STMT_OPT);
    assert.equal(option.manager.getStmtName(), "LIBNAME");
    assert.equal(option.manager.getOptionName(), "ACCESS");

    const value = zoneAt(source, "readonly");
    assert.equal(value.zone, CodeZoneManager.ZONE_TYPE.GBL_STMT_OPT_VALUE);
    assert.equal(value.manager.getOptionName(), "ACCESS");
  });

  it("recognizes ODS TAGSETS destinations as a tagset context", () => {
    const source = "ods tagsets.ExcelXP file='report.xml';";
    const { manager, zone } = zoneAt(source, "ExcelXP");

    assert.equal(zone, CodeZoneManager.ZONE_TYPE.TAGSETS_NAME);
    assert.equal(manager.getStmtName(), "ODS");
    assert.equal(manager.getOptionName(), "TAGSETS.EXCELXP");
  });

  it("keeps macro control flow and nested macro functions in their own zones", () => {
    const source = [
      "%macro report(ds=);",
      "  %if %length(&ds) %then %do;",
      "    %put &ds;",
      "  %end;",
      "%mend report;",
    ].join("\n");

    const macroFunction = zoneAt(source, "%length");
    assert.equal(macroFunction.zone, CodeZoneManager.ZONE_TYPE.MACRO_FUNC);
    assert.equal(macroFunction.manager.getStmtName(), "%IF");

    const macroStatement = zoneAt(source, "%put");
    assert.equal(macroStatement.zone, CodeZoneManager.ZONE_TYPE.MACRO_STMT);
  });

  it("distinguishes comments, quoted values, and inline datalines", () => {
    const source = [
      "libname demo '/sas/data'; /* library comment */",
      "data work.example;",
      "  input name $ age;",
      "  datalines;",
      "Ada 36",
      ";",
      "run;",
    ].join("\n");

    assert.equal(
      zoneAt(source, "/sas/data").zone,
      CodeZoneManager.ZONE_TYPE.QUOTED_STR,
    );
    assert.equal(
      zoneAt(source, "library comment").zone,
      CodeZoneManager.ZONE_TYPE.COMMENT,
    );
    assert.equal(
      zoneAt(source, "Ada 36").zone,
      CodeZoneManager.ZONE_TYPE.DATALINES,
    );
  });

  it("returns a restricted zone for cursor positions outside the document", () => {
    const manager = createManager("data work.example;\nrun;");

    assert.equal(
      manager.getCurrentZone(100, 100),
      CodeZoneManager.ZONE_TYPE.RESTRICTED,
    );
    assert.equal(
      manager.getCurrentZone(-1, -1),
      CodeZoneManager.ZONE_TYPE.RESTRICTED,
    );
  });
});
