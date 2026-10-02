// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// The data pump is the performance core of the viewer: it must request
// only the pages that could be visible, never re-request an already
// cached page, and drop responses from a stale sort/filter generation.
// These tests pin that behaviour so scrolling a large table stays snappy
// (one request per newly-reached page) instead of refetching everything.
import { assert } from "chai";

import { __resetForTests } from "../../../src/webview/better/messaging";
import type { ColumnMeta } from "../../../src/webview/better/protocol";
import {
  __pendingForTests,
  bindPump,
  ensureRange,
} from "../../../src/webview/better/pump";
import { useStore } from "../../../src/webview/better/store";

const cols: ColumnMeta[] = [{ id: "a", name: "a", label: "A", kind: "char" }];

type RowReq = {
  kind: "rows-req";
  reqId: number;
  start: number;
  end: number;
  sort: unknown[];
  filters: unknown[];
};
type Posted = RowReq | { kind: "copy"; text: string };

let posted: Posted[] = [];
let windowHandler: ((e: { data: unknown }) => void) | null = null;

before(() => {
  (globalThis as unknown as { acquireVsCodeApi: unknown }).acquireVsCodeApi =
    () => ({
      postMessage: (m: unknown) => posted.push(m as Posted),
      setState: () => undefined,
      getState: () => undefined,
    });
  (globalThis as unknown as { window: unknown }).window = {
    addEventListener: (_t: string, h: (e: { data: unknown }) => void) => {
      windowHandler = h;
    },
  };
});

function init(rowCount: number): void {
  useStore.getState().init({
    title: "t",
    columns: cols,
    rowCount,
    pageSize: 200,
    sort: [],
    filters: [],
  });
}

function reqs(): RowReq[] {
  return posted.filter((m): m is RowReq => m.kind === "rows-req");
}

describe("better pump (paging efficiency)", () => {
  beforeEach(() => {
    __resetForTests();
    posted = [];
    init(1000);
  });

  it("requests exactly the pages spanning a window", () => {
    ensureRange(0, 199);
    const r = reqs();
    assert.lengthOf(r, 1);
    assert.deepEqual(r[0], {
      kind: "rows-req",
      reqId: 1,
      start: 0,
      end: 199,
      sort: [],
      filters: [],
    });
    const pending = Array.from(__pendingForTests().keys());
    assert.deepEqual(pending, [1]);
  });

  it("bootstraps a full first page from a pageSize-seeded count guess", () => {
    // The host seeds rowCount = pageSize before the real total is known (see
    // BetterDataViewer.INITIAL_ROW_COUNT_GUESS). The grid's initial effect
    // then calls ensureRange(0, min(rowCount-1, pageSize)). If the seed were
    // 1 this would clamp to [0,0], get one row back, mark page 0 "requested",
    // and the page would never be refilled — leaving rows 1..n NULL. The
    // pump must emit a full-page request so the whole first page loads.
    init(200); // rowCount guess == pageSize
    ensureRange(0, Math.min(useStore.getState().rowCount - 1, 200));
    const r = reqs();
    assert.lengthOf(r, 1);
    assert.strictEqual(r[0].start, 0);
    assert.strictEqual(r[0].end, 199);
  });

  it("never re-requests a page already in flight or cached", () => {
    ensureRange(0, 199);
    posted = [];
    ensureRange(0, 199);
    assert.lengthOf(reqs(), 0);
  });

  it("requests one new page when the window grows, not the cached one", () => {
    ensureRange(0, 199);
    posted = [];
    ensureRange(200, 399);
    const r = reqs();
    assert.lengthOf(r, 1);
    assert.strictEqual(r[0].start, 200);
    assert.strictEqual(r[0].end, 399);
  });

  it("aligns requests to page boundaries spanning partial pages", () => {
    ensureRange(150, 250); // spans page 0 (0..199) and page 1 (200..399)
    const r = reqs();
    assert.lengthOf(r, 2);
    assert.strictEqual(r[0].start, 0);
    assert.strictEqual(r[1].start, 200);
  });

  it("does not request anything for an empty or out-of-range table", () => {
    init(0);
    ensureRange(0, 199);
    assert.lengthOf(reqs(), 0);

    init(1000);
    ensureRange(5000, 6000);
    assert.lengthOf(reqs(), 0);
  });

  it("bumping the generation (sort/filter) forces a refetch of cached pages", () => {
    ensureRange(0, 199);
    assert.lengthOf(reqs(), 1);
    useStore.getState().setSort([{ colId: "a", dir: "asc" }]);
    posted = [];
    ensureRange(0, 199);
    assert.lengthOf(reqs(), 1); // refetched because generation changed
  });

  it("applies a matching rows-resp and ignores stale-generation responses", async () => {
    const off = bindPump();
    try {
      ensureRange(0, 199);
      // Progress the current generation by sorting; the prior response is
      // now stale.
      useStore.getState().setSort([{ colId: "a", dir: "asc" }]);
      const reqId = reqs()[0].reqId;

      // Dispatch the stale response — generation no longer matches, so the
      // cache must stay empty.
      windowHandler?.({
        data: {
          kind: "rows-resp",
          reqId,
          start: 0,
          rows: [["x"]],
          rowCount: 1000,
        },
      });
      assert.strictEqual(useStore.getState().rows.size, 0);

      // Re-request on the new generation and dispatch a matching response.
      ensureRange(0, 199);
      const newReq = reqs()[reqs().length - 1];
      windowHandler?.({
        data: {
          kind: "rows-resp",
          reqId: newReq.reqId,
          start: 0,
          rows: [["x"], ["y"]],
          rowCount: 1000,
        },
      });
      assert.strictEqual(useStore.getState().rows.size, 2);
    } finally {
      off();
    }
  });
});
