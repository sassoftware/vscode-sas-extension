// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Pure helpers shared by `BetterDataViewer.ts`. Extracted into their own
// module so they can be unit-tested in isolation — the panel class
// itself depends on the vscode runtime and is harder to instantiate in
// a unit test.
import type { SortModelItem } from "ag-grid-community";

import type { TableQuery } from "../components/LibraryNavigator/types";
import type { Column } from "../connection/rest/api/compute";
import type {
  CellRange,
  ColumnFilter,
  ColumnKind,
  ColumnMeta,
  SortSpec,
  WebviewMessage,
} from "../webview/better/protocol";

/** Map a SAS-shaped `Column` to the slimmer `ColumnMeta` the webview
 *  protocol uses. Keep this aligned with `protocol.ColumnKind`. */
export function toColumnMeta(c: Column): ColumnMeta {
  const name = c.name ?? c.id ?? "";
  return {
    id: name,
    name,
    label: c.label,
    kind: mapType(c.type),
    length: c.length,
    format: c.format?.name,
  };
}

/** Translate the loose `Column.type` string into the `ColumnKind` enum.
 *  Anything we don't recognise becomes "unknown" so downstream code can
 *  still render the cell as text. */
export function mapType(t: string | undefined): ColumnKind {
  switch ((t || "").toLowerCase()) {
    case "char":
    case "string":
    case "text":
      return "char";
    case "num":
    case "numeric":
    case "double":
    case "integer":
      return "num";
    case "date":
      return "date";
    case "time":
      return "time";
    case "datetime":
    case "dt":
      return "datetime";
    case "currency":
      return "currency";
    default:
      return "unknown";
  }
}

/**
 * Build a SAS WHERE clause for a list of column filters, as a
 * `TableQuery` the upstream adapters already understand.
 *
 * Note: `ColumnFilter.expr` is treated as trusted SAS and concatenated
 * verbatim. The webview surfaces it as an explicit "WHERE expression"
 * input so the user understands they are writing SAS — do not pipe
 * arbitrary inputs into this slot.
 */
export function combineFilters(
  filters: ColumnFilter[],
): TableQuery | undefined {
  const parts: string[] = [];
  for (const f of filters) {
    if (f.expr && f.expr.trim()) {
      parts.push(`(${f.expr.trim()})`);
    } else if (f.values && f.values.length > 0) {
      // Best-effort SAS string-literal escaping — embedded `"` becomes
      // `""`. Numeric columns will not match against double-quoted
      // literals; the `expr` slot exists for those.
      const list = f.values.map((v) => `"${v.replace(/"/g, '""')}"`).join(",");
      parts.push(`(${f.colId} in (${list}))`);
    }
  }
  if (parts.length === 0) {
    return undefined;
  }
  return { filterValue: parts.join(" and ") };
}

/**
 * Map the webview's lightweight `SortSpec` list onto the ag-grid
 * `SortModelItem` contract the upstream `PaginatedResultSet` expects.
 * Kept here (not in the export helpers) because the host uses it both for
 * normal paging and for exports.
 */
export function toSortModel(sort: SortSpec[]): SortModelItem[] {
  return sort.map((s) => ({ colId: s.colId, sort: s.dir }));
}

/** Strip the leading index cell an adapter prepends, mapping undefined to
 *  null so column indices line up with `ColumnMeta`. */
export function stripIndexCell(
  cells: ReadonlyArray<string | null | undefined> | undefined,
): (string | null)[] {
  const out: (string | null)[] = [];
  const n = cells?.length ?? 0;
  for (let i = 1; i < n; i++) {
    const v = cells[i];
    out.push(v === undefined ? null : v);
  }
  return out;
}

/** RFC-4180 cell formatter used by the host-side CSV exporter. */
export function csvCell(v: string | null | undefined): string {
  if (v === null || v === undefined) {
    return "";
  }
  if (
    v.indexOf(",") === -1 &&
    v.indexOf('"') === -1 &&
    v.indexOf("\n") === -1
  ) {
    return v;
  }
  return `"${v.replace(/"/g, '""')}"`;
}

/** Predicate that returns true iff a row index is touched by any of
 *  the selection rectangles. Column membership is ignored — used for
 *  row-level "should I include this row?" decisions. */
export function buildSelectionPredicate(
  selection: CellRange[],
): (row: number) => boolean {
  return (row: number) =>
    selection.some((r) => row >= r.fromRow && row <= r.toRow);
}

/** True iff the cell at (row, col) is contained in any selection
 *  rectangle. */
export function inSelectionAtCell(
  selection: CellRange[],
  row: number,
  col: number,
): boolean {
  for (const r of selection) {
    if (
      row >= r.fromRow &&
      row <= r.toRow &&
      col >= r.fromCol &&
      col <= r.toCol
    ) {
      return true;
    }
  }
  return false;
}

const KNOWN_KINDS = new Set([
  "ready",
  "rows-req",
  "open-column-properties",
  "save-view-state",
  "copy",
  "export",
]);

/** Type guard for incoming messages from the webview. We accept a value
 *  iff it has a `kind` field naming one of the known message types. */
export function isWebviewMessage(value: unknown): value is WebviewMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if (!("kind" in value)) {
    return false;
  }
  const kind = value.kind;
  return typeof kind === "string" && KNOWN_KINDS.has(kind);
}
