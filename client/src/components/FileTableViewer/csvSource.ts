// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { createReadStream } from "fs";
import * as path from "path";

import { delimiterForExt, parseCsv } from "./csvParser";
import { InMemorySource } from "./inMemorySource";
import { inferColumns } from "./typeInfer";

const TYPE_INFER_SAMPLE = 200;

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

  const sample = dataRows.slice(0, TYPE_INFER_SAMPLE);
  const columns = inferColumns(headers, sample);

  // Pad/truncate every row to exactly `headers.length` cells, then
  // prepend the leading index placeholder the panel strips.
  const cellRows: (string | null)[][] = dataRows.map((r) => {
    const out: (string | null)[] = [""];
    for (let i = 0; i < headers.length; i++) {
      const v = r[i];
      out.push(v === undefined ? null : v);
    }
    return out;
  });

  return new InMemorySource(path.basename(fsPath), uid, columns, cellRows);
}
