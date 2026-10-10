// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Tiny RFC-4180-ish streaming CSV / TSV reader. Hand-rolled to avoid a
// runtime dependency. Handles:
//   - quoted cells with embedded delimiters / newlines
//   - "" → " escape inside quoted cells
//   - both \n and \r\n line endings
//   - a trailing line without a terminating newline
//
// Anything fancier (e.g. escape characters other than ", BOM stripping
// per-cell, encoding sniffing) is out of scope; we read UTF-8 and assume
// the file is well-formed enough to consume in a single linear pass.
import type { Readable } from "stream";

export interface ParseOptions {
  delimiter: string;
}

/** Read the entire stream and return rows. The caller is responsible for
 *  bounding file size; this loads everything into memory. */
export async function parseCsv(
  stream: Readable,
  opts: ParseOptions = { delimiter: "," },
): Promise<string[][]> {
  const rows: string[][] = [];
  let curRow: string[] = [];
  let cur = "";
  let inQuotes = false;
  let prevWasQuote = false;
  let firstChunk = true;

  for await (const chunk of stream) {
    let text: string;
    if (typeof chunk === "string") {
      text = chunk;
    } else if (Buffer.isBuffer(chunk)) {
      text = chunk.toString("utf8");
    } else {
      text = String(chunk);
    }
    if (firstChunk) {
      // Strip a UTF-8 BOM if present so it doesn't pollute the first
      // header. Excel writes BOMs by default.
      if (text.charCodeAt(0) === 0xfeff) {
        text = text.slice(1);
      }
      firstChunk = false;
    }
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (prevWasQuote) {
            // "" → escaped quote; emit a single quote.
            cur += '"';
            prevWasQuote = false;
          } else {
            prevWasQuote = true;
          }
        } else if (prevWasQuote) {
          // Closing quote was just consumed; the current char closes
          // the field and must be re-evaluated outside the quoted state.
          inQuotes = false;
          prevWasQuote = false;
          i--;
        } else {
          cur += c;
        }
      } else {
        if (c === '"' && cur.length === 0) {
          inQuotes = true;
        } else if (c === opts.delimiter) {
          curRow.push(cur);
          cur = "";
        } else if (c === "\r") {
          // ignore — the \n that follows handles end-of-record
        } else if (c === "\n") {
          curRow.push(cur);
          cur = "";
          rows.push(curRow);
          curRow = [];
        } else {
          cur += c;
        }
      }
    }
  }
  // Flush a trailing record that didn't end with a newline.
  if (cur.length > 0 || curRow.length > 0) {
    curRow.push(cur);
    rows.push(curRow);
  }
  return rows;
}

/** Return the delimiter for a CSV/TSV path. Caller may override. */
export function delimiterForExt(ext: string): string {
  return ext.toLowerCase() === ".tsv" ? "\t" : ",";
}
