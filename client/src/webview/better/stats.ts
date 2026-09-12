// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Selection summary statistics. Computed for whatever cells happen to be
// in the local row cache; cells outside the cache contribute to the total
// count but not to numeric aggregates. mssql does the same.
import { isNumericKind } from "./formatters";
import type { CellRange, ColumnMeta } from "./protocol";
import { cellCount, iterCells } from "./selection";

export interface Stats {
  cellCount: number;
  /** Cells in the selection that have a non-null value AND are loaded. */
  nonNullCount: number;
  /** Distinct non-null loaded values. */
  distinctCount: number;
  nullCount: number;
  /** Sum of numerically-parseable loaded values. */
  sum: number | null;
  avg: number | null;
  min: number | null;
  max: number | null;
}

interface Source {
  ranges: CellRange[];
  columns: ColumnMeta[];
  getCell: (row: number, col: number) => string | null | undefined;
}

export function computeStats({ ranges, columns, getCell }: Source): Stats {
  const total = cellCount(ranges);
  let nullCount = 0;
  let nonNullCount = 0;
  let sum = 0;
  let count = 0;
  let min = Infinity;
  let max = -Infinity;
  const distinct = new Set<string>();
  let allNumeric = true;

  for (const cell of iterCells(ranges)) {
    const v = getCell(cell.row, cell.col);
    if (v === undefined) {
      continue;
    } // not loaded yet
    if (v === null) {
      nullCount++;
      continue;
    }
    nonNullCount++;
    distinct.add(v);

    if (allNumeric && isNumericKind(columns[cell.col]?.kind ?? "unknown")) {
      const n = parseFloat(v);
      if (!Number.isFinite(n)) {
        allNumeric = false;
        continue;
      }
      sum += n;
      count++;
      if (n < min) {
        min = n;
      }
      if (n > max) {
        max = n;
      }
    } else {
      allNumeric = false;
    }
  }

  const numeric = allNumeric && count > 0;
  return {
    cellCount: total,
    nonNullCount,
    distinctCount: distinct.size,
    nullCount,
    sum: numeric ? sum : null,
    avg: numeric ? sum / count : null,
    min: numeric ? min : null,
    max: numeric ? max : null,
  };
}
