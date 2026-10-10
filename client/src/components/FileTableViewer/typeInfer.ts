// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Lightweight column-type inference for files that don't carry a type
// system. Only used for csv / tsv / xlsx — sas7bdat carries SAS types.
import type { Column } from "../../connection/rest/api/compute";

const NUMERIC_RE = /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/** Look at up to `sample.length` rows to decide each column's type. The
 *  decision is conservative: if any non-empty value fails the pattern,
 *  the column falls back to `char`. */
export function inferColumns(
  headers: string[],
  sample: (string | null | undefined)[][],
): Column[] {
  return headers.map((rawName, idx) => {
    const name = (rawName || `col${idx + 1}`).trim() || `col${idx + 1}`;
    let isNum = true;
    let isDate = true;
    let isDt = true;
    let anyValue = false;
    let maxLen = 0;
    for (const row of sample) {
      const v = row[idx];
      if (v === undefined || v === null || v === "") {
        continue;
      }
      anyValue = true;
      if (v.length > maxLen) {
        maxLen = v.length;
      }
      if (isNum && !NUMERIC_RE.test(v)) {
        isNum = false;
      }
      if (isDate && !DATE_RE.test(v)) {
        isDate = false;
      }
      if (isDt && !DATETIME_RE.test(v)) {
        isDt = false;
      }
      // Don't break once the type is decided — we still want to track
      // maxLen across the rest of the sample so char columns get an
      // accurate length estimate.
    }

    let type: string;
    if (anyValue && isNum) {
      type = "num";
    } else if (anyValue && isDt) {
      type = "datetime";
    } else if (anyValue && isDate) {
      type = "date";
    } else {
      type = "char";
    }

    return {
      id: name,
      name,
      label: name,
      type,
      index: idx,
      length: type === "char" ? Math.max(maxLen, 1) : undefined,
    };
  });
}
