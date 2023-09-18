import { expect } from "chai";

import { getFileStatement } from "../../../src/components/ContentNavigator/utils";

const testFileStatement = (
  upperCase: boolean,
  expectedVariable: string,
  name: string,
) =>
  upperCase
    ? `FILENAME ${expectedVariable} FILESRVC FOLDERPATH='/path' FILENAME='${name}';\n`
    : `filename ${expectedVariable} filesrvc folderpath='/path' filename='${name}';\n`;

describe("utils", async function () {
  it("getFileStatement - returns extensionless name + numeric suffix with no content", () => {
    expect(getFileStatement("testcsv.csv", "", "/path")).to.equal(
      testFileStatement(false, "testcsv1", "testcsv.csv"),
    );
  });

  it("getFileStatement - returns uppercase name + suffix with uppercase content", () => {
    expect(
      getFileStatement("testcsv.csv", "UPPER CASE CONTENT", "/path"),
    ).to.equal(testFileStatement(true, "TESTCSV1", "testcsv.csv"));
  });

  it("getFileStatement - returns generated name + suffix with non alphanumeric item name", () => {
    expect(getFileStatement("中文.sas", "sasfile1 ", "/path")).to.equal(
      testFileStatement(false, "sasfile2", "中文.sas"),
    );
  });

  it("getFileStatement - excludes paths as part of uppercase name calculation", () => {
    expect(
      getFileStatement(
        "中文.sas",
        "file sasfile1 path='/ALL/UPPERCASE/PATH'",
        "/path",
      ),
    ).to.equal(testFileStatement(false, "sasfile2", "中文.sas"));
  });

  it("getFileStatement - returns variable name with correct numeric suffix no matter previous casing used", () => {
    expect(
      getFileStatement(
        "中文.sas",
        "FILE sAsFiLe1 FILESVC PATH='/ALL/UPPERCASE/PATH'",
        "/path",
      ),
    ).to.equal(testFileStatement(true, "SASFILE2", "中文.sas"));
  });
});
