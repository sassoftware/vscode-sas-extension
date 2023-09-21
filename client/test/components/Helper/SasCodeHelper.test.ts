import * as assert from "assert";

import { assign_SASProgramFile } from "../../../src/components/Helper/SasCodeHelper";

describe("assign_SASProgramFile", () => {
  it("correctly assigns windows style file path to &_SASPROGRAMFILE", () => {
    const code = "%put &=_SASPROGRAMFILE;";
    const fileName = `c:\\temp\\My Test\\R&D\\mean(95%CI)\\Parkinson's Disease example.sas`;
    assert.equal(
      assign_SASProgramFile(code, fileName),
      `%let _SASPROGRAMFILE = %nrquote(%nrstr(c:\\temp\\My Test\\R&D\\mean%(95%CI%)\\Parkinson%'s Disease example.sas));\n%put &=_SASPROGRAMFILE;`,
      "assign_SASProgramFile returned unexpected string",
    );
  });
});

describe("assign_SASProgramFile", () => {
  it("correctly assigns unix style file path to &_SASPROGRAMFILE", () => {
    const code = "%put &=_SASPROGRAMFILE;";
    const fileName = `/tmp/My Test/R&D/mean(95%CI)/Parkinson's Disease example.sas`;
    assert.equal(
      assign_SASProgramFile(code, fileName),
      `%let _SASPROGRAMFILE = %nrquote(%nrstr(/tmp/My Test/R&D/mean%(95%CI%)/Parkinson%'s Disease example.sas));\n%put &=_SASPROGRAMFILE;`,
      "assign_SASProgramFile returned unexpected string",
    );
  });
});
