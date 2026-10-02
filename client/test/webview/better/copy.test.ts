// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import { buildCopyText } from "../../../src/webview/better/copy";
import type {
  CellRange,
  ColumnMeta,
} from "../../../src/webview/better/protocol";

const columns: ColumnMeta[] = [
  { id: "a", name: "a", label: "Alpha", kind: "char" },
  { id: "b", name: "b", label: "Beta", kind: "char" },
];

const store = new Map<string, string | null>();

function src(selection: CellRange[], rows: Map<string, string | null> = store) {
  return {
    selection,
    columns,
    getCell: (r: number, c: number) => rows.get(`${r}|${c}`) ?? null,
  };
}

describe("better copy", () => {
  beforeEach(() => store.clear());

  it("headers-only copies every column label tab-separated", () => {
    const text = buildCopyText("headers-only", src([]));
    assert.strictEqual(text, "Alpha\tBeta");
  });

  it("plain copies a tab-separated matrix without headers", () => {
    store.set("0|0", "x").set("0|1", "y").set("1|0", "m").set("1|1", "n");
    const text = buildCopyText(
      "plain",
      src([{ fromRow: 0, toRow: 1, fromCol: 0, toCol: 1 }]),
    );
    assert.strictEqual(text, "x\ty\nm\tn");
  });

  it("with-headers includes the column headers line", () => {
    store.set("0|0", "x").set("0|1", "y");
    const text = buildCopyText(
      "with-headers",
      src([{ fromRow: 0, toRow: 0, fromCol: 0, toCol: 1 }]),
    );
    assert.strictEqual(text, "Alpha\tBeta\nx\ty");
  });

  it("csv escapes commas, quotes and newlines", () => {
    store.set("0|0", "a,b").set("0|1", 'say "hi"');
    const text = buildCopyText(
      "csv",
      src([{ fromRow: 0, toRow: 0, fromCol: 0, toCol: 1 }]),
    );
    assert.strictEqual(text, 'Alpha,Beta\n"a,b","say ""hi"""');
  });

  it("json emits an array of objects keyed by column name", () => {
    store.set("0|0", "x").set("0|1", "y").set("1|0", "m");
    const text = buildCopyText(
      "json",
      src([{ fromRow: 0, toRow: 1, fromCol: 0, toCol: 1 }]),
    );
    const parsed = JSON.parse(text);
    assert.deepEqual(parsed[0], { a: "x", b: "y" });
    assert.deepEqual(parsed[1], { a: "m", b: null });
  });

  it("returns empty string when the selection has no fetched rows", () => {
    assert.strictEqual(buildCopyText("plain", src([])), "");
  });

  it("blanks cells inside a non-rectangular selection union", () => {
    // Two selected cells in the same row with an unselected gap between
    // them (reachable via ctrl/cmd-click toggling).
    const threeCols: ColumnMeta[] = [
      { id: "a", name: "a", label: "A", kind: "char" },
      { id: "b", name: "b", label: "B", kind: "char" },
      { id: "c", name: "c", label: "C", kind: "char" },
    ];
    store.set("0|0", "x").set("0|2", "z");
    const text = buildCopyText("plain", {
      selection: [
        { fromRow: 0, toRow: 0, fromCol: 0, toCol: 0 },
        { fromRow: 0, toRow: 0, fromCol: 2, toCol: 2 },
      ],
      columns: threeCols,
      getCell: (r: number, c: number) => store.get(`${r}|${c}`) ?? null,
    });
    // Bounding box cols 0..2; col 1 is not in the selection → blank tab.
    assert.strictEqual(text, "x\t\tz");
  });
});
