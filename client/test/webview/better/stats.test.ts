// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import type {
  CellRange,
  ColumnMeta,
} from "../../../src/webview/better/protocol";
import { computeStats } from "../../../src/webview/better/stats";

const NUM: ColumnMeta = { id: "n", name: "n", label: "n", kind: "num" };
const CHAR: ColumnMeta = { id: "c", name: "c", label: "c", kind: "char" };

function oneNumericColumn(values: Array<string | null | undefined>): number {
  const ranges: CellRange[] = [
    { fromRow: 0, toRow: values.length - 1, fromCol: 0, toCol: 0 },
  ];
  return computeStats({
    ranges,
    columns: [NUM],
    getCell: (r) => values[r],
  }).numeric!.sum;
}

describe("better stats", () => {
  it("computes sum/avg/min/max over a numeric selection", () => {
    const s = computeStats({
      ranges: [{ fromRow: 0, toRow: 2, fromCol: 0, toCol: 0 }],
      columns: [NUM],
      getCell: (r) => ["5", "7", "7"][r],
    });
    assert.strictEqual(s.cellCount, 3);
    assert.strictEqual(s.nonNullCount, 3);
    assert.strictEqual(s.distinctCount, 2);
    assert.strictEqual(s.nullCount, 0);
    assert.strictEqual(s.numeric!.sum, 19);
    assert.strictEqual(s.numeric!.avg, 19 / 3);
    assert.strictEqual(s.numeric!.min, 5);
    assert.strictEqual(s.numeric!.max, 7);
  });

  it("counts nulls separately and yields no numeric aggregates", () => {
    const s = computeStats({
      ranges: [{ fromRow: 0, toRow: 0, fromCol: 0, toCol: 1 }],
      columns: [NUM, CHAR],
      getCell: () => null,
    });
    assert.strictEqual(s.nullCount, 2);
    assert.strictEqual(s.nonNullCount, 0);
    assert.strictEqual(s.numeric, null);
  });

  it("falls back to null aggregates when a non-numeric column is selected", () => {
    const s = computeStats({
      ranges: [{ fromRow: 0, toRow: 0, fromCol: 0, toCol: 1 }],
      columns: [NUM, CHAR],
      getCell: (r, col) => (col === 0 ? "3" : "text"),
    });
    assert.strictEqual(s.numeric, null);
    assert.strictEqual(s.nonNullCount, 2);
    assert.strictEqual(s.distinctCount, 2);
  });

  it("counts unloaded cells toward total but not aggregates", () => {
    const s = computeStats({
      ranges: [{ fromRow: 0, toRow: 1, fromCol: 0, toCol: 0 }],
      columns: [NUM],
      getCell: (r) => (r === 0 ? "3" : undefined),
    });
    assert.strictEqual(s.cellCount, 2);
    assert.strictEqual(s.nonNullCount, 1);
    assert.strictEqual(s.numeric!.sum, 3);
  });

  it("sums across a multi-row single column (sanity of helper)", () => {
    assert.strictEqual(oneNumericColumn(["1", "2", null]), 3);
  });
});
