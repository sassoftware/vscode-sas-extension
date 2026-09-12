// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// The data pump — turns "I want rows N..M visible" into host requests,
// dropping responses from older generations. One generation per
// sort/filter epoch.
import { nextReqId, onHostMessage, send } from "./messaging";
import { useStore } from "./store";

interface PendingRequest {
  reqId: number;
  generation: number;
  /** The cache page this request was meant to fill. Tracked so error
   *  responses can free the slot for retry. */
  page: number;
}

const pending = new Map<number, PendingRequest>();

/**
 * Request that the page-aligned slice covering [startRow, endRow] (inclusive)
 * be in the local cache. Idempotent — pages already in flight or cached are
 * skipped. Stale responses (older generation) are discarded on arrival.
 */
export function ensureRange(startRow: number, endRow: number): void {
  const s = useStore.getState();
  const { pageSize, requestedPages, rowCount, sort, filters, generation } = s;
  if (rowCount === 0) {
    return;
  }

  const firstPage = Math.max(0, Math.floor(startRow / pageSize));
  const lastPage = Math.min(
    Math.floor((rowCount - 1) / pageSize),
    Math.floor(endRow / pageSize),
  );

  for (let p = firstPage; p <= lastPage; p++) {
    if (requestedPages.has(p)) {
      continue;
    }
    const start = p * pageSize;
    const end = Math.min(rowCount - 1, start + pageSize - 1);
    const reqId = nextReqId();
    pending.set(reqId, { reqId, generation, page: p });
    s.markRequested([p]);
    send({
      kind: "rows-req",
      reqId,
      start,
      end,
      sort,
      filters,
    });
  }
}

/** Hook the pump to incoming host messages. Returns a teardown fn. */
export function bindPump(): () => void {
  return onHostMessage((msg) => {
    if (msg.kind === "rows-resp") {
      const tracked = pending.get(msg.reqId);
      pending.delete(msg.reqId);
      if (!tracked) {
        return;
      }
      const cur = useStore.getState();
      // Drop responses from a stale sort/filter epoch.
      if (tracked.generation !== cur.generation) {
        return;
      }
      cur.applyRows(msg.start, msg.rows, msg.rowCount);
    } else if (msg.kind === "error") {
      if (msg.reqId !== undefined) {
        const tracked = pending.get(msg.reqId);
        pending.delete(msg.reqId);
        // Only release the page slot if this error belongs to the current
        // generation. A stale-generation error refers to a page that's
        // already been invalidated; leaving requestedPages alone is safe.
        if (tracked && tracked.generation === useStore.getState().generation) {
          useStore.setState((s) => {
            const next = new Set(s.requestedPages);
            next.delete(tracked.page);
            return { requestedPages: next };
          });
        }
      }
      useStore.getState().setError(msg.message);
    }
  });
}

/** Forget all in-flight requests. Call when re-initialising. */
export function resetPump(): void {
  pending.clear();
}

/** Test-only window into the pending map. Lets tests assert which
 *  pages are currently in flight without exporting the map itself. */
export function __pendingForTests(): ReadonlyMap<
  number,
  { generation: number; page: number }
> {
  return pending;
}
