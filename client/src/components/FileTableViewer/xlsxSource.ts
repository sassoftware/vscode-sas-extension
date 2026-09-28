// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// XLSX → InMemorySource via exceljs (already a dep, used for export).
// Multi-sheet workbooks prompt the user with a quickPick before loading.
import { l10n, window } from "vscode";

import * as path from "path";

import { InMemorySource, buildInMemorySource } from "./inMemorySource";

/** Build an `InMemorySource` from an .xlsx file. Returns `undefined` if
 *  the user cancels the sheet picker. */
export async function xlsxSource(
  fsPath: string,
  uid: string,
): Promise<InMemorySource | undefined> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(fsPath);

  const sheets = wb.worksheets.filter((s) => s.state !== "hidden");
  if (sheets.length === 0) {
    return new InMemorySource(path.basename(fsPath), uid, [], []);
  }

  let sheet = sheets[0];
  if (sheets.length > 1) {
    const picked = await window.showQuickPick(
      sheets.map((s) => s.name),
      {
        title: l10n.t("Pick a sheet to open"),
        ignoreFocusOut: true,
      },
    );
    if (!picked) {
      return undefined;
    }
    sheet = sheets.find((s) => s.name === picked) ?? sheets[0];
  }

  // Walk the rows once. exceljs is 1-indexed; row[0] / col[0] are
  // unused. We treat row 1 as headers and rows 2..N as data.
  const matrix: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const arr: string[] = [];
    // row.values is a 1-indexed array on real exceljs rows; [0] is
    // undefined. The TS surface declares it loosely (any), so we route
    // through Array.isArray to narrow it for our reader.
    const values: unknown[] = Array.isArray(row.values) ? row.values : [];
    const lastCol = sheet.actualColumnCount;
    for (let i = 1; i <= lastCol; i++) {
      arr.push(stringifyCell(values[i]));
    }
    matrix.push(arr);
  });

  if (matrix.length === 0) {
    return new InMemorySource(sheet.name || path.basename(fsPath), uid, [], []);
  }

  const title =
    sheets.length > 1
      ? `${path.basename(fsPath)} (${sheet.name})`
      : path.basename(fsPath);
  return buildInMemorySource(matrix[0], matrix.slice(1), title, uid);
}

/** exceljs cell values can be strings, numbers, Dates, booleans,
 *  rich-text objects, hyperlink objects, or formula results. We coerce
 *  to a single display string the way mssql-style grids do. */
function stringifyCell(v: unknown): string {
  if (v === null || v === undefined) {
    return "";
  }
  if (typeof v === "string") {
    return v;
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (v instanceof Date) {
    return v.toISOString();
  }
  if (typeof v === "object") {
    // Probe known shapes via the `in` operator so TS narrows the field
    // type without a type assertion.
    if ("richText" in v && Array.isArray(v.richText)) {
      const parts: string[] = [];
      for (const piece of v.richText) {
        parts.push(stringifyCell(piece));
      }
      return parts.join("");
    }
    if ("result" in v && v.result !== undefined) {
      return stringifyCell(v.result);
    }
    if ("text" in v && typeof v.text === "string") {
      return v.text;
    }
  }
  return String(v);
}
