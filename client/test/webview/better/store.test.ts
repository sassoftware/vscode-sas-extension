// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import type { ColumnMeta } from "../../../src/webview/better/protocol";
import { useStore } from "../../../src/webview/better/store";

const cols: ColumnMeta[] = [{ id: "a", name: "a", label: "A", kind: "char" }];

describe("better store", () => {
  beforeEach(() => {
    useStore.getState().init({
      title: "t",
      columns: cols,
      rowCount: 0,
      pageSize: 200,
      sort: [],
      filters: [],
    });
  });

  it("init seeds a fresh session", () => {
    const s = useStore.getState();
    assert.strictEqual(s.title, "t");
    assert.strictEqual(s.rowCount, 0);
    assert.deepEqual(Array.from(s.selection), []);
    assert.strictEqual(s.generation, 1);
    assert.strictEqual(s.loading, false);
    assert.strictEqual(s.error, null);
  });

  it("applyRows merges into the cache and updates rowCount", () => {
    const { applyRows } = useStore.getState();
    applyRows(0, [["x"], ["y"]], 500);
    const s = useStore.getState();
    assert.strictEqual(s.rowCount, 500);
    assert.strictEqual(s.rows.get(0)?.[0], "x");
    assert.strictEqual(s.rows.get(1)?.[0], "y");
  });

  it("setSort/clearFilters invalidate the cache and bump generation", () => {
    let s = useStore.getState();
    s.setSort([{ colId: "a", dir: "asc" }]);
    s = useStore.getState();
    assert.deepEqual(s.sort, [{ colId: "a", dir: "asc" }]);
    assert.strictEqual(s.generation, 2);
    assert.strictEqual(s.rows.size, 0);
    assert.strictEqual(s.requestedPages.size, 0);

    s.setFilter("a", { colId: "a", values: ["x"] });
    s = useStore.getState();
    assert.deepEqual(s.filters, [{ colId: "a", values: ["x"] }]);
    assert.strictEqual(s.generation, 3);

    s.clearFilters();
    s = useStore.getState();
    assert.deepEqual(s.filters, []);
    assert.strictEqual(s.generation, 4);
  });

  it("refresh keeps sort/filters but reloads data", () => {
    const { setSort, setFilter, refresh } = useStore.getState();
    setSort([{ colId: "a", dir: "asc" }]);
    setFilter("a", { colId: "a", values: ["x"] });
    refresh();
    const s = useStore.getState();
    assert.deepEqual(s.sort, [{ colId: "a", dir: "asc" }]);
    assert.deepEqual(s.filters, [{ colId: "a", values: ["x"] }]);
    assert.strictEqual(s.rows.size, 0);
    assert.strictEqual(s.requestedPages.size, 0);
    // refresh also bumps the generation so stale in-flight responses are
    // dropped (init=1, sort=2, filter=3, refresh=4).
    assert.strictEqual(s.generation, 4);
  });

  it("tracks selection and anchor independently", () => {
    const { setSelection, setAnchor } = useStore.getState();
    setSelection([{ fromRow: 0, toRow: 1, fromCol: 0, toCol: 0 }]);
    setAnchor({ row: 1, col: 0 });
    const s = useStore.getState();
    assert.lengthOf(s.selection, 1);
    assert.deepEqual(s.selectionAnchor, { row: 1, col: 0 });
  });
});
