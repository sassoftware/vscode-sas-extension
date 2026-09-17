// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Header filter popup. Shows the loaded distinct values for the column as
// a checkbox list with a search box, plus a free-form WHERE-expression
// slot for SAS-style server-side filtering when the value list is
// incomplete (large tables).
import { useMemo, useRef, useState } from "react";

import type { ColumnFilter, ColumnMeta } from "../protocol";
import { useStore } from "../store";
import { l10n } from "../theme";
import { useClickOutside } from "../useClickOutside";

interface Props {
  column: ColumnMeta;
  current: ColumnFilter | undefined;
  onClose: () => void;
  /** Position of the filter button (viewport coords) — the popup is portaled
   *  to <body> and anchored here because the RDG header cell clips overflow. */
  anchor: DOMRect;
}

export function FilterPopup({ column, current, onClose, anchor }: Props) {
  const setFilter = useStore((s) => s.setFilter);
  const rows = useStore((s) => s.rows);
  const rowCount = useStore((s) => s.rowCount);
  const columns = useStore((s) => s.columns);
  const colIdx = columns.findIndex((c) => c.id === column.id);

  const distinctValues = useMemo(() => {
    const seen = new Set<string>();
    rows.forEach((row) => {
      const v = row[colIdx];
      if (v !== null && v !== undefined) {
        seen.add(v);
      }
    });
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [rows, colIdx]);

  // The checklist is built from the local row cache, which only holds the
  // pages that have been scrolled past. When some rows are still
  // un-fetched the list is necessarily a sample, not the full distinct
  // set — surface that so the user can fall back to the WHERE expression
  // slot for completeness.
  const isSample = rows.size < rowCount;

  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(current?.values ?? distinctValues),
  );
  const [expr, setExpr] = useState(current?.expr ?? "");
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose);

  const visible = useMemo(
    () =>
      search
        ? distinctValues.filter((v) =>
            v.toLowerCase().includes(search.toLowerCase()),
          )
        : distinctValues,
    [distinctValues, search],
  );

  const toggle = (v: string) => {
    const next = new Set(checked);
    if (next.has(v)) {
      next.delete(v);
    } else {
      next.add(v);
    }
    setChecked(next);
  };

  const apply = () => {
    if (expr.trim()) {
      setFilter(column.id, { colId: column.id, expr: expr.trim() });
    } else if (checked.size === distinctValues.length) {
      setFilter(column.id, null);
    } else {
      setFilter(column.id, { colId: column.id, values: [...checked] });
    }
    onClose();
  };

  const clear = () => {
    setFilter(column.id, null);
    onClose();
  };

  return (
    <div
      className="btv-filter-popup"
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: anchor.bottom + 4,
        right: Math.max(8, window.innerWidth - anchor.right),
      }}
    >
      <div className="btv-filter-section">
        <input
          type="search"
          placeholder={l10n("Search")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="btv-filter-search"
          autoFocus
        />
      </div>
      <div className="btv-filter-list">
        {visible.length === 0 && (
          <div className="btv-filter-empty">
            {l10n("No values loaded yet.")}
          </div>
        )}
        {visible.map((v) => (
          <label key={v} className="btv-filter-item">
            <input
              type="checkbox"
              checked={checked.has(v)}
              onChange={() => toggle(v)}
            />
            <span>{v === "" ? l10n("(empty)") : v}</span>
          </label>
        ))}
      </div>
      {isSample && (
        <div className="btv-filter-warn">
          {l10n(
            "Showing values from loaded rows only — use the WHERE expression below to filter against the full table.",
          )}
        </div>
      )}
      <div className="btv-filter-section">
        <label className="btv-filter-label">{l10n("WHERE expression")}</label>
        <input
          type="text"
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          className="btv-filter-expr"
          placeholder={`${column.name} > 0`}
        />
      </div>
      <div className="btv-filter-actions">
        <button type="button" onClick={clear} className="btv-btn">
          {l10n("Clear")}
        </button>
        <button
          type="button"
          onClick={apply}
          className="btv-btn btv-btn-primary"
        >
          {l10n("Apply")}
        </button>
      </div>
    </div>
  );
}
