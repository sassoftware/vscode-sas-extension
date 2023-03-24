import { exec } from "child_process";
import { readFileSync } from "fs";

const INCLUDED_FILE_TYPES = /.*\.(mjs|js|ts|tsx|jsx)$/;
const EXCLUDED_FILE_TYPES = /.*(\.test\.tsx?|check-copyright\.mjs)$/;
const COPYRIGHT_REGEX = /^\/\/ Copyright © ([0-9-\s]+), SAS Institute/;

const processChanges = (changedFiles) => {
  const filesToCheck = changedFiles
    .map((file) => file.trim())
    .filter(
      (file) =>
        INCLUDED_FILE_TYPES.test(file) && !EXCLUDED_FILE_TYPES.test(file)
    );

  let invalidFiles = [];
  filesToCheck.map((file) => {
    const fileContents = readFileSync(file);
    if (!COPYRIGHT_REGEX.test(fileContents.toString())) {
      invalidFiles.push(file);
    }
  });

  if (invalidFiles.length > 0) {
    console.log("The following files are missing copyright information");
    console.log(invalidFiles.map((file) => `- ${file}`).join("\n"));
    process.exit(1);
  }
};

await exec(
  `git diff origin/HEAD --diff-filter=A --name-only`,
  async (error, stdout, stderr) => processChanges(stdout.split("\n"))
);
