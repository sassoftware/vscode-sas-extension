// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Pure, unit-testable export plumbing for the "better" table viewer.
//
// The vscode-coupled `BetterDataViewer` host feeds a row stream through
// `selectExportRows`, which applies the export scope (all / visible /
// selection) and marks which individual cells fall inside the selection.
// Per-row formatters (`formatCsvHeader`, `formatCsvCells`,
// `toJsonRecord`) turn each row into its CSV/JSON fragment without
// materialising the whole table — the host still streams one row at a
// time, so multi-million-row exports stay memory-bounded. Keeping this
// logic pure means export correctness is covered by ordinary mocha tests
// instead of needing a live webview.
import type {
  CellRange,
  ColumnMeta,
  ExportScope,
} from "../webview/better/protocol";
import {
  buildSelectionPredicate,
  csvCell,
  inSelectionAtCell,
} from "./DataViewerHelpers";

export interface ExportCell {
  /** Raw cell value; null means the underlying cell is blank/undecoded. */
  value: string | null;
  /** True when the cell is excluded by selection scoping (never exported). */
  excluded: boolean;
}

/** Header labels in display order (label, falling back to name). */
export function exportHeaders(cols: ColumnMeta[]): string[] {
  return cols.map((c) => c.label || c.name);
}

/** Stable column names in display order — used as JSON object keys. */
export function exportKeys(cols: ColumnMeta[]): string[] {
  return cols.map((c) => c.name);
}

/**
 * Yield one `ExportCell[]` per exported row, applying the export scope:
 *   - `all` / `visible` — every row, every cell included.
 *   - `selection` — rows outside the selection's row span are dropped;
 *     cells outside its column span are marked `excluded` so serialisers
 *     can emit them as blank/null (all three formats agree on this,
 *     matching mssql).
 * Rows stream in the caller's iteration order (offset ascending), so the
 * host can write chunks incrementally.
 */
export async function* selectExportRows(
  cols: ColumnMeta[],
  scope: ExportScope,
  selection: CellRange[] | undefined,
  rows: AsyncIterable<string[]> | Iterable<string[]>,
): AsyncGenerator<ExportCell[], void, void> {
  const inSelection =
    scope === "selection" && selection !== undefined
      ? buildSelectionPredicate(selection)
      : null;
  let rowIdx = -1;
  for await (const cells of rows) {
    rowIdx++;
    if (inSelection !== null && !inSelection(rowIdx)) {
      continue;
    }
    const out: ExportCell[] = new Array(cols.length);
    for (let i = 0; i < cols.length; i++) {
      const excluded =
        scope === "selection" &&
        selection !== undefined &&
        !inSelectionAtCell(selection, rowIdx, i);
      out[i] = { value: cells[i] ?? null, excluded };
    }
    yield out;
  }
}

/** CSV header line (RFC-4180-esque, matching the platform's csvCell). */
export function formatCsvHeader(headers: string[]): string {
  return headers.map(csvCell).join(",");
}

/** One CSV data line from an exported row. Excluded cells become empty. */
export function formatCsvCells(cells: ExportCell[]): string {
  return cells.map((c) => csvCell(c.excluded ? "" : (c.value ?? ""))).join(",");
}

/**
 * The JSON object for one exported row, keyed by column name. Cells
 * excluded by selection scoping are omitted from the object entirely
 * (not emitted as null) — mirroring the mssql exporter.
 */
export function toJsonRecord(
  keys: string[],
  cells: ExportCell[],
): Record<string, string | null> {
  const obj: Record<string, string | null> = {};
  for (let i = 0; i < keys.length; i++) {
    if (cells[i].excluded) {
      continue;
    }
    obj[keys[i]] = cells[i].value ?? "";
  }
  return obj;
}
