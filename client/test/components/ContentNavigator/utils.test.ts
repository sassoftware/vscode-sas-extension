import { expect } from "chai";

import { getFileStatement } from "../../../src/components/ContentNavigator/utils";

describe("utils", async function () {
  it("getFileStatement - returns extensionless name + numeric suffix with no content", () => {
    expect(getFileStatement("testcsv.csv", "", "/path").value).to.equal(
      `filename \${1:fileref} filesrvc folderpath='/path' filename='testcsv.csv';\n`,
    );
  });

  it("getFileStatement - returns uppercase name + suffix with uppercase content", () => {
    expect(
      getFileStatement("testcsv.csv", "UPPER CASE CONTENT", "/path").value,
    ).to.equal(
      `FILENAME \${1:FILEREF} FILESRVC FOLDERPATH='/path' FILENAME='testcsv.csv';\n`,
    );
  });

  it("getFileStatement - returns encoded filename when filename contains quotes", () => {
    expect(
      getFileStatement("testcsv-'withquotes'.csv", "", "/path").value,
    ).to.equal(
      `filename \${1:fileref} filesrvc folderpath='/path' filename='testcsv-''withquotes''.csv';\n`,
    );
  });
});
