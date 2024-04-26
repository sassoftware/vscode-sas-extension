import { expect } from "chai";

import { escapePowershellString } from "../../../src/connection/itc/util";

describe("ITC util test", () => {
  it("escapePowershellString - escapes powershell special characters", () => {
    const input = "P@$${}[]()\"'%{}rd";
    const expectedOutput = "P@`$`$`{`}`[`]`(`)`\"`'`%`{`}rd";

    expect(escapePowershellString(input)).to.equal(expectedOutput);
  });
});
