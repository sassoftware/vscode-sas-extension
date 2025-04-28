// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ProgressLocation, l10n, window } from "vscode";

import { Writable } from "stream";

import PaginatedResultSet from "./PaginatedResultSet";
import { DefaultRecordLimit, Messages } from "./const";
import {
  LibraryAdapter,
  LibraryItem,
  LibraryItemType,
  TableData,
  TableRow,
} from "./types";

const sortById = (a: LibraryItem, b: LibraryItem) => a.id.localeCompare(b.id);

class LibraryModel {
  public constructor(protected libraryAdapter: LibraryAdapter | undefined) {}

  public useAdapter(adapter: LibraryAdapter): void {
    this.libraryAdapter = adapter;
  }

  public getTableResultSet(
    item: LibraryItem,
  ): PaginatedResultSet<{ data: TableData; error?: Error }> {
    return new PaginatedResultSet<{ data: TableData; error?: Error }>(
      async (start: number, end: number) => {
        await this.libraryAdapter.setup();
        const limit = end - start + 1;
        try {
          return {
            data: await this.libraryAdapter.getRows(item, start, limit),
          };
        } catch (e) {
          return { error: e, data: { rows: [], count: 0 } };
        }
      },
    );
  }

  public async writeTableContentsToStream(
    fileStream: Writable,
    item: LibraryItem,
  ) {
    await this.libraryAdapter.setup();
    let offset = 0;
    const { rowCount: totalItemCount, maxNumberOfRowsToRead: limit } =
      await this.libraryAdapter.getTableRowCount(item);
    let hasWrittenHeader: boolean = false;
    const stringArrayToCsvString = (strings: string[]): string =>
      `"${strings
        .map((item: string | number) =>
          (item ?? "").toString().replace(/"/g, '""'),
        )
        .join('","')}"`;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t("Saving {itemName}.", {
          itemName: `${item.library}.${item.name}`,
        }),
        cancellable: true,
      },
      async (_progress, cancellationToken) => {
        cancellationToken.onCancellationRequested(() => {
          fileStream.destroy();
          return;
        });
        do {
          const data = await this.libraryAdapter.getRowsAsCSV(
            item,
            offset,
            limit,
          );

          const headers = data.rows.shift();
          if (!hasWrittenHeader) {
            fileStream.write(stringArrayToCsvString(headers.columns));
            hasWrittenHeader = true;
          }

          data.rows.forEach((item: TableRow) =>
            fileStream.write("\n" + stringArrayToCsvString(item.cells)),
          );

          offset += limit;
        } while (offset < totalItemCount);

        fileStream.end();
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

  public async deleteTable(item: LibraryItem) {
    try {
      await this.libraryAdapter.deleteTable(item);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new Error(
        l10n.t(Messages.TableDeletionError, { tableName: item.uid }),
      );
    }
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
      .map(
        (libraryItem: LibraryItem): LibraryItem => ({
          ...libraryItem,
          uid: `${library?.id || ""}.${libraryItem.id}`,
          library: library?.id,
          readOnly:
            libraryItem.readOnly !== undefined
              ? libraryItem.readOnly
              : library?.readOnly || false,
          type,
        }),
      )
      .sort(sortById);
  }
}

export default LibraryModel;
