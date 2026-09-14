// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";
import { Readable } from "stream";

import {
  delimiterForExt,
  parseCsv,
} from "../../../src/components/FileTableViewer/csvParser";
import { buildInMemorySource } from "../../../src/components/FileTableViewer/inMemorySource";
import { inferColumns } from "../../../src/components/FileTableViewer/typeInfer";
import { FileTableSource } from "../../../src/components/FileTableViewer/types";

function csvStream(text: string): Readable {
  return Readable.from([text]);
}

/** Build a minimal in-memory source whose first row is the header, the
 *  rest data — the shared `buildInMemorySource` path `csvSource`/`xlsxSource`
 *  use. */
function source(rowsWithHeader: (string | null)[][]): FileTableSource {
  const headers = rowsWithHeader[0] ?? [];
  return buildInMemorySource(headers, rowsWithHeader.slice(1), "t", "uid");
}

describe("FileTableViewer", () => {
  describe("csvParser", () => {
    it("parses simple csv rows", async () => {
      const rows = await parseCsv(csvStream("a,b,c\n1,2,3\n"));
      assert.deepEqual(rows, [
        ["a", "b", "c"],
        ["1", "2", "3"],
      ]);
    });

    it("strips a UTF-8 BOM from the first header", async () => {
      const rows = await parseCsv(csvStream("﻿a,b\n1,2\n"));
      assert.strictEqual(rows[0][0], "a");
    });

    it("handles quoted cells with embedded delimiters and newlines", async () => {
      const rows = await parseCsv(csvStream('h1,h2\n"a,b","line1\nline2"\n'));
      assert.deepEqual(rows[1], ["a,b", "line1\nline2"]);
    });

    it('handles escaped quotes ("" → ")', async () => {
      const rows = await parseCsv(csvStream('h\n"say ""hi"""\n'));
      assert.strictEqual(rows[0][0], "h");
      assert.strictEqual(rows[1][0], 'say "hi"');
    });

    it("flushes a trailing record without a terminating newline", async () => {
      const rows = await parseCsv(csvStream("a,b\n1,2"));
      assert.strictEqual(rows.length, 2);
      assert.deepEqual(rows[1], ["1", "2"]);
    });

    it("picks the tsv delimiter for .tsv", () => {
      assert.strictEqual(delimiterForExt(".TSV"), "\t");
      assert.strictEqual(delimiterForExt(".csv"), ",");
    });
  });

  describe("typeInfer", () => {
    it("infers numeric, date, datetime and char columns", () => {
      const cols = inferColumns(
        ["num", "date", "dt", "txt"],
        [
          ["1.5", "2024-01-02", "2024-01-02 10:30:00", "hello"],
          ["2", "2024-01-03", "2024-01-03T11:00Z", "world"],
        ],
      );
      assert.strictEqual(cols[0].type, "num");
      assert.strictEqual(cols[1].type, "date");
      assert.strictEqual(cols[2].type, "datetime");
      assert.strictEqual(cols[3].type, "char");
    });

    it("falls back to char when any value fails the pattern", () => {
      const cols = inferColumns(["n"], [["1"], ["x"]]);
      assert.strictEqual(cols[0].type, "char");
    });

    it("uses an empty sample and blank names defensively", () => {
      const cols = inferColumns(["", "b"], []);
      assert.strictEqual(cols[0].name, "col1");
      assert.strictEqual(cols[0].type, "char");
    });
  });

  describe("InMemorySource", () => {
    it("returns rows in file order with the placeholder index cell prepended", async () => {
      const src = source([
        ["a", "b"],
        ["1", "2"],
        ["3", "4"],
      ]);
      const { rows, count } = await src.getRows(0, 10, [], undefined);
      assert.strictEqual(count, 2);
      assert.deepEqual(rows[0].cells, ["", "1", "2"]);
      assert.deepEqual(rows[1].cells, ["", "3", "4"]);
    });

    it("honors the page window", async () => {
      const src = source([["a"], ["1"], ["2"], ["3"], ["4"]]);
      const { rows } = await src.getRows(1, 2, [], undefined);
      assert.strictEqual(rows.length, 2);
      assert.strictEqual(rows[0].cells[1], "2");
      assert.strictEqual(rows[1].cells[1], "3");
    });

    it("sorts numerically", async () => {
      const src = source([
        ["n", "s"],
        ["3", "c"],
        ["1", "a"],
        ["2", "b"],
      ]);
      const { rows } = await src.getRows(
        0,
        10,
        [{ colId: "n", sort: "asc" }],
        undefined,
      );
      assert.deepEqual(
        rows.map((r) => r.cells?.[1]),
        ["1", "2", "3"],
      );
    });

    it("sorts descending without re-sorting the original data", async () => {
      const src = source([["n"], ["1"], ["2"], ["3"]]);
      const { rows } = await src.getRows(
        0,
        10,
        [{ colId: "n", sort: "desc" }],
        undefined,
      );
      assert.deepEqual(
        rows.map((r) => r.cells?.[1]),
        ["3", "2", "1"],
      );
    });

    it("applies a case-insensitive substring filter from filterValue", async () => {
      const src = source([["a"], ["Alpha"], ["beta"], ["gamma"]]);
      const { rows, count } = await src.getRows(0, 10, [], {
        filterValue: "AL",
      });
      assert.strictEqual(count, 1);
      assert.strictEqual(rows[0].cells?.[1], "Alpha");
    });

    it("returns the whole table for an empty filter", async () => {
      const src = source([["a"], ["x"], ["y"]]);
      const { rows, count } = await src.getRows(0, 10, [], {
        filterValue: "  ",
      });
      assert.strictEqual(count, 2);
      assert.strictEqual(rows.length, 2);
    });

    it("keeps only rows whose column value is in a checklist `in (...)` filter", async () => {
      const src = source([
        ["region", "qty"],
        ["EU", "1"],
        ["US", "2"],
        ["APAC", "3"],
      ]);
      const { rows, count } = await src.getRows(0, 10, [], {
        filterValue: '(region in ("EU","us"))',
      });
      assert.strictEqual(count, 2);
      assert.deepEqual(
        rows.map((r) => r.cells?.[1]),
        ["EU", "US"],
      );
    });

    it("ANDS multiple column checklist filters together", async () => {
      const src = source([
        ["region", "qty"],
        ["EU", "10"],
        ["US", "20"],
        ["EU", "30"],
      ]);
      const { rows } = await src.getRows(0, 10, [], {
        filterValue: '(region in ("EU")) and (qty in ("30"))',
      });
      assert.deepEqual(
        rows.map((r) => r.cells?.[1]),
        ["EU"],
      );
    });

    it("decodes escaped quotes in checklist values", async () => {
      const src = source([
        ["a"],
        ['say "hi"'],
        ["plain"],
      ]);
      const { rows } = await src.getRows(0, 10, [], {
        filterValue: '(a in ("say ""hi"""))',
      });
      assert.strictEqual(rows.length, 1);
      assert.strictEqual(rows[0].cells?.[1], 'say "hi"');
    });

    it("falls back to substring when the filter is not a checklist expression", async () => {
      const src = source([["a"], ["Alpha"], ["AL"], ["gamma"]]);
      const { rows } = await src.getRows(0, 10, [], {
        filterValue: "(foo in (\"x\"))",
      });
      // Unknown column in the `in` form → not an in-memory checklist,
      // so no rows survive the substring lookup.
      assert.strictEqual(rows.length, 0);
      const again = await src.getRows(0, 10, [], {
        filterValue: "ALP",
      });
      assert.strictEqual(again.rows.length, 1);
      assert.strictEqual(again.rows[0].cells?.[1], "Alpha");
    });
  });
});
