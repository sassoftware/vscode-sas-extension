// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Extension-host counterpart of the mssql-style "better" table-viewer
// webview (`webview/better/BetterDataViewer.tsx`). It speaks the
// transport-agnostic protocol in `webview/better/protocol.ts` and:
//
//   - lazily fetches pages from the SAS LibraryAdapter via a PaginatedResultSet
//   - assembles SAS WHERE clauses from the webview's filter state, adapting
//     to the upstream `TableQuery{filterValue}` contract
//   - serves clipboard writes for copy actions
//   - streams CSV / JSON / XLSX exports through a file save dialog
//
// The constructor signature matches the upstream ag-grid `DataViewer`
// (uid + paginator + fetchColumns + column-properties opener), so the
// `DataViewerFactory` can hand the same call site either viewer.
import { Uri, env, l10n, window, workspace } from "vscode";

import type { SortModelItem } from "ag-grid-community";
import { type WriteStream, createWriteStream } from "fs";
import { unlink } from "fs/promises";
import path from "path";

import PaginatedResultSet from "../components/LibraryNavigator/PaginatedResultSet";
import type { TableQuery } from "../components/LibraryNavigator/types";
import type { TableData } from "../components/LibraryNavigator/types";
import type { TableColumn } from "../components/LibraryNavigator/types";
import type {
  CellRange,
  ColumnFilter,
  ColumnMeta,
  ExportFormat,
  ExportScope,
  HostMessage,
  SortSpec,
  ViewState,
  WebviewMessage,
} from "../webview/better/protocol";
import {
  buildSelectionPredicate,
  combineFilters,
  csvCell,
  inSelectionAtCell,
  isWebviewMessage,
  toColumnMeta,
} from "./DataViewerHelpers";
import { WebView } from "./WebviewManager";

const PAGE_SIZE = 200;
/** When `init` happens we don't yet know the row count. We seed the webview
 *  with this so it has *something* to render; the first row response will
 *  carry the real total. */
const INITIAL_ROW_COUNT_GUESS = 1;

class BetterDataViewer extends WebView {
  protected viewState: ViewState = { sort: [], filters: [] };
  /** Column metadata (in display order) once the webview has asked for it.
   *  Cached so we don't pay re-fetch cost on every operation. */
  protected columnMeta: ColumnMeta[] = [];

  public constructor(
    extensionUri: Uri,
    uid: string,
    protected readonly paginator: PaginatedResultSet<{
      data: TableData;
      error?: Error;
    }>,
    protected readonly fetchColumns: () => TableColumn[],
    protected readonly loadColumnProperties: (columnName: string) => void,
  ) {
    super(extensionUri, uid);
  }

  public l10nMessages() {
    return {
      Apply: l10n.t("Apply"),
      Avg: l10n.t("Avg"),
      Clear: l10n.t("Clear"),
      "Clear all filters": l10n.t("Clear all filters"),
      "Clear filters": l10n.t("Clear filters"),
      Close: l10n.t("Close"),
      Copy: l10n.t("Copy"),
      "Copy as CSV": l10n.t("Copy as CSV"),
      "Copy as JSON": l10n.t("Copy as JSON"),
      "Copy as TSV": l10n.t("Copy as TSV"),
      "Copy headers only": l10n.t("Copy headers only"),
      "Copy with headers": l10n.t("Copy with headers"),
      Distinct: l10n.t("Distinct"),
      Export: l10n.t("Export"),
      Filter: l10n.t("Filter"),
      Max: l10n.t("Max"),
      Min: l10n.t("Min"),
      "No values loaded yet.": l10n.t("No values loaded yet."),
      Nulls: l10n.t("Nulls"),
      "(empty)": l10n.t("(empty)"),
      Search: l10n.t("Search"),
      Selected: l10n.t("Selected"),
      "Showing values from loaded rows only — use the WHERE expression below to filter against the full table.":
        l10n.t(
          "Showing values from loaded rows only — use the WHERE expression below to filter against the full table.",
        ),
      "Selection as CSV": l10n.t("Selection as CSV"),
      "Selection as Excel": l10n.t("Selection as Excel"),
      "Selection as JSON": l10n.t("Selection as JSON"),
      Sort: l10n.t("Sort"),
      Sum: l10n.t("Sum"),
      "All rows as CSV": l10n.t("All rows as CSV"),
      "All rows as Excel": l10n.t("All rows as Excel"),
      "All rows as JSON": l10n.t("All rows as JSON"),
      "WHERE expression": l10n.t("WHERE expression"),
      filters: l10n.t("filters"),
      row: l10n.t("row"),
      rows: l10n.t("rows"),
    };
  }

  public styles() {
    return ["BetterDataViewer.css"];
  }

  public scripts() {
    return ["BetterDataViewer.js"];
  }

  public body() {
    return `<div class="data-viewer-container" data-title="${this.title}"></div>`;
  }

  /** Re-fetch the underlying data (e.g. the connection profile changed). */
  public refreshData(): void {
    this.panel.webview.postMessage({ kind: "refresh" });
  }

  public async processMessage(event: unknown): Promise<void> {
    if (!isWebviewMessage(event)) {
      return;
    }
    const msg: WebviewMessage = event;
    try {
      switch (msg.kind) {
        case "ready":
          await this.sendInit();
          return;
        case "rows-req":
          await this.serveRows(msg.reqId, msg);
          return;
        case "copy":
          await env.clipboard.writeText(msg.text);
          return;
        case "open-column-properties":
          // Some flows have no SAS dictionary view to surface; the host
          // simply ignores the request when no provider is wired.
          this.loadColumnProperties(msg.colId);
          return;
        case "save-view-state":
          this.viewState = msg.state;
          return;
        case "export":
          await this.exportTable(msg.format, msg.scope, msg.selection, {
            sort: msg.sort,
            filters: msg.filters,
          });
          return;
      }
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e);
      this.post({ kind: "error", message: text });
      void window.showErrorMessage(text);
    }
  }

  private post(message: HostMessage): void {
    void this.panel.webview.postMessage(message);
  }

  private async sendInit(): Promise<void> {
    const rawColumns = await this.fetchColumns();
    this.columnMeta = rawColumns.map(toColumnMeta);
    this.post({
      kind: "init",
      title: this.title,
      columns: this.columnMeta,
      rowCount: INITIAL_ROW_COUNT_GUESS,
      pageSize: PAGE_SIZE,
      viewState: this.viewState,
    });
  }

  private async serveRows(
    reqId: number,
    req: {
      start: number;
      end: number;
      sort: SortSpec[];
      filters: ColumnFilter[];
    },
  ): Promise<void> {
    const sortModel: SortModelItem[] = req.sort.map((s) => ({
      colId: s.colId,
      sort: s.dir,
    }));
    const query = combineFilters(req.filters);

    const { data, error } = await this.paginator.getData(
      req.start,
      req.end,
      sortModel,
      query,
    );

    if (error) {
      this.post({ kind: "error", reqId, message: error.message });
      return;
    }

    // Adapter rows include an index cell at position 0; strip it so column
    // indices line up with `columnMeta`.
    const rows = data.rows.map((row) => {
      const cells = row.cells ?? [];
      // Treat empty strings as nulls only when the slot is *known* to be
      // blank; we leave non-empty strings exactly as the server sent them.
      const stripped: (string | null)[] = [];
      for (let i = 1; i < cells.length; i++) {
        const v = cells[i];
        stripped.push(v === undefined ? null : v);
      }
      return stripped;
    });

    this.post({
      kind: "rows-resp",
      reqId,
      start: req.start,
      rows,
      rowCount: data.count >= 0 ? data.count : req.start + rows.length,
    });
  }

  private async exportTable(
    format: ExportFormat,
    scope: ExportScope,
    selection: CellRange[] | undefined,
    state: { sort: SortSpec[]; filters: ColumnFilter[] },
  ): Promise<void> {
    const defaultName = `${this.title}.${format === "xlsx" ? "xlsx" : format}`;
    const defaultDir =
      env.remoteName !== undefined &&
      workspace.workspaceFolders &&
      workspace.workspaceFolders.length > 0
        ? workspace.workspaceFolders[0].uri.fsPath
        : "";
    const target = await window.showSaveDialog({
      defaultUri: Uri.file(path.join(defaultDir, defaultName)),
    });
    if (!target) {
      return;
    }

    const sortModel: SortModelItem[] = state.sort.map((s) => ({
      colId: s.colId,
      sort: s.dir,
    }));
    const query = combineFilters(state.filters);
    const cols = this.columnMeta;
    const inSelection = selection
      ? buildSelectionPredicate(selection)
      : () => true;

    // Single try/catch around the entire export: if anything fails we
    // delete the partial file and re-throw so processMessage can post the
    // error to the webview. Without this a mid-stream adapter failure left
    // a half-written file with no signal to the user.
    try {
      if (format === "csv") {
        await this.exportCsv(
          target.fsPath,
          cols,
          sortModel,
          query,
          scope,
          inSelection,
        );
      } else if (format === "json") {
        await this.exportJson(
          target.fsPath,
          cols,
          sortModel,
          query,
          scope,
          selection,
          inSelection,
        );
      } else if (format === "xlsx") {
        await this.exportXlsx(
          target.fsPath,
          cols,
          sortModel,
          query,
          scope,
          selection,
          inSelection,
        );
      }
    } catch (err) {
      try {
        await unlink(target.fsPath);
      } catch {
        // partial file may not exist (failed before first write); ignore
      }
      throw err;
    }
  }

  private async exportCsv(
    fsPath: string,
    cols: ColumnMeta[],
    sortModel: SortModelItem[],
    query: TableQuery | undefined,
    scope: ExportScope,
    inSelection: (row: number) => boolean,
  ): Promise<void> {
    const stream = createWriteStream(fsPath);
    let rowIdx = -1;
    try {
      await writeChunk(
        stream,
        cols.map((c) => csvCell(c.label || c.name)).join(",") + "\n",
      );
      for await (const cells of this.iterAllRows(sortModel, query)) {
        rowIdx++;
        if (scope === "selection" && !inSelection(rowIdx)) {
          continue;
        }
        const out: (string | null)[] = cols.map((_c, i) => cells[i] ?? null);
        await writeChunk(stream, out.map(csvCell).join(",") + "\n");
      }
    } finally {
      await endStream(stream);
    }
  }

  private async exportJson(
    fsPath: string,
    cols: ColumnMeta[],
    sortModel: SortModelItem[],
    query: TableQuery | undefined,
    scope: ExportScope,
    selection: CellRange[] | undefined,
    inSelection: (row: number) => boolean,
  ): Promise<void> {
    const stream = createWriteStream(fsPath);
    let rowIdx = -1;
    let first = true;
    try {
      await writeChunk(stream, "[\n");
      for await (const cells of this.iterAllRows(sortModel, query)) {
        rowIdx++;
        if (scope === "selection" && !inSelection(rowIdx)) {
          continue;
        }
        const obj: Record<string, string> = {};
        for (let i = 0; i < cols.length; i++) {
          if (
            scope === "selection" &&
            selection &&
            !inSelectionAtCell(selection, rowIdx, i)
          ) {
            continue;
          }
          obj[cols[i].name] = cells[i] ?? "";
        }
        if (!first) {
          await writeChunk(stream, ",\n");
        }
        await writeChunk(stream, "  " + JSON.stringify(obj));
        first = false;
      }
      await writeChunk(stream, "\n]\n");
    } finally {
      await endStream(stream);
    }
  }

  private async exportXlsx(
    fsPath: string,
    cols: ColumnMeta[],
    sortModel: SortModelItem[],
    query: TableQuery | undefined,
    scope: ExportScope,
    selection: CellRange[] | undefined,
    inSelection: (row: number) => boolean,
  ): Promise<void> {
    // Dynamic import keeps exceljs out of the cold-path bundle until
    // someone exports xlsx.
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("data");
    ws.addRow(cols.map((c) => c.label || c.name));
    let rowIdx = -1;
    for await (const cells of this.iterAllRows(sortModel, query)) {
      rowIdx++;
      if (scope === "selection" && !inSelection(rowIdx)) {
        continue;
      }
      const out: (string | null)[] = [];
      for (let i = 0; i < cols.length; i++) {
        if (
          scope === "selection" &&
          selection &&
          !inSelectionAtCell(selection, rowIdx, i)
        ) {
          out.push(null);
        } else {
          out.push(cells[i] ?? null);
        }
      }
      ws.addRow(out);
    }
    await wb.xlsx.writeFile(fsPath);
  }

  private async *iterAllRows(
    sortModel: SortModelItem[],
    query: TableQuery | undefined,
  ): AsyncGenerator<string[], void, void> {
    let offset = 0;
    let total = Infinity;
    while (offset < total) {
      const { data, error } = await this.paginator.getData(
        offset,
        offset + PAGE_SIZE - 1,
        sortModel,
        query,
      );
      if (error) {
        throw error;
      }
      if (data.count >= 0) {
        total = data.count;
      }
      if (data.rows.length === 0) {
        break;
      }
      for (const row of data.rows) {
        // Strip the leading index cell that the adapter prepends.
        yield (row.cells ?? []).slice(1);
      }
      offset += data.rows.length;
    }
  }
}

// --------------------------------------------------------------------------
// helpers
// --------------------------------------------------------------------------

/** Write a chunk and wait for `drain` if the stream signals backpressure.
 *  Without this, large exports balloon node's internal buffer and can OOM
 *  on tables with millions of rows. */
function writeChunk(stream: WriteStream, chunk: string): Promise<void> {
  if (stream.write(chunk)) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const onDrain = () => {
      stream.removeListener("error", onError);
      resolve();
    };
    const onError = (err: Error) => {
      stream.removeListener("drain", onDrain);
      reject(err);
    };
    stream.once("drain", onDrain);
    stream.once("error", onError);
  });
}

/** Promisified `stream.end()`. Resolves on close, rejects on error.
 *  Calling twice is safe — node ignores end() after the stream is closed. */
function endStream(stream: WriteStream): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (stream.closed) {
      resolve();
      return;
    }
    stream.once("error", reject);
    stream.end(() => resolve());
  });
}

export default BetterDataViewer;
