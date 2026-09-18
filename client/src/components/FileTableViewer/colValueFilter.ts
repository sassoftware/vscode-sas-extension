// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Shared interpretation of the better-viewer's column checklist filter.
// `combineFilters` (panels/DataViewerHelpers) serialises the popup's ticked
// values into a SAS WHERE clause, `("Species" in ("setosa","versicolor"))`,
// which server-backed tables evaluate server-side. Local file sources
// (in-memory CSV/TSV/XLSX and the lazy sas7bdat reader) have no SAS engine,
// so both parse that exact emitted grammar here and filter in-process.
import type { Column } from "../../connection/rest/api/compute";

/**
 * Parse a better-viewer column filter into a per-row predicate, when the
 * `filterValue` is purely the `and`-joined `(col in ("a","b"))` checklist
 * grammar `combineFilters` emits. Returns `null` when any segment is not
 * of that shape (e.g. a global substring needle, or a free-form WHERE
 * expression — which is server-side only) so the caller can decide the
 * fallback. The predicate receives a column-aligned data row (no leading
 * index placeholder) and the value at `dataIdx` is compared, case-insensitively.
 */
export function tryBuildColValueFilter(
  filterValue: string,
  columns: Column[],
): ((dataRow: ReadonlyArray<string | null>) => boolean) | null {
  const parts = filterValue.split(/\s+and\s+/i);
  if (parts.length === 0) {
    return null;
  }
  const matchers: Array<(row: ReadonlyArray<string | null>) => boolean> = [];
  for (const part of parts) {
    const m = /^\((.*?)\s+in\s+\((.*)\)\)\s*$/.exec(part.trim());
    if (!m) {
      return null;
    }
    const dataIdx = columns.findIndex(
      (c) => c.id === m[1] || c.name === m[1],
    );
    if (dataIdx < 0) {
      return null;
    }
    const values = parseQuotedList(m[2]).map((v) => v.toLowerCase());
    matchers.push((row) =>
      values.includes((row[dataIdx] ?? "").toLowerCase()),
    );
  }
  return (dataRow) => matchers.every((f) => f(dataRow));
}

/** Split `"a","b"` into the double-quoted strings, decoding the `""`
 *  escaped-quote form SAS/CSV use. The list only ever contains these
 *  literal tokens, so a tiny scanner beats a regex. */
export function parseQuotedList(list: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inStr = false;
  for (let i = 0; i < list.length; i++) {
    const ch = list[i];
    if (inStr) {
      if (ch === '"') {
        if (list[i + 1] === '"') {
          cur += '"';
          i++;
          continue;
        }
        inStr = false;
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inStr = true;
    }
  }
  return out;
}
