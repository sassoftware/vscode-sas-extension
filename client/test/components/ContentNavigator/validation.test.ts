import { expect } from "chai";

import { Messages } from "../../../src/components/ContentNavigator/const";
import { ContentSourceType } from "../../../src/components/ContentNavigator/types";
import { validateFileName } from "../../../src/components/ContentNavigator/validation";

describe("validation", async function () {
  it("validateFileName - blocks question marks for SAS Content", () => {
    expect(
      validateFileName("bad?ss.sas", ContentSourceType.SASContent),
    ).to.equal(Messages.FileValidationError);
  });

  it("validateFileName - blocks question marks for SAS Server", () => {
    expect(
      validateFileName("bad?ss.sas", ContentSourceType.SASServer),
    ).to.equal(Messages.FileValidationError);
  });

  it("validateFileName - blocks semicolons", () => {
    expect(
      validateFileName("good;name.sas", ContentSourceType.SASContent),
    ).to.equal(Messages.FileValidationError);
  });

  it("validateFileName - blocks asterisks", () => {
    expect(
      validateFileName("good*name.sas", ContentSourceType.SASContent),
    ).to.equal(Messages.FileValidationError);
  });

  it("validateFileName - blocks double quotes", () => {
    expect(
      validateFileName('good"name.sas', ContentSourceType.SASContent),
    ).to.equal(Messages.FileValidationError);
  });

  it("validateFileName - blocks pipe characters", () => {
    expect(
      validateFileName("good|name.sas", ContentSourceType.SASContent),
    ).to.equal(Messages.FileValidationError);
  });
});
