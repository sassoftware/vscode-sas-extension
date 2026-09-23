// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { createReadStream } from "fs";
import * as path from "path";

import { delimiterForExt, parseCsv } from "./csvParser";
import { InMemorySource, buildInMemorySource } from "./inMemorySource";

/** Build an `InMemorySource` from a delimited text file (csv / tsv). */
export async function csvSource(
  fsPath: string,
  uid: string,
  delimiterOverride?: string,
): Promise<InMemorySource> {
  const ext = path.extname(fsPath);
  const delimiter = delimiterOverride ?? delimiterForExt(ext);
  const stream = createReadStream(fsPath, { encoding: "utf8" });
  const rows = await parseCsv(stream, { delimiter });

  if (rows.length === 0) {
    return new InMemorySource(path.basename(fsPath), uid, [], []);
  }

  // Treat the first row as the header line. We don't try to detect
  // header-less files automatically — users running this on raw data
  // would expect numeric columns to render as numeric and the first row
  // as text anyway, which matches our behaviour.
  const headers = rows[0];
  const dataRows = rows.slice(1);

  return buildInMemorySource(headers, dataRows, path.basename(fsPath), uid);
}
