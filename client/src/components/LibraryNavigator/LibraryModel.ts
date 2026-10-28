// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ProgressLocation, l10n, window } from "vscode";

import type { SortModelItem } from "ag-grid-community";
import { Readable } from "stream";

import PaginatedResultSet from "./PaginatedResultSet";
import { DefaultRecordLimit, Messages } from "./const";
import {
  LibraryAdapter,
  LibraryItem,
  LibraryItemType,
  TableData,
  TableExport,
  TableQuery,
} from "./types";

const sortById = (a: LibraryItem, b: LibraryItem) => a.id.localeCompare(b.id);

class LibraryModel {
  public constructor(protected libraryAdapter: LibraryAdapter | undefined) {}

  public useAdapter(adapter: LibraryAdapter): void {
    this.libraryAdapter = adapter;
  }

  public assertTableExportSupported(): void {
    if (
      !this.libraryAdapter?.createTableExport ||
      this.libraryAdapter.supportsTableExport === false
    ) {
      throw new Error(
        l10n.t("This table download is not supported by this connection."),
      );
    }
  }

  public async createTableExport(
    item: LibraryItem,
    signal: AbortSignal,
  ): Promise<TableExport> {
    this.assertTableExportSupported();
    return this.libraryAdapter.createTableExport(item, signal);
  }

  private createPagedTableExport(
    item: LibraryItem,
    signal: AbortSignal,
  ): TableExport {
    const adapter = this.libraryAdapter;
    const waitFor = async <T>(operation: () => Promise<T>): Promise<T> => {
      signal.throwIfAborted();
      let abort: () => void;
      const cancelled = new Promise<never>((_resolve, reject) => {
        abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
      });
      try {
        return await Promise.race([operation(), cancelled]);
      } finally {
        signal.removeEventListener("abort", abort);
      }
    };
    const csv = (values: string[]) =>
      `"${values.map((value) => (value ?? "").toString().replace(/"/g, '""')).join('","')}"`;
    async function* contents() {
      await waitFor(() => adapter.setup());
      const { rowCount, maxNumberOfRowsToRead } = await waitFor(() =>
        adapter.getTableRowCount(item),
      );
      if (
        !Number.isSafeInteger(rowCount) ||
        rowCount < 0 ||
        !Number.isSafeInteger(maxNumberOfRowsToRead) ||
        maxNumberOfRowsToRead <= 0
      ) {
        throw new Error(l10n.t("Unable to read the table row count."));
      }
      const limit = Math.min(maxNumberOfRowsToRead, DefaultRecordLimit);
      let offset = 0;
      do {
        const data = await waitFor(() =>
          adapter.getRowsAsCSV(item, offset, limit),
        );
        signal.throwIfAborted();
        const [headers, ...rows] = data.rows;
        if (
          (offset === 0 && !headers?.columns) ||
          rows.length !== Math.min(limit, rowCount - offset) ||
          rows.some((row) => !row.cells)
        ) {
          throw new Error(l10n.t("Unable to read the table rows."));
        }
        if (offset === 0) {
          yield csv(headers.columns);
        }
        for (const row of rows) {
          signal.throwIfAborted();
          yield "\n" + csv(row.cells);
        }
        offset += limit;
      } while (offset < rowCount);
    }
    signal.throwIfAborted();
    const stream = Readable.from(contents(), {
      highWaterMark: 1,
      objectMode: false,
      signal,
    });
    return {
      stream,
      dispose: async () => {
        stream.destroy();
      },
    };
  }

  public getTableResultSet(
    item: LibraryItem,
  ): PaginatedResultSet<{ data: TableData; error?: Error }> {
    return new PaginatedResultSet<{ data: TableData; error?: Error }>(
      async (
        start: number,
        end: number,
        sortModel: SortModelItem[],
        query: TableQuery | undefined,
      ) => {
        await this.libraryAdapter.setup();
        const limit = end - start + 1;
        try {
          return {
            data: await this.libraryAdapter.getRows(
              item,
              start,
              limit,
              sortModel,
              query,
            ),
          };
        } catch (e) {
          const data: { data: TableData; error: Error } = {
            error: e instanceof Error ? e : new Error(String(e)),
            data: { rows: [], count: 0 },
          };
          return data;
        }
      },
    );
  }

  public async writeTableContents(
    item: LibraryItem,
    writeChunk: (chunk: Uint8Array, signal: AbortSignal) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<boolean> {
    return window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t("Saving {itemName}.", {
          itemName: `${item.library}.${item.name}`,
        }),
        cancellable: true,
      },
      async (_progress, cancellationToken): Promise<boolean> => {
        const controller = new AbortController();
        const abort = () => controller.abort(signal?.reason);
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) {
          abort();
        }
        const cancellation = cancellationToken.onCancellationRequested(() =>
          controller.abort(),
        );
        if (cancellationToken.isCancellationRequested) {
          controller.abort();
        }
        let exported: TableExport | undefined;
        try {
          exported =
            this.libraryAdapter?.createTableExport &&
            this.libraryAdapter.supportsTableExport !== false
              ? await this.createTableExport(item, controller.signal)
              : this.createPagedTableExport(item, controller.signal);
          for await (const chunk of exported.stream) {
            controller.signal.throwIfAborted();
            await writeChunk(
              chunk instanceof Uint8Array
                ? chunk
                : new TextEncoder().encode(String(chunk)),
              controller.signal,
            );
          }
          return !cancellationToken.isCancellationRequested;
        } catch (error) {
          if (cancellationToken.isCancellationRequested) {
            return false;
          }
          throw error;
        } finally {
          try {
            await exported?.dispose();
          } finally {
            cancellation.dispose();
            signal?.removeEventListener("abort", abort);
          }
        }
      },
    );
  }

  public async fetchColumns(item: LibraryItem) {
    await this.libraryAdapter.setup();
    let offset = 0;
    let items = [];
    let totalItemCount = Infinity;
    do {
      const data = await this.libraryAdapter.getColumns(
        item,
        offset,
        DefaultRecordLimit,
      );

      items = [...items, ...data.items];
      totalItemCount = data.count;
      offset += DefaultRecordLimit;
    } while (offset < totalItemCount && totalItemCount !== -1);

    return items;
  }

  public async deleteTables(items: LibraryItem[]) {
    const failures: string[] = [];

    for (const item of items) {
      try {
        await this.libraryAdapter.deleteTable(item);
      } catch {
        failures.push(item.uid);
      }
    }

    if (failures.length > 0) {
      throw new Error(
        l10n.t(Messages.TableDeletionError, { tableName: failures.join(", ") }),
      );
    }
  }

  public async getTableInfo(item: LibraryItem) {
    if (this.libraryAdapter.getTableInfo) {
      await this.libraryAdapter.setup();
      return await this.libraryAdapter.getTableInfo(item);
    }
    throw new Error("Table properties not supported for this connection type");
  }

  public async getChildren(item?: LibraryItem): Promise<LibraryItem[]> {
    if (!this.libraryAdapter) {
      return [];
    }
    if (!item) {
      return await this.getLibraries();
    }

    return await this.getTables(item);
  }

  public async getLibraries(): Promise<LibraryItem[]> {
    await this.libraryAdapter.setup();

    let offset = 0;
    let items = [];
    let totalItemCount = Infinity;
    do {
      const data = await this.libraryAdapter.getLibraries(
        offset,
        DefaultRecordLimit,
      );

      items = [...items, ...data.items];
      totalItemCount = data.count;
      offset += DefaultRecordLimit;
    } while (offset < totalItemCount && totalItemCount !== -1);

    items.sort(sortById);

    return this.processItems(items, "library", undefined);
  }

  public async getTables(item: LibraryItem): Promise<LibraryItem[]> {
    await this.libraryAdapter.setup();

    let offset = 0;
    let items = [];
    let totalItemCount = Infinity;
    do {
      const data = await this.libraryAdapter.getTables(
        item,
        offset,
        DefaultRecordLimit,
      );
      items = [...items, ...data.items];
      totalItemCount = data.count;
      offset += DefaultRecordLimit;
    } while (offset < totalItemCount && totalItemCount !== -1);

    return this.processItems(items, "table", item);
  }

  private processItems(
    items: LibraryItem[],
    type: LibraryItemType,
    library: LibraryItem | undefined,
  ): LibraryItem[] {
    return items
      .map((libraryItem: LibraryItem): LibraryItem => ({
        ...libraryItem,
        uid: `${library?.id || ""}.${libraryItem.id}`,
        library: library?.id,
        readOnly:
          libraryItem.readOnly !== undefined
            ? libraryItem.readOnly
            : library?.readOnly || false,
        type,
      }))
      .sort(sortById);
  }
}

export default LibraryModel;
