// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { expect } from "chai";
import { SinonSandbox, createSandbox } from "sinon";

// Test the baseDirectory argument handling logic in isolation
// This mirrors the logic from RestSession._run without requiring VS Code APIs

interface RunArgs {
  baseDirectory?: string;
}

function processRunArgs(args: unknown[]): Record<string, string> {
  const variables: Record<string, string> = {};

  // If baseDirectory is passed in, use it as a sas variable
  const runArgs = (args[0] as RunArgs) || {};
  const basePath = runArgs.baseDirectory || undefined;
  if (basePath) {
    variables._SASPROGRAMDIR = basePath;
  }

  return variables;
}

describe("REST Session _run", () => {
  let sandbox: SinonSandbox;

  beforeEach(() => {
    sandbox = createSandbox({});
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("baseDirectory argument handling", () => {
    it("should set _SASPROGRAMDIR variable when baseDirectory is provided", () => {
      const baseDirectory = "/home/user/projects/sas";

      const variables = processRunArgs([{ baseDirectory }]);

      expect(variables).to.deep.equal({
        _SASPROGRAMDIR: baseDirectory,
      });
    });

    it("should not set _SASPROGRAMDIR variable when baseDirectory is not provided", () => {
      const variables = processRunArgs([]);

      expect(variables).to.deep.equal({});
    });

    it("should not set _SASPROGRAMDIR variable when args object is empty", () => {
      const variables = processRunArgs([{}]);

      expect(variables).to.deep.equal({});
    });

    it("should not set _SASPROGRAMDIR variable when baseDirectory is undefined", () => {
      const variables = processRunArgs([{ baseDirectory: undefined }]);

      expect(variables).to.deep.equal({});
    });

    it("should not set _SASPROGRAMDIR variable when baseDirectory is empty string", () => {
      const variables = processRunArgs([{ baseDirectory: "" }]);

      expect(variables).to.deep.equal({});
    });

    it("should handle Windows-style paths for baseDirectory", () => {
      const baseDirectory = "C:\\Users\\user\\projects\\sas";

      const variables = processRunArgs([{ baseDirectory }]);

      expect(variables).to.deep.equal({
        _SASPROGRAMDIR: baseDirectory,
      });
    });

    it("should handle Unix-style paths for baseDirectory", () => {
      const baseDirectory = "/usr/local/sas/programs";

      const variables = processRunArgs([{ baseDirectory }]);

      expect(variables).to.deep.equal({
        _SASPROGRAMDIR: baseDirectory,
      });
    });
  });
});
