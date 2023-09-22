import { expect } from "chai";

import { getFileStatement } from "../../../src/components/ContentNavigator/utils";

const testFileStatement = (
  upperCase: boolean,
  expectedVariable: string,
  name: string,
) => {
  const date = new Date();
  const uniqueSuffix = `${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;
  return upperCase
    ? `FILENAME ${expectedVariable}${uniqueSuffix} FILESRVC FOLDERPATH='/path' FILENAME='${name}';\n`
    : `filename ${expectedVariable}${uniqueSuffix} filesrvc folderpath='/path' filename='${name}';\n`;
};

describe("utils", async function () {
  it("getFileStatement - returns extensionless name + numeric suffix with no content", () => {
    expect(getFileStatement("testcsv.csv", "", "/path")).to.equal(
      testFileStatement(false, "testcsv", "testcsv.csv"),
    );
  });

  it("getFileStatement - returns uppercase name + suffix with uppercase content", () => {
    expect(
      getFileStatement("testcsv.csv", "UPPER CASE CONTENT", "/path"),
    ).to.equal(testFileStatement(true, "TESTCSV", "testcsv.csv"));
  });

  it("getFileStatement - returns generated name + suffix with non alphanumeric item name", () => {
    expect(getFileStatement("中文.sas", "sasfile1 ", "/path")).to.equal(
      testFileStatement(false, "sasfile", "中文.sas"),
    );
  });

  it("getFileStatement - excludes paths as part of uppercase name calculation", () => {
    expect(
      getFileStatement(
        "中文.sas",
        "file sasfile1 path='/ALL/UPPERCASE/PATH'",
        "/path",
      ),
    ).to.equal(testFileStatement(false, "sasfile", "中文.sas"));
  });
});
