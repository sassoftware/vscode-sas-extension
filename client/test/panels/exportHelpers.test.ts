// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import {
  exportHeaders,
  exportKeys,
  formatCsvCells,
  formatCsvHeader,
  selectExportRows,
  toJsonRecord,
} from "../../src/panels/exportHelpers";
import type { ColumnMeta } from "../../src/webview/better/protocol";

function cols(names: string[]): ColumnMeta[] {
  return names.map((n) => ({ id: n, name: n, label: n, kind: "char" }));
}

/** Row source shaped like `iterAllRows` yields (index cell already
 *  stripped — a plain string[] per data column). */
async function* rowsFrom(data: (string | null)[][]): AsyncGenerator<string[]> {
  for (const r of data) {
    yield r.map((v) => v ?? "");
  }
}

async function collect(
  ...args: Parameters<typeof selectExportRows>
): Promise<
  ReturnType<typeof selectExportRows> extends AsyncGenerator<infer T>
    ? T[]
    : never
> {
  const out: unknown[] = [];
  for await (const row of selectExportRows(...args)) {
    out.push(row);
  }
  return out as ReturnType<typeof selectExportRows> extends AsyncGenerator<
    infer T
  >
    ? T[]
    : never;
}

describe("exportHelpers", () => {
  describe("headers / keys", () => {
    it("uses label falling back to name", () => {
      const mixed: ColumnMeta[] = [
        { id: "a", name: "a", label: "Alpha", kind: "char" },
        { id: "b", name: "b", label: undefined, kind: "char" },
      ];
      assert.deepEqual(exportHeaders(mixed), ["Alpha", "b"]);
      assert.deepEqual(exportKeys(mixed), ["a", "b"]);
    });
  });

  describe("selectExportRows scoping", () => {
    const c = cols(["a", "b", "c"]);

    it('scope "all" includes every row and cell, never excluded', async () => {
      const out = await collect(
        c,
        "all",
        undefined,
        rowsFrom([
          ["1", "2", "3"],
          ["4", "5", "6"],
        ]),
      );
      assert.lengthOf(out, 2);
      for (const row of out) {
        assert.isFalse(row.some((cell) => cell.excluded));
        assert.isFalse(row.some((cell) => cell.value === null));
      }
    });

    it('scope "selection" drops rows outside the row span', async () => {
      const sel = [{ fromRow: 0, toRow: 0, fromCol: 0, toCol: 2 }];
      const out = await collect(
        c,
        "selection",
        sel,
        rowsFrom([
          ["1", "2", "3"],
          ["4", "5", "6"],
        ]),
      );
      assert.lengthOf(out, 1);
      assert.deepEqual(
        out[0].map((x) => x.value),
        ["1", "2", "3"],
      );
    });

    it('scope "selection" marks out-of-rectangle cells excluded', async () => {
      // Selection covers cols 1..2 (single-column region).
      const sel = [{ fromRow: 0, toRow: 0, fromCol: 1, toCol: 1 }];
      const out = await collect(
        c,
        "selection",
        sel,
        rowsFrom([["1", "2", "3"]]),
      );
      assert.lengthOf(out, 1);
      assert.deepEqual(
        out[0].map((x) => ({ v: x.value, ex: x.excluded })),
        [
          { v: "1", ex: true },
          { v: "2", ex: false },
          { v: "3", ex: true },
        ],
      );
    });

    it("treats an undefined selection as no selection", async () => {
      const out = await collect(c, "selection", undefined, rowsFrom([["1"]]));
      assert.lengthOf(out, 1);
      assert.isFalse(out[0][0].excluded);
    });
  });

  describe("CSV serialization", () => {
    it("writes a header line from labels", () => {
      assert.strictEqual(formatCsvHeader(["a", "b"]), "a,b");
      assert.strictEqual(
        formatCsvHeader(["a,b", 'say "hi"']),
        '"a,b","say ""hi"""',
      );
    });

    it("quotes only cells that need it (RFC-4180-style)", () => {
      assert.strictEqual(
        formatCsvCells([{ value: "plain", excluded: false }]),
        "plain",
      );
      assert.strictEqual(
        formatCsvCells([
          { value: "a,b", excluded: false },
          { value: 'x"y', excluded: false },
          { value: "line\nbreak", excluded: false },
        ]),
        '"a,b","x""y","line\nbreak"',
      );
    });

    it("renders excluded and null cells as empty", () => {
      assert.strictEqual(
        formatCsvCells([
          { value: null, excluded: false },
          { value: "x", excluded: true },
        ]),
        ",",
      );
    });
  });

  describe("JSON serialization", () => {
    const keys = ["a", "b", "c"];

    it("keys by column name, null becomes empty string", () => {
      assert.deepEqual(
        toJsonRecord(keys, [
          { value: "1", excluded: false },
          { value: null, excluded: false },
          { value: "3", excluded: false },
        ]),
        { a: "1", b: "", c: "3" },
      );
    });

    it("omits excluded cells entirely (not null)", () => {
      assert.deepEqual(
        toJsonRecord(keys, [
          { value: "1", excluded: false },
          { value: "secret", excluded: true },
          { value: "3", excluded: false },
        ]),
        { a: "1", c: "3" },
      );
    });
  });
});
