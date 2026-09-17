// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Pure helpers for Grid.tsx. The Grid component is glue between
// react-data-grid's callbacks and the zustand store; the actual
// decisions (which selection rectangle to produce, which range of
// rows to prefetch, what copy text to build for Ctrl+C) live here so
// they can be unit-tested without rendering the grid through jsdom.
import { buildCopyText } from "../copy";
import type {
  CellRange,
  ColumnMeta,
  CopyFormat,
  WebviewMessage,
} from "../protocol";
import { rectFromTo, singleCell, toggleCell } from "../selection";

export interface ClickInputs {
  /** Data-row index of the clicked cell. */
  row: number;
  /** Data-column index (0-based, excludes the row-number gutter). */
  col: number;
  /** True iff the user clicked the row-number gutter. */
  isRowGutter: boolean;
  /** Modifier-key snapshot from the click event. */
  shift: boolean;
  ctrlOrMeta: boolean;
  /** Total number of data columns; used to size whole-row selection. */
  columnCount: number;
  /** Current selection state. */
  selection: CellRange[];
  /** Current shift-anchor; null when the user hasn't clicked yet. */
  anchor: { row: number; col: number } | null;
}

export interface ClickResult {
  selection: CellRange[];
  anchor: { row: number; col: number };
}

/**
 * Resolve a cell-click event to the next selection state. Pure: every
 * input is in the parameter object and the result is the new selection
 * + anchor. The Grid component is responsible for plumbing that result
 * back to the store.
 *
 * Behaviour:
 *   - Click on the row-number gutter selects the entire row.
 *   - Shift-click + existing anchor → rectangle from anchor to target.
 *   - Ctrl/Cmd-click toggles the cell in the existing selection.
 *   - Plain click → single-cell selection at the target.
 */
export function resolveCellClick(input: ClickInputs): ClickResult {
  const { row, col, isRowGutter, shift, ctrlOrMeta, columnCount } = input;

  if (isRowGutter) {
    return {
      selection: [
        { fromRow: row, toRow: row, fromCol: 0, toCol: columnCount - 1 },
      ],
      anchor: { row, col: 0 },
    };
  }

  if (shift && input.anchor) {
    return {
      selection: [rectFromTo(input.anchor, { row, col })],
      anchor: input.anchor,
    };
  }

  if (ctrlOrMeta) {
    return {
      selection: toggleCell(input.selection, row, col),
      anchor: { row, col },
    };
  }

  return {
    selection: singleCell(row, col),
    anchor: { row, col },
  };
}

/**
 * Compute the row-index window the prefetch pump should ensure, given
 * the current scroll-container metrics. Returns inclusive `[from, to]`
 * clamped to the row count.
 */
export function visibleRange(
  scrollTop: number,
  clientHeight: number,
  rowHeight: number,
  rowCount: number,
): { from: number; to: number } {
  const first = Math.floor(scrollTop / rowHeight);
  const visible = Math.ceil(clientHeight / rowHeight);
  const buffer = visible; // pre-load one screenful either side
  return {
    from: Math.max(0, first - buffer),
    to: Math.min(rowCount - 1, first + visible + buffer),
  };
}

/** Predicate flagging a Ctrl/Cmd+C event regardless of platform. */
export function isCopyShortcut(e: KeyboardEvent): boolean {
  return (
    (e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "c" || e.key === "C")
  );
}

/** Predicate flagging a Ctrl/Cmd+A event. */
export function isSelectAllShortcut(e: KeyboardEvent): boolean {
  return (e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A");
}

export interface CopyShortcutInputs {
  selection: CellRange[];
  columns: ColumnMeta[];
  getCell: (row: number, col: number) => string | null | undefined;
  /** True when the user held Shift in addition to Ctrl/Cmd. */
  withHeaders: boolean;
}

/**
 * Build the `copy` message that Ctrl/Cmd+C should post to the host.
 * Returns `null` when the selection is empty (nothing to copy).
 *
 * Default format is plain TSV (mssql parity); shift-modifier upgrades
 * to TSV with a header row. The `format` field on the wire is always
 * `"plain"` because the host doesn't redo the formatting — it just
 * writes `text` to the clipboard.
 */
export function buildCopyShortcutMessage(
  input: CopyShortcutInputs,
): (WebviewMessage & { kind: "copy" }) | null {
  if (input.selection.length === 0) {
    return null;
  }
  const fmt: CopyFormat = input.withHeaders ? "with-headers" : "plain";
  const text = buildCopyText(fmt, {
    selection: input.selection,
    columns: input.columns,
    getCell: input.getCell,
  });
  return { kind: "copy", format: "plain", text };
}

/** Build the "select-all" rectangle covering every cell in the table. */
export function buildSelectAll(
  rowCount: number,
  columnCount: number,
): CellRange[] | null {
  if (rowCount <= 0 || columnCount <= 0) {
    return null;
  }
  return [
    { fromRow: 0, toRow: rowCount - 1, fromCol: 0, toCol: columnCount - 1 },
  ];
}
