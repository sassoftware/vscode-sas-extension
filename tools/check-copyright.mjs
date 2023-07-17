import { readFileSync, writeFileSync } from "fs";
import glob from "glob";

// These files will not be checked for copyright information
const filesToIgnore = [
  "**/dist/**",
  "**/node_modules/**",
  "**/out/**",
  "**/test/**",
  "*.config.js",
  "*.test.tsx?",
  "tools/**",
];

const COPYRIGHT_REGEX = /^\/\/ Copyright © ([0-9-\s]+), SAS Institute/;
const COPYRIGHT_TEMPLATE = `// Copyright © ${new Date().getFullYear()}, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

`;

const processChanges = (filesToCheck, fix = false) => {
  let invalidFiles = [];
  filesToCheck.map((file) => {
    const fileContents = readFileSync(file);
    if (!COPYRIGHT_REGEX.test(fileContents.toString())) {
      invalidFiles.push(file);
      if (fix) {
        writeFileSync(file, `${COPYRIGHT_TEMPLATE}${fileContents}`);
      }
    }
  });

  if (invalidFiles.length > 0) {
    console.log(
      fix
        ? "The following files have been updated with copyright information"
        : "The following files are missing copyright information",
    );
    console.log(invalidFiles.map((file) => `- ${file}`).join("\n"));
    process.exit(1);
  }
};

await processChanges(
  glob.sync("**/*.{mjs,js,ts,tsx,jsx}", {
    ignore: filesToIgnore,
  }),
  process.env.npm_config_fix || false,
);
