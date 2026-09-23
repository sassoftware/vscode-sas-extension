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
// Because the source is random-access and not fully cached in memory:
//   - Sorting is not offered (reordering a whole table would need an
//     index pass; `getRows` ignores its `sort` argument).
//   - Filtering IS offered for the better-viewer's checklist filters
//     (`col in ("a","b")`). There is no index, so a filter triggers one
//     whole-table scan that keeps only surviving *row indices* — memory
//     stays bounded (we never hold all decoded rows), and the view is
//     cached per filter so scrolling inside it costs one page-read per
//     window, like unfiltered browsing.
import type { SortModelItem } from "ag-grid-community";
import * as fs from "fs";
import * as path from "path";

import type { Column } from "../../connection/rest/api/compute";
import type {
  TableData,
  TableQuery,
  TableRow,
} from "../LibraryNavigator/types";
import { tryBuildColValueFilter } from "./colValueFilter";
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
  /** Ascending global row indices surviving the current filter (null = no
   *  filter applied — identity view). */
  private filterView: number[] | null = null;
  private filterSig = "";

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
    sort: SortModelItem[], // sorting unsupported — file order always
    query: TableQuery | undefined,
  ): Promise<TableData> {
    const total = this.rowCount;
    if (total === 0) {
      return { rows: [], count: total };
    }
    const view = this.filterViewFor(query?.filterValue);
    const count = view ? view.length : total;
    if (start >= count) {
      return { rows: [], count };
    }
    const stop = Math.min(end, count - 1);

    const pageCount = this.reader.meta.pageCount;
    const out: TableRow[] = [];
    let cursor = start;
    let curPage = -1;
    let curCells: ReadonlyArray<ReadonlyArray<string | null>> = [];
    while (cursor <= stop) {
      const globalRow = view ? view[cursor] : cursor;
      const pageIndex = this.pageFor(globalRow, pageCount);
      if (pageIndex !== curPage) {
        curPage = pageIndex;
        curCells = this.reader.decodeRowsInPage(pageIndex);
      }
      // Consume the run of consecutive view entries that share this page.
      const pageFirst = this.firstRow[pageIndex];
      const pageEnd = this.firstRow[pageIndex + 1]; // exclusive
      let k = 0;
      while (cursor + k <= stop) {
        const g = view ? view[cursor + k] : cursor + k;
        if (g >= pageEnd) {
          break;
        }
        out.push({ cells: this.toDisplay(curCells[g - pageFirst]) });
        k++;
      }
      cursor += k;
    }
    return { rows: out, count };
  }

  /** Render one decoded (column-aligned) row for the panel: a leading index
   *  placeholder (the panel strips it) and missing values mapped to "". */
  private toDisplay(row: ReadonlyArray<string | null>): string[] {
    const display: string[] = new Array(row.length + 1);
    display[0] = "";
    for (let j = 0; j < row.length; j++) {
      display[j + 1] = row[j] === null ? "" : row[j];
    }
    return display;
  }

  /**
   * Resolve the current filter into an ascending view of surviving global
   * row indices, cached against the filter string (like the unfiltered row
   * geometry). A filter triggers one whole-table scan. A filter we can't
   * interpret locally (free-form SAS WHERE) yields an empty view rather than
   * silently showing unfiltered rows.
   */
  private filterViewFor(rawFilter: string | undefined): number[] | null {
    const q = (rawFilter ?? "").trim();
    if (q === this.filterSig) {
      return this.filterView;
    }
    this.filterSig = q;
    if (q.length === 0) {
      this.filterView = null;
      return null;
    }
    const predicate = tryBuildColValueFilter(q, this.columns);
    // A filter we can't interpret locally (a free-form SAS expr, or the
    // classic viewer's substring needle on a file-backed table) is ignored —
    // matching the source's original "filter unsupported" behaviour — rather
    // than matching nothing, which would blank the whole table.
    if (!predicate) {
      this.filterView = null;
      return null;
    }
    const view: number[] = [];
    const pageCount = this.reader.meta.pageCount;
    for (let p = 0; p < pageCount; p++) {
      this.ensureFilled(p + 1);
      const pageFirst = this.firstRow[p];
      const rows = this.reader.decodeRowsInPage(p);
      for (let j = 0; j < rows.length; j++) {
        if (predicate(rows[j])) {
          view.push(pageFirst + j);
        }
      }
    }
    this.filterView = view;
    return view;
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
