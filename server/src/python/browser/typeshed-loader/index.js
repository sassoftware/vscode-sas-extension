// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * A webpack loader gathering typeshed for intellisense features
 */
const fs = require("fs/promises");
const path = require("path");

const dirs = ["stdlib", "stubs/sas"];
const result = [];

async function* walk(dir) {
  for await (const d of await fs.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) {
      yield* walk(entry);
    } else if (d.isFile()) {
      yield entry;
    }
  }
}

async function loader() {
  const callback = this.async();

  for (const dir of dirs) {
    const entry = path.resolve(
      __dirname,
      "../../../../dist/node/typeshed-fallback",
      dir,
    );
    const prefixLength = entry.indexOf("typeshed-fallback") - 1;
    for await (const filename of walk(entry)) {
      if (filename.endsWith(".pyi")) {
        const content = await fs.readFile(filename);
        result.push({
          content: content.toString(),
          filePath: filename.slice(prefixLength).replace(/\\/g, "/"),
        });
      }
    }
  }

  callback(null, `export const typeShed = ${JSON.stringify(result)}`);
}

module.exports = loader;
