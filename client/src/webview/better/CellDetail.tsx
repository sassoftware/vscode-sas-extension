// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Side panel that shows the full content of a single cell. Triggered by
// double-click on a cell. Auto-detects JSON/XML and pretty-prints them.
// This is an addition over upstream mssql, which only shows truncated
// values with a hover tooltip.
import { useMemo } from "react";

import { detectContent, prettifyJSON, prettifyXML } from "./formatters";
import { useStore } from "./store";
import { l10n } from "./theme";

export function CellDetail() {
  const cellDetail = useStore((s) => s.cellDetail);
  const setCellDetail = useStore((s) => s.setCellDetail);
  const columns = useStore((s) => s.columns);
  const rowsMap = useStore((s) => s.rows);

  if (!cellDetail) {
    return null;
  }

  const { row, col } = cellDetail;
  const column = columns[col];
  const value = rowsMap.get(row)?.[col];

  return (
    <CellDetailBody
      row={row}
      columnName={column?.label || column?.name || ""}
      value={value}
      onClose={() => setCellDetail(null)}
    />
  );
}

interface BodyProps {
  row: number;
  columnName: string;
  value: string | null | undefined;
  onClose: () => void;
}

function CellDetailBody({ row, columnName, value, onClose }: BodyProps) {
  const formatted = useMemo(() => {
    if (value === null || value === undefined) {
      return { text: "NULL", kind: "text" as const };
    }
    const kind = detectContent(value);
    if (kind === "json") {
      return { text: prettifyJSON(value), kind };
    }
    if (kind === "xml") {
      return { text: prettifyXML(value), kind };
    }
    return { text: value, kind };
  }, [value]);

  return (
    <div className="btv-celldetail">
      <div className="btv-celldetail-head">
        <span className="btv-celldetail-title">
          {columnName} · {l10n("row")} {row + 1}
          {formatted.kind !== "text" && (
            <span className="btv-celldetail-badge">
              {formatted.kind.toUpperCase()}
            </span>
          )}
        </span>
        <button
          type="button"
          className="btv-btn"
          onClick={onClose}
          aria-label={l10n("Close")}
        >
          ×
        </button>
      </div>
      <pre className="btv-celldetail-body">{formatted.text}</pre>
    </div>
  );
}
