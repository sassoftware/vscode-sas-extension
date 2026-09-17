// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { ColumnMeta, SortSpec } from "../protocol";
import { useStore } from "../store";
import { l10n } from "../theme";
import { FilterPopup } from "./FilterPopup";

interface Props {
  column: ColumnMeta;
}

type SortDir = SortSpec["dir"];
/** mssql-style three-state sort cycle: asc → desc → off. */
function nextSortDir(current: SortDir | undefined): SortDir | null {
  if (current === undefined) {
    return "asc";
  }
  if (current === "asc") {
    return "desc";
  }
  return null;
}

export function HeaderCell({ column }: Props) {
  const sort = useStore((s) => s.sort);
  const filters = useStore((s) => s.filters);
  const setSort = useStore((s) => s.setSort);
  const [filterOpen, setFilterOpen] = useState(false);
  // Snapshot of the filter button's position when the popup opens. The
  // popup is rendered through a portal to <body> (the RDG header cell clips
  // `overflow`), so we anchor it with fixed positioning from this rect.
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  const current = sort.find((s) => s.colId === column.id);
  const filter = filters.find((f) => f.colId === column.id);

  const onSortClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = nextSortDir(current?.dir);
    if (next === null) {
      // Remove this column from the sort.
      setSort(sort.filter((s) => s.colId !== column.id));
    } else {
      // Single-column sort, like mssql.
      setSort([{ colId: column.id, dir: next }]);
    }
  };

  const onFilterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnchor(filterBtnRef.current?.getBoundingClientRect() ?? null);
    setFilterOpen((b) => !b);
  };

  return (
    <div className="btv-header" title={column.label || column.name}>
      <span className="btv-header-name" onClick={onSortClick}>
        {column.label || column.name}
      </span>
      {current && (
        <span className="btv-header-sort" aria-label={l10n("Sort")}>
          {current.dir === "asc" ? "▲" : "▼"}
        </span>
      )}
      <button
        type="button"
        ref={filterBtnRef}
        className={
          "btv-header-filter" + (filter ? " btv-header-filter-on" : "")
        }
        onClick={onFilterClick}
        title={l10n("Filter")}
      >
        ⚲
      </button>
      {filterOpen &&
        anchor &&
        createPortal(
          <FilterPopup
            column={column}
            current={filter}
            onClose={() => setFilterOpen(false)}
            anchor={anchor}
          />,
          document.body,
        )}
    </div>
  );
}
