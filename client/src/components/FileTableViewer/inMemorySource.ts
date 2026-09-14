// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Wraps a fully-loaded rows-by-columns matrix as a `FileTableSource`. Used
// by the csv/tsv/xlsx readers and by the local (serverless) sas7bdat
// reader.
//
// Sort and filter both work against an "indices view" — a permutation of
// row indices reflecting the currently applied sort+filter combination.
// We rebuild the view only when the (sort, filter) signature changes, so
// scrolling within a sorted/filtered view costs O(end − start) per page
// rather than re-sorting on every request.
import type { SortModelItem } from "ag-grid-community";

import type { Column } from "../../connection/rest/api/compute";
import type {
  TableData,
  TableQuery,
  TableRow,
} from "../LibraryNavigator/types";
import { tryBuildColValueFilter } from "./colValueFilter";
import { inferColumns } from "./typeInfer";
import type { FileTableSource } from "./types";

export class InMemorySource implements FileTableSource {
  /** Indices into `rows` that survive the current filter, in current sort
   *  order. `null` means "no view applied yet — treat as identity". */
  private viewIndices: number[] | null = null;
  private viewSig = "";

  /**
   * @param title Display title (panel tab text).
   * @param uid Stable webview-panel id.
   * @param columns SAS-shaped column metadata, in display order.
   * @param rows Each row's `cells[0]` is a placeholder for the row-number
   *             column the panel strips. Subsequent cells line up with
   *             `columns[0..]`.
   */
  public constructor(
    public readonly title: string,
    public readonly uid: string,
    public readonly columns: Column[],
    private readonly rows: (string | null)[][],
  ) {}

  public get rowCount(): number {
    return this.viewIndices ? this.viewIndices.length : this.rows.length;
  }

  public async getRows(
    start: number,
    end: number,
    sort: SortModelItem[],
    query: TableQuery | undefined,
  ): Promise<TableData> {
    const sig = signature(sort, query);
    if (sig !== this.viewSig) {
      this.viewIndices = this.buildView(sort, query);
      this.viewSig = sig;
    }

    const total = this.rowCount;
    const stop = Math.min(end + 1, total);
    const out: TableRow[] = [];
    for (let i = start; i < stop; i++) {
      const idx = this.viewIndices ? this.viewIndices[i] : i;
      const cells = this.rows[idx].map((c) => (c === null ? "" : c));
      out.push({ cells });
    }
    return { rows: out, count: total };
  }

  private buildView(
    sort: SortModelItem[],
    query: TableQuery | undefined,
  ): number[] | null {
    const raw = (query?.filterValue ?? "").trim();
    const hasFilter = raw.length > 0;
    // The classic viewer sends a single global substring needle, which we
    // apply case-insensitively across every data column (mirroring how
    // server adapters treat the same field). The better viewer instead
    // sends a per-column `in ("a","b")` WHERE clause — parse that into
    // real set-membership filters when we recognise it, so local files
    // filter like the server-backed tables they mirror.
    const colFilter = hasFilter ? tryBuildColValueFilter(raw, this.columns) : null;
    const needle = raw.toLowerCase();

    const indices: number[] = [];
    for (let i = 0; i < this.rows.length; i++) {
      // Strip the leading index placeholder before matching.
      const dataRow = this.rows[i].slice(1);
      if (
        !hasFilter ||
        (colFilter
          ? colFilter(dataRow)
          : dataRow.some((c) => (c ?? "").toLowerCase().includes(needle)))
      ) {
        indices.push(i);
      }
    }

    if (sort.length > 0) {
      const cmps = compileSort(sort, this.columns, this.rows);
      indices.sort((a, b) => {
        for (const cmp of cmps) {
          const r = cmp(a, b);
          if (r !== 0) {
            return r;
          }
        }
        return 0;
      });
    }
    return indices;
  }
}

/** Rows sampled per column when inferring types. */
const TYPE_INFER_SAMPLE = 200;

/**
 * Build an `InMemorySource` from a header row + data rows (each aligned to the
 * headers; missing cells become null). Infers column types from a sample and
 * prepends the leading index placeholder cell the panel strips — the shared
 * tail of the csv / tsv / xlsx readers.
 */
export function buildInMemorySource(
  headers: string[],
  dataRows: (string | null | undefined)[][],
  title: string,
  uid: string,
): InMemorySource {
  const columns = inferColumns(headers, dataRows.slice(0, TYPE_INFER_SAMPLE));
  const cellRows: (string | null)[][] = dataRows.map((r) => {
    const out: (string | null)[] = [""];
    for (let i = 0; i < headers.length; i++) {
      const v = r[i];
      out.push(v === undefined ? null : v);
    }
    return out;
  });
  return new InMemorySource(title, uid, columns, cellRows);
}

type Cmp = (a: number, b: number) => number;

function compileSort(
  sort: SortModelItem[],
  columns: Column[],
  rows: (string | null)[][],
): Cmp[] {
  const cmps: Cmp[] = [];
  for (const s of sort) {
    const dataIdx = columns.findIndex(
      (c) => c.id === s.colId || c.name === s.colId,
    );
    if (dataIdx < 0) {
      continue;
    }
    const isNumeric = isNumericKind(columns[dataIdx]?.type);
    const cellIdx = dataIdx + 1; // +1 for the leading index placeholder
    const dir = s.sort === "asc" ? 1 : -1;
    cmps.push((a, b) => {
      const va = rows[a][cellIdx];
      const vb = rows[b][cellIdx];
      // Treat null and empty string as equivalent missing values; sort
      // them last regardless of direction (mssql does the same).
      if (va === null || va === "") {
        return vb === null || vb === "" ? 0 : 1;
      }
      if (vb === null || vb === "") {
        return -1;
      }
      // Both va and vb are now non-empty strings.
      if (isNumeric) {
        const na = parseFloat(va);
        const nb = parseFloat(vb);
        if (Number.isNaN(na) && Number.isNaN(nb)) {
          return 0;
        }
        if (Number.isNaN(na)) {
          return 1;
        }
        if (Number.isNaN(nb)) {
          return -1;
        }
        return (na - nb) * dir;
      }
      return va.localeCompare(vb) * dir;
    });
  }
  return cmps;
}

function isNumericKind(type: string | undefined): boolean {
  const t = (type || "").toLowerCase();
  // Local sources only ever produce "num" (sas7bdat) and
  // num/date/datetime (typeInfer), so those are the kinds we sort numerically.
  return t === "num" || t === "date" || t === "datetime";
}

function signature(
  sort: SortModelItem[],
  query: TableQuery | undefined,
): string {
  const sortKey = sort.map((s) => `${s.colId}:${s.sort}`).join(",");
  const filterKey = query?.filterValue ?? "";
  return `${sortKey}#${filterKey}`;
}
