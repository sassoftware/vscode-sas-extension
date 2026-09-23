// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Wire protocol between the extension host (`panels/DataViewer.ts`) and
// the table-viewer webview. Designed to be transport-agnostic: every
// message is a discriminated union by `kind`. Requests carry a numeric
// `reqId`; matching responses echo it. Notifications have no `reqId`.

export type SortDir = "asc" | "desc";

export interface SortSpec {
  /** Stable column id (matches `ColumnMeta.id`). */
  colId: string;
  dir: SortDir;
}

/**
 * One column's worth of filter state. Either a checklist of allowed values
 * (`values`) for fast in-memory inclusion checks, or a free-form SAS
 * WHERE-clause fragment (`expr`). At most one of the two is used; the
 * webview prefers `values` when both are present.
 *
 * NOTE: `expr` is treated as trusted and concatenated into the WHERE
 * clause sent to the SAS server with no sanitisation. The webview
 * surfaces it as an explicit "WHERE expression" input so the user
 * understands they are writing SAS — do not pipe arbitrary inputs into
 * this slot.
 */
export interface ColumnFilter {
  colId: string;
  values?: string[];
  expr?: string;
}

export type ColumnKind =
  "char" | "num" | "date" | "time" | "datetime" | "currency" | "unknown";

export interface ColumnMeta {
  id: string;
  name: string;
  label?: string;
  kind: ColumnKind;
  length?: number;
  format?: string;
}

/**
 * Inclusive cell-range. Row/column indices are 0-based and exclude the
 * row-number gutter. A selection is a set of disjoint rectangles — the
 * webview merges overlaps before sending.
 */
export interface CellRange {
  fromRow: number;
  toRow: number;
  fromCol: number;
  toCol: number;
}

export type CopyFormat =
  | "plain" // tab-separated cells, newline-separated rows
  | "with-headers" // headers + tab-separated cells
  | "headers-only" // just the column headers
  | "csv"
  | "json";

export type ExportFormat = "csv" | "json" | "xlsx";
export type ExportScope = "visible" | "selection" | "all";

export interface ViewState {
  sort: SortSpec[];
  filters: ColumnFilter[];
  columnWidths?: Record<string, number>;
  columnOrder?: string[];
}

// --------------------------------------------------------------------------
// host → webview
// --------------------------------------------------------------------------

export type HostMessage =
  InitMessage | RowsResponseMessage | ErrorMessage | RefreshMessage;

export interface InitMessage {
  kind: "init";
  title: string;
  columns: ColumnMeta[];
  rowCount: number;
  /** Initial chunk size hint; the pump will request this many rows per call. */
  pageSize: number;
  viewState?: ViewState;
}

export interface RowsResponseMessage {
  kind: "rows-resp";
  reqId: number;
  /** Cells encoded as strings or null. Rows correspond to absolute indices
   *  [start, start + rows.length). */
  rows: (string | null)[][];
  start: number;
  /** Updated total row count after filtering on the host side. */
  rowCount: number;
}

export interface ErrorMessage {
  kind: "error";
  reqId?: number;
  message: string;
}

export interface RefreshMessage {
  kind: "refresh";
}

// --------------------------------------------------------------------------
// webview → host
// --------------------------------------------------------------------------

export type WebviewMessage =
  | ReadyMessage
  | RowsRequestMessage
  | OpenColumnPropertiesMessage
  | SaveViewStateMessage
  | CopyMessage
  | ExportMessage;

export interface ReadyMessage {
  kind: "ready";
}

export interface RowsRequestMessage {
  kind: "rows-req";
  reqId: number;
  start: number;
  /** Inclusive end-row index. */
  end: number;
  sort: SortSpec[];
  filters: ColumnFilter[];
}

export interface OpenColumnPropertiesMessage {
  kind: "open-column-properties";
  colId: string;
}

export interface SaveViewStateMessage {
  kind: "save-view-state";
  state: ViewState;
}

export interface CopyMessage {
  kind: "copy";
  format: CopyFormat;
  /** Already materialised by the webview. Host just writes it to clipboard. */
  text: string;
}

export interface ExportMessage {
  kind: "export";
  format: ExportFormat;
  scope: ExportScope;
  /** Selection ranges in webview coordinates (row index 0 is the first
   *  data row, not the header). Required when scope === "selection". */
  selection?: CellRange[];
  /** Snapshot of currently applied sort/filter; the host re-fetches data
   *  using these so the export reflects the visible view. */
  sort: SortSpec[];
  filters: ColumnFilter[];
}
