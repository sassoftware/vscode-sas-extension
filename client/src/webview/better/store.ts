// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Zustand store for the table viewer. Holds:
//   - column metadata, total row count, page size
//   - sparse row cache keyed by absolute row index
//   - currently applied sort and per-column filters
//   - cell selection (a list of disjoint inclusive rectangles)
//   - request generation (used to invalidate in-flight responses)
//   - error toast state
//
// The store does NOT issue host requests itself. The component layer owns
// I/O — this keeps the store easy to reason about in isolation.
import { create } from "zustand";

import type { CellRange, ColumnFilter, ColumnMeta, SortSpec } from "./protocol";

export type RowMap = Map<number, (string | null)[]>;

export interface State {
  title: string;
  columns: ColumnMeta[];
  rowCount: number;
  pageSize: number;

  rows: RowMap;
  /** Pages we have already requested (page = floor(rowIndex / pageSize)). */
  requestedPages: Set<number>;

  sort: SortSpec[];
  filters: ColumnFilter[];

  /** Bumped on sort/filter change so stale row responses can be discarded. */
  generation: number;

  selection: CellRange[];
  /** Anchor used for shift-click range extension. */
  selectionAnchor: { row: number; col: number } | null;

  loading: boolean;
  error: string | null;

  cellDetail: { row: number; col: number } | null;
}

export interface Actions {
  init(payload: {
    title: string;
    columns: ColumnMeta[];
    rowCount: number;
    pageSize: number;
    sort?: SortSpec[];
    filters?: ColumnFilter[];
  }): void;

  /** Apply a fetched range of rows. `start` is the absolute row index of the
   *  first row in `rows`. Caller must have already filtered out stale
   *  responses by checking `generation`. */
  applyRows(start: number, rows: (string | null)[][], rowCount: number): void;

  markRequested(pages: number[]): void;

  setSort(sort: SortSpec[]): void;
  setFilter(colId: string, filter: ColumnFilter | null): void;
  clearFilters(): void;
  /** Re-fetch all data (e.g. the underlying SQL connection changed). Keeps
   *  current sort/filters but clears cached rows so they reload. */
  refresh(): void;

  setSelection(ranges: CellRange[]): void;
  setAnchor(p: { row: number; col: number } | null): void;

  setLoading(b: boolean): void;
  setError(msg: string | null): void;
  setCellDetail(p: { row: number; col: number } | null): void;
}

export const useStore = create<State & Actions>((set) => ({
  title: "",
  columns: [],
  rowCount: 0,
  pageSize: 200,
  rows: new Map(),
  requestedPages: new Set(),
  sort: [],
  filters: [],
  generation: 0,
  selection: [],
  selectionAnchor: null,
  loading: false,
  error: null,
  cellDetail: null,

  init: ({ title, columns, rowCount, pageSize, sort, filters }) =>
    set({
      title,
      columns,
      rowCount,
      pageSize,
      sort: sort ?? [],
      filters: filters ?? [],
      rows: new Map(),
      requestedPages: new Set(),
      generation: 1,
      selection: [],
      selectionAnchor: null,
      // Re-init means a fresh session: clear any inherited spinner or
      // error toast left over from the previous panel state.
      loading: false,
      error: null,
      cellDetail: null,
    }),

  applyRows: (start, rows, rowCount) =>
    set((s) => {
      const next = new Map(s.rows);
      for (let i = 0; i < rows.length; i++) {
        next.set(start + i, rows[i]);
      }
      return { rows: next, rowCount };
    }),

  markRequested: (pages) =>
    set((s) => {
      const next = new Set(s.requestedPages);
      for (const p of pages) {
        next.add(p);
      }
      return { requestedPages: next };
    }),

  setSort: (sort) =>
    set((s) => ({
      sort,
      rows: new Map(),
      requestedPages: new Set(),
      generation: s.generation + 1,
    })),

  setFilter: (colId, filter) =>
    set((s) => {
      const others = s.filters.filter((f) => f.colId !== colId);
      const next = filter ? [...others, filter] : others;
      return {
        filters: next,
        rows: new Map(),
        requestedPages: new Set(),
        generation: s.generation + 1,
      };
    }),

  clearFilters: () =>
    set((s) => ({
      filters: [],
      rows: new Map(),
      requestedPages: new Set(),
      generation: s.generation + 1,
    })),

  refresh: () =>
    set((s) => ({
      rows: new Map(),
      requestedPages: new Set(),
      selection: [],
      selectionAnchor: null,
      generation: s.generation + 1,
    })),

  setSelection: (selection) => set({ selection }),
  setAnchor: (selectionAnchor) => set({ selectionAnchor }),

  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setCellDetail: (cellDetail) => set({ cellDetail }),
}));
