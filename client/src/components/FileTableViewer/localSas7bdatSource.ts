// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Opens a `.sas7bdat` file entirely locally — read page-by-page from disk and
// decoded by our first-party parser (`sas7bdatParser`) — with no SAS server
// involved. It is a *lazy, file-backed* `FileTableSource`: opening resolves
// only the column metadata (the leading meta pages), and each `getRows` reads
// just the pages holding the requested window off an open file descriptor
// (kept warm by a small LRU page cache). Browsing a table of tens of millions
// of rows never materialises more than the window in view, so it stays instant
// and memory-bounded at any size.
//
// Because the source is random-access and not fully in memory, SAS-level
// sorting and filtering of the whole table is not offered here: `getRows`
// ignores its `sort`/`query` arguments and always returns file order (the
// panel simply doesn't enable sort/filter for local sas7bdat files).
import type { SortModelItem } from "ag-grid-community";
import * as fs from "fs";
import * as path from "path";

import type { Column } from "../../connection/rest/api/compute";
import type {
  TableData,
  TableQuery,
  TableRow,
} from "../LibraryNavigator/types";
import {
  type PageSource,
  Sas7bdatPageReader,
  parseSasHeaderRegion,
} from "./sas7bdatParser";
import type { FileTableSource } from "./types";

// Re-exported so callers can tell "valid SAS we can't read yet" (RDC
// compression) apart from a corrupt file, using instanceof.
export { Sas7bdatUnsupportedError } from "./sas7bdatParser";

/** Max raw (page-sized) buffers kept warm between reads. */
const PAGE_CACHE_MAX = 16;

/** A PageSource that `pread`s pages from an open file descriptor, LRU-caching
 *  whole pages. Imports nothing from vscode (node-only path). */
class FdPageSource implements PageSource {
  public readonly fileSize: number;
  private readonly raw = new Map<number, Buffer>();

  public constructor(
    private readonly fd: number,
    fileSize: number,
    private readonly headerSize: number,
    private readonly pageSize: number,
  ) {
    this.fileSize = fileSize;
  }

  public read(pageIndex: number, length: number): Buffer {
    const cached = this.raw.get(pageIndex);
    if (cached) {
      // LRU touch (Map re-insertion preserves most-recently-used order).
      this.raw.delete(pageIndex);
      this.raw.set(pageIndex, cached);
      return cached.subarray(0, length);
    }
    const page = Buffer.alloc(this.pageSize);
    const pos = this.headerSize + pageIndex * this.pageSize;
    const read = fs.readSync(this.fd, page, 0, this.pageSize, pos);
    if (read !== this.pageSize) {
      // Partial final page: return only what we actually read.
      return page.subarray(0, Math.min(length, read));
    }
    if (this.raw.size >= PAGE_CACHE_MAX) {
      const oldest = this.raw.keys().next().value;
      if (oldest !== undefined) {
        this.raw.delete(oldest);
      }
    }
    this.raw.set(pageIndex, page);
    return page.subarray(0, length);
  }

  public dispose(): void {
    this.raw.clear();
    fs.closeSync(this.fd);
  }
}

/**
 * Lazily open a local `.sas7bdat` file as a `FileTableSource`. Throws a plain
 * Error for malformed files and a `Sas7bdatUnsupportedError` for valid files
 * using features the reader doesn't implement yet (e.g. RDC compression).
 */
export function localSas7bdatSource(
  fsPath: string,
  uid: string,
): FileTableSource {
  const fd = fs.openSync(fsPath, "r");
  try {
    const fileSize = fs.fstatSync(fd).size;
    // The header lives at the very front of the file (not page-aligned).
    const headLen = Math.min(fileSize, 65536);
    const head = Buffer.alloc(headLen);
    fs.readSync(fd, head, 0, headLen, 0);
    const meta = parseSasHeaderRegion(head, fileSize);

    const source = new FdPageSource(
      fd,
      fileSize,
      meta.headerSize,
      meta.pageSize,
    );
    // Resolves `meta.columns` + all geometry by reading only the leading meta
    // pages — opening is O(metadata), independent of row count.
    const reader = new Sas7bdatPageReader(source, meta);

    return new LazySasSource(path.basename(fsPath), uid, reader, source);
  } catch (e) {
    try {
      fs.closeSync(fd);
    } catch {
      /* ignore */
    }
    throw e;
  }
}

class LazySasSource implements FileTableSource {
  /** firstRow[i] = global row at which page i starts; valid for i <= filled. */
  private readonly firstRow: number[] = [0];
  /** Pages 0..filled-1 have had their row count resolved into firstRow. */
  private filled = 0;

  public constructor(
    public readonly title: string,
    public readonly uid: string,
    private readonly reader: Sas7bdatPageReader,
    private readonly source: FdPageSource,
  ) {}

  public get columns(): Column[] {
    return this.reader.meta.columns.map((c, idx) => ({
      id: c.name,
      name: c.name,
      label: c.label,
      type: c.type,
      index: idx,
      length: c.length,
    }));
  }

  public get rowCount(): number {
    return this.reader.meta.totalRowCount;
  }

  public async getRows(
    start: number,
    end: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- sort/filter unsupported for local sas7bdat (file order always)
    sort: SortModelItem[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- sort/filter unsupported for local sas7bdat (file order always)
    query: TableQuery | undefined,
  ): Promise<TableData> {
    const total = this.rowCount;
    // Sort/filter are intentionally not supported for local sas7bdat: the
    // table is not in memory to reorder, so we always return file order.
    if (total === 0 || start >= total) {
      return { rows: [], count: total };
    }
    const stop = Math.min(end, total - 1);

    const pageCount = this.reader.meta.pageCount;
    const out: TableRow[] = [];
    let cursor = start;
    while (cursor <= stop) {
      const pageIndex = this.pageFor(cursor, pageCount);
      const pageFirst = this.firstRow[pageIndex];
      const cells = this.reader.decodeRowsInPage(pageIndex);
      const local = cursor - pageFirst;
      const take = Math.min(cells.length - local, stop - cursor + 1);
      if (take <= 0) {
        break; // safety: no rows left to hand out
      }
      for (let k = 0; k < take; k++) {
        const row = cells[local + k];
        const display: string[] = new Array(row.length + 1);
        display[0] = ""; // leading index placeholder the panel strips
        for (let j = 0; j < row.length; j++) {
          display[j + 1] = row[j] === null ? "" : row[j];
        }
        out.push({ cells: display });
      }
      cursor += take;
    }
    return { rows: out, count: total };
  }

  /** Release the open file descriptor. */
  public dispose(): void {
    this.source.dispose();
  }

  /** Global row -> page index, resolving per-page row counts on demand (each
   *  page's count is computed once and cached, so the amortised cost of
   *  positioning is a single prefix read per page). */
  private pageFor(row: number, pageCount: number): number {
    for (let i = 0; i < pageCount; i++) {
      this.ensureFilled(i + 1);
      const first = this.firstRow[i];
      const last = this.firstRow[i + 1] - 1;
      if (row >= first && row <= last) {
        return i;
      }
    }
    return pageCount - 1;
  }

  private ensureFilled(upTo: number): void {
    const total = Math.min(upTo, this.reader.meta.pageCount);
    while (this.filled < total && this.filled < this.reader.meta.pageCount) {
      this.firstRow[this.filled + 1] =
        this.firstRow[this.filled] + this.reader.countRowsInPage(this.filled);
      this.filled++;
    }
  }
}
