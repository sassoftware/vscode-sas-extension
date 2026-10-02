// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Build copy-to-clipboard text from the current selection, in each of the
// supported formats. Returns ready-to-write strings.
import { csvCell } from "../../panels/DataViewerHelpers";
import type { CellRange, ColumnMeta, CopyFormat } from "./protocol";
import { bounds, cellKey, iterCells } from "./selection";

interface CopySource {
  selection: CellRange[];
  columns: ColumnMeta[];
  /** Returns the cell value or null if the row hasn't been fetched yet. */
  getCell: (row: number, col: number) => string | null | undefined;
}

interface RowMatrix {
  /** Column ids (in display order) covered by the selection bounding box. */
  cols: ColumnMeta[];
  /** Row index → array of cell strings (length === cols.length). null for
   *  cells that fell outside the selection or weren't fetched. */
  rows: Array<Array<string | null>>;
}

function materialise(src: CopySource): RowMatrix {
  const b = bounds(src.selection);
  if (!b) {
    return { cols: [], rows: [] };
  }

  const cols = src.columns.slice(b.fromCol, b.toCol + 1);
  const rows: Array<Array<string | null>> = [];

  // Pre-build a sparse map of selected cells so we know which fall inside
  // a non-rectangular union.
  const selected = new Set<string>();
  for (const cell of iterCells(src.selection)) {
    selected.add(cellKey(cell.row, cell.col));
  }

  for (let r = b.fromRow; r <= b.toRow; r++) {
    const row: Array<string | null> = [];
    let any = false;
    for (let c = b.fromCol; c <= b.toCol; c++) {
      if (!selected.has(cellKey(r, c))) {
        row.push(null);
        continue;
      }
      const v = src.getCell(r, c);
      row.push(v ?? null);
      any = true;
    }
    if (any) {
      rows.push(row);
    }
  }
  return { cols, rows };
}

function joinCsvRow(cells: Array<string | null>): string {
  return cells.map((c) => (c === null ? "" : csvCell(c))).join(",");
}

/** Tab-separated row. Cells containing tabs, CR/LF, or double quotes are
 *  wrapped in double quotes with internal quotes doubled — matching the
 *  way mssql exports TSV. The naive approach (replacing the offending
 *  characters with spaces) was lossy and silently corrupted multi-line
 *  text content on copy. */
function tsvEscape(v: string): string {
  if (
    v.indexOf("\t") === -1 &&
    v.indexOf("\r") === -1 &&
    v.indexOf("\n") === -1 &&
    v.indexOf('"') === -1
  ) {
    return v;
  }
  return `"${v.replace(/"/g, '""')}"`;
}

function joinTabRow(cells: Array<string | null>): string {
  return cells.map((c) => (c === null ? "" : tsvEscape(c))).join("\t");
}

function headerRow(cols: ColumnMeta[]): string[] {
  return cols.map((c) => c.label || c.name);
}

export function buildCopyText(format: CopyFormat, src: CopySource): string {
  if (format === "headers-only") {
    return headerRow(src.columns).join("\t");
  }
  const m = materialise(src);
  if (m.rows.length === 0) {
    return "";
  }

  const header = headerRow(m.cols).join("\t");
  switch (format) {
    case "plain":
      return m.rows.map(joinTabRow).join("\n");

    case "with-headers":
      return [header, ...m.rows.map(joinTabRow)].join("\n");

    case "csv":
      return [
        headerRow(m.cols).map(csvCell).join(","),
        ...m.rows.map(joinCsvRow),
      ].join("\n");

    case "json": {
      const arr = m.rows.map((row) => {
        const obj: Record<string, string | null> = {};
        for (let i = 0; i < m.cols.length; i++) {
          obj[m.cols[i].name] = row[i];
        }
        return obj;
      });
      return JSON.stringify(arr, null, 2);
    }
  }
}
