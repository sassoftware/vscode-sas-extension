// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Per-cell renderer used by react-data-grid. Subscribes to the selection
// slice of the store so the highlight survives virtualisation re-renders
// (an imperative class toggle would lose styling as react-data-grid
// recycles cells on scroll).
import { displayValue, isNumericKind } from "../formatters";
import type { ColumnKind } from "../protocol";
import { containsCell } from "../selection";
import { useStore } from "../store";

interface Props {
  row: number;
  col: number;
  kind: ColumnKind;
}

export function CellView({ row, col, kind }: Props) {
  // Per-cell selectors: zustand re-renders only when this cell's specific
  // value or selection state changes. react-data-grid virtualises rendering
  // so only viewport cells subscribe — the cost stays bounded by what's
  // visible, not by total row count.
  const value = useStore((s) => {
    const r = s.rows.get(row);
    return r ? r[col] : undefined;
  });
  const selected = useStore((s) => containsCell(s.selection, row, col));
  const v = value === undefined ? null : value;
  const { text, isNull, truncated } = displayValue(v);
  const cls = [
    "btv-cell",
    isNull && "btv-cell-null",
    isNumericKind(kind) && "btv-cell-num",
    selected && "btv-cell-selected",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} title={truncated && v ? v : undefined}>
      {text}
    </div>
  );
}
