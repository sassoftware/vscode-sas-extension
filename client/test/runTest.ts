import { runTests } from "@vscode/test-electron";

import fs from "fs";
import * as path from "path";

// These tests run against our typescript files. Typescript does not
// copy files that aren't ts files but _are_ declared modules. If there
// are any files that need to be copied from the src directory to the
// ts compiled directory, put them here.
const filesToCopy = ["client/src/connection/itc/itc.ps1"];

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "../../../");

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, "./index");

    filesToCopy.forEach((item) =>
      fs.cpSync(
        path.join(extensionDevelopmentPath, item),
        path.join(__dirname, item),
        { recursive: true },
      ),
    );

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ["--disable-extensions", "--locale en-US"],
    });
  } catch (err) {
    console.error("Failed to run tests");
    process.exit(1);
  }
}

main();
