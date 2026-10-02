// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { ColumnKind } from "./protocol";

/** Length at which we collapse cell text. mssql truncates around 250. */
export const CELL_TRUNCATE_AT = 250;
export const NEWLINE_GLYPH = "↵";

export function isNumericKind(k: ColumnKind): boolean {
  return (
    k === "num" ||
    k === "currency" ||
    k === "date" ||
    k === "datetime" ||
    k === "time"
  );
}

/**
 * Render a raw cell value for the grid. Returns a string the grid will
 * insert as text content (never as HTML). null/undefined become NULL,
 * long strings get an ellipsis, embedded newlines collapse to ↵ so each
 * row stays one line tall.
 */
export function displayValue(value: string | null | undefined): {
  text: string;
  isNull: boolean;
  truncated: boolean;
} {
  if (value === null || value === undefined) {
    return { text: "NULL", isNull: true, truncated: false };
  }
  if (value.length > CELL_TRUNCATE_AT) {
    return {
      text: collapseNewlines(value.slice(0, CELL_TRUNCATE_AT)) + "…",
      isNull: false,
      truncated: true,
    };
  }
  return { text: collapseNewlines(value), isNull: false, truncated: false };
}

function collapseNewlines(s: string): string {
  return s.indexOf("\n") === -1 ? s : s.replace(/\r?\n/g, NEWLINE_GLYPH);
}

/**
 * Best-effort detection of the cell content type for the cell-detail panel.
 * Used only when the user opens a cell — we don't run this on every render.
 */
export function detectContent(value: string): "json" | "xml" | "text" {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      /* fall through */
    }
  }
  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return "xml";
  }
  return "text";
}

export function prettifyJSON(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

/** Naive XML pretty-printer — good enough for the cell-detail panel. */
export function prettifyXML(value: string): string {
  let depth = 0;
  return value
    .replace(/>\s*</g, "><")
    .replace(/(<[^>]+>)/g, (tag) => {
      let prefix = "";
      const isClose = tag.startsWith("</");
      const isSelfClose = tag.endsWith("/>");
      const isDecl = tag.startsWith("<?") || tag.startsWith("<!");
      if (isClose) {
        depth = Math.max(0, depth - 1);
      }
      prefix = "  ".repeat(depth);
      if (!isClose && !isSelfClose && !isDecl) {
        depth++;
      }
      return "\n" + prefix + tag;
    })
    .replace(/^\n/, "");
}
