// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Selection helpers. A selection is a list of disjoint inclusive
// rectangles in (row, col) data-coordinate space.
import type { CellRange } from "./protocol";

export function singleCell(row: number, col: number): CellRange[] {
  return [{ fromRow: row, toRow: row, fromCol: col, toCol: col }];
}

export function rectFromTo(
  a: { row: number; col: number },
  b: { row: number; col: number },
): CellRange {
  return {
    fromRow: Math.min(a.row, b.row),
    toRow: Math.max(a.row, b.row),
    fromCol: Math.min(a.col, b.col),
    toCol: Math.max(a.col, b.col),
  };
}

export function containsCell(
  ranges: CellRange[],
  row: number,
  col: number,
): boolean {
  for (const r of ranges) {
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

export function toggleCell(
  ranges: CellRange[],
  row: number,
  col: number,
): CellRange[] {
  if (containsCell(ranges, row, col)) {
    // Remove every range that wholly covers this single cell. We do not
    // attempt to fragment overlapping rectangles — that's a UX rabbit-hole
    // and mssql doesn't either.
    return ranges.filter(
      (r) =>
        !(
          row >= r.fromRow &&
          row <= r.toRow &&
          col >= r.fromCol &&
          col <= r.toCol
        ),
    );
  }
  return [...ranges, { fromRow: row, toRow: row, fromCol: col, toCol: col }];
}

/** Stable string key for a cell coordinate. Used to dedupe across
 *  overlapping selection rectangles. A pipe is fine — column indices and
 *  row indices are non-negative integers. */
export function cellKey(row: number, col: number): string {
  return row + "|" + col;
}

/** All (row, col) pairs covered by `ranges`, ordered row-major, with no
 *  duplicates from overlapping rectangles. Caller should guard against
 *  pathologically huge selections. */
export function iterCells(
  ranges: CellRange[],
): Array<{ row: number; col: number }> {
  const seen = new Set<string>();
  const cells: Array<{ row: number; col: number }> = [];
  for (const r of ranges) {
    for (let row = r.fromRow; row <= r.toRow; row++) {
      for (let col = r.fromCol; col <= r.toCol; col++) {
        const key = cellKey(row, col);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        cells.push({ row, col });
      }
    }
  }
  cells.sort((a, b) => a.row - b.row || a.col - b.col);
  return cells;
}

export function cellCount(ranges: CellRange[]): number {
  let n = 0;
  for (const r of ranges) {
    n += (r.toRow - r.fromRow + 1) * (r.toCol - r.fromCol + 1);
  }
  return n;
}

/** Bounding rectangle of all ranges, or null when empty. */
export function bounds(ranges: CellRange[]): CellRange | null {
  if (ranges.length === 0) {
    return null;
  }
  let fromRow = Infinity,
    toRow = -Infinity,
    fromCol = Infinity,
    toCol = -Infinity;
  for (const r of ranges) {
    if (r.fromRow < fromRow) {
      fromRow = r.fromRow;
    }
    if (r.toRow > toRow) {
      toRow = r.toRow;
    }
    if (r.fromCol < fromCol) {
      fromCol = r.fromCol;
    }
    if (r.toCol > toCol) {
      toCol = r.toCol;
    }
  }
  return { fromRow, toRow, fromCol, toCol };
}
