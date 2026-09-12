// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import {
  buildCopyShortcutMessage,
  buildSelectAll,
  isCopyShortcut,
  isSelectAllShortcut,
  resolveCellClick,
  visibleRange,
} from "../../../src/webview/better/grid/gridHandlers";
import type {
  CellRange,
  ColumnMeta,
} from "../../../src/webview/better/protocol";

const columns: ColumnMeta[] = [
  { id: "a", name: "a", label: "A", kind: "char" },
  { id: "b", name: "b", label: "B", kind: "char" },
];

describe("better gridHandlers", () => {
  describe("resolveCellClick", () => {
    const base = {
      row: 0,
      col: 0,
      isRowGutter: false,
      shift: false,
      ctrlOrMeta: false,
      columnCount: 2,
      selection: [] as CellRange[],
      anchor: null as { row: number; col: number } | null,
    };

    it("single click → single cell + anchor", () => {
      const r = resolveCellClick({ ...base, row: 3, col: 1 });
      assert.deepEqual(r.selection, [
        { fromRow: 3, toRow: 3, fromCol: 1, toCol: 1 },
      ]);
      assert.deepEqual(r.anchor, { row: 3, col: 1 });
    });

    it("row-gutter click selects the whole row", () => {
      const r = resolveCellClick({ ...base, isRowGutter: true, row: 4 });
      assert.deepEqual(r.selection, [
        { fromRow: 4, toRow: 4, fromCol: 0, toCol: 1 },
      ]);
      assert.deepEqual(r.anchor, { row: 4, col: 0 });
    });

    it("shift+click extends from the anchor to a rectangle", () => {
      const r = resolveCellClick({
        ...base,
        shift: true,
        row: 5,
        col: 1,
        anchor: { row: 2, col: 0 },
      });
      assert.deepEqual(r.selection, [
        { fromRow: 2, toRow: 5, fromCol: 0, toCol: 1 },
      ]);
      assert.deepEqual(r.anchor, { row: 2, col: 0 });
    });

    it("ctrl/cmd+click toggles a cell", () => {
      const r = resolveCellClick({
        ...base,
        ctrlOrMeta: true,
        row: 1,
        col: 1,
        selection: [{ fromRow: 0, toRow: 0, fromCol: 0, toCol: 0 }],
      });
      assert.deepEqual(r.selection, [
        { fromRow: 0, toRow: 0, fromCol: 0, toCol: 0 },
        { fromRow: 1, toRow: 1, fromCol: 1, toCol: 1 },
      ]);
    });
  });

  describe("visibleRange", () => {
    it("preloads a buffer of one screenful either side, clamped", () => {
      assert.deepEqual(visibleRange(0, 200, 25, 1000), { from: 0, to: 16 });
      // visible=20, buffer=20 → to = min(49, 40) = 40
      assert.deepEqual(visibleRange(0, 2000, 100, 50), { from: 0, to: 40 });
    });
    it("handles scroll offset mid-table", () => {
      // first = 400, visible = 100, buffer = 100 → 300..600
      assert.deepEqual(visibleRange(8000, 2000, 20, 100000), {
        from: 300,
        to: 600,
      });
    });
  });

  describe("copy shortcut", () => {
    const src = {
      selection: [
        { fromRow: 0, toRow: 0, fromCol: 0, toCol: 1 },
      ] as CellRange[],
      columns,
      withHeaders: false,
      getCell: (r: number, c: number) => (r === 0 && c === 0 ? "x" : null),
    };

    it("builds a plain copy message for Ctrl+C", () => {
      const msg = buildCopyShortcutMessage(src);
      assert.strictEqual(msg?.kind, "copy");
      assert.strictEqual(msg?.format, "plain");
      assert.strictEqual(msg?.text, "x\t");
    });

    it("upgrades to headers only when shift is held", () => {
      const msg = buildCopyShortcutMessage({ ...src, withHeaders: true });
      assert.strictEqual(msg?.text, "A\tB\nx\t");
    });

    it("returns null for an empty selection", () => {
      assert.isNull(buildCopyShortcutMessage({ ...src, selection: [] }));
    });

    it("keys: Ctrl+C / Cmd+A detection", () => {
      const e = {
        ctrlKey: true,
        metaKey: false,
        altKey: false,
        key: "c",
      } as KeyboardEvent;
      assert.isTrue(isCopyShortcut(e));
      const a = { metaKey: true, key: "a" } as KeyboardEvent;
      assert.isTrue(isSelectAllShortcut(a));
      assert.isFalse(
        isCopyShortcut({ ctrlKey: true, key: "x" } as KeyboardEvent),
      );
    });
  });

  describe("select-all", () => {
    it("builds a full-table rectangle", () => {
      assert.deepEqual(buildSelectAll(10, 4), [
        { fromRow: 0, toRow: 9, fromCol: 0, toCol: 3 },
      ]);
    });
    it("returns null for empty tables", () => {
      assert.isNull(buildSelectAll(0, 4));
      assert.isNull(buildSelectAll(3, 0));
    });
  });
});
