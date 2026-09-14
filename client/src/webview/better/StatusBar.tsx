// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useMemo } from "react";

import { computeStats } from "./stats";
import { useStore } from "./store";
import { l10n } from "./theme";

function fmt(n: number): string {
  if (!Number.isFinite(n)) {
    return "—";
  }
  if (Math.abs(n) >= 1e9 || (n !== 0 && Math.abs(n) < 1e-3)) {
    return n.toExponential(4);
  }
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

export function StatusBar() {
  const rowCount = useStore((s) => s.rowCount);
  const filters = useStore((s) => s.filters);
  const selection = useStore((s) => s.selection);
  const columns = useStore((s) => s.columns);
  const rowsMap = useStore((s) => s.rows);
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const setError = useStore((s) => s.setError);

  const stats = useMemo(
    () =>
      selection.length === 0
        ? null
        : computeStats({
            ranges: selection,
            columns,
            getCell: (r, c) => rowsMap.get(r)?.[c] ?? undefined,
          }),
    [selection, columns, rowsMap],
  );

  return (
    <div className="btv-statusbar" role="status">
      <span className="btv-status-left">
        {loading && <span className="btv-spinner" aria-hidden="true" />}
        <span>
          {rowCount.toLocaleString()} {l10n("rows")}
          {filters.length > 0 ? ` · ${filters.length} ${l10n("filters")}` : ""}
        </span>
      </span>
      {stats && (
        <span className="btv-status-stats">
          <span>
            {l10n("Selected")}: {stats.cellCount.toLocaleString()}
          </span>
          {stats.distinctCount > 0 && (
            <span>
              · {l10n("Distinct")}: {stats.distinctCount.toLocaleString()}
            </span>
          )}
          {stats.nullCount > 0 && (
            <span>
              · {l10n("Nulls")}: {stats.nullCount.toLocaleString()}
            </span>
          )}
          {stats.numeric && (
            <>
              <span>
                · {l10n("Sum")}: {fmt(stats.numeric.sum)}
              </span>
              <span>
                · {l10n("Avg")}: {fmt(stats.numeric.avg)}
              </span>
              <span>
                · {l10n("Min")}: {fmt(stats.numeric.min)}
              </span>
              <span>
                · {l10n("Max")}: {fmt(stats.numeric.max)}
              </span>
            </>
          )}
        </span>
      )}
      {error && (
        <span className="btv-status-error">
          {error}
          <button
            type="button"
            className="btv-status-error-close"
            onClick={() => setError(null)}
            aria-label="dismiss"
          >
            ×
          </button>
        </span>
      )}
    </div>
  );
}
