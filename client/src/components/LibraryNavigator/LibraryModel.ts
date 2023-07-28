// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AxiosResponse } from "axios";
import { ProgressLocation, l10n, window } from "vscode";
import { getSession } from "../../connection";
import { DataAccessApi } from "../../connection/rest/api/compute";
import { getApiConfig } from "../../connection/rest/common";
import { LogFn as LogChannelFn } from "../LogChannel";
import { throttle } from "../utils";
import PaginatedResultSet from "./PaginatedResultSet";
import { DefaultRecordLimit, Messages } from "./const";
import { LibraryItem, LibraryItemType, TableData, TableRow } from "./types";

const sortById = (a: LibraryItem, b: LibraryItem) => a.id.localeCompare(b.id);

const requestOptions = {
  headers: { Accept: "application/vnd.sas.collection+json" },
};

class LibraryModel {
  protected dataAccessApi: ReturnType<typeof DataAccessApi>;
  protected sessionId: string;

  public async connect(): Promise<void> {
    const session = getSession();
    session.onLogFn = LogChannelFn;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t("Connecting to SAS session..."),
      },
      async () => {
        await session.setup();
      },
    );

    this.sessionId = session?.sessionId();
    this.dataAccessApi = DataAccessApi(getApiConfig());
  }

  public async setup(): Promise<void> {
    if (this.sessionId && this.dataAccessApi) {
      return;
    }

    await this.connect();
  }

  public reset(): void {
    this.sessionId = undefined;
  }

  public getTableResultSet(item: LibraryItem): PaginatedResultSet<TableData> {
    return new PaginatedResultSet<TableData>(
      async (start: number, end: number) => {
        await this.setup();
        const limit = end - start + 1;
        return await this.retryOnFail(
          async () =>
            await this.dataAccessApi.getRows(
              {
                sessionId: this.sessionId,
                libref: item.library || "",
                tableName: item.name,
                includeIndex: true,
                start,
                limit,
              },
              requestOptions,
            ),
        );
      },
      (response) => ({
        rows: response.data.items,
        count: response.data.count,
      }),
    );
  }

  public async getTableContents(item: LibraryItem) {
    await this.setup();
    let offset = 0;
    const { rowCount: totalItemCount } = await this.getTable(item);
    const promiseStack: Array<
      () => Promise<{
        headers: { columns: string[] };
        rows: TableData["rows"];
      }>
    > = [];

    do {
      // Given our total item count, this builds a promise stack to process all rows
      // of a given table. NOTE: We bind offset as we are putting things on our stack. Otherwise,
      // the updated value ends up being used for every call in our stack.
      promiseStack.push(
        ((start: number) => {
          return async () => {
            console.log("processing with start = ", start);
            const { data } = await this.retryOnFail(
              async () =>
                await this.dataAccessApi.getRowsAsCSV(
                  {
                    includeColumnNames: true,
                    includeIndex: true,
                    libref: item.library || "",
                    // Since we're including column names, we need to grab one more row
                    limit: DefaultRecordLimit + 1,
                    sessionId: this.sessionId,
                    start,
                    tableName: item.name,
                  },
                  requestOptions,
                ),
            );

            return { headers: data.items.shift(), rows: data.items };
          };
        })(offset),
      );

      offset += DefaultRecordLimit;
    } while (offset < totalItemCount);

    const results = await throttle(promiseStack, 5);

    const contentStrings: string[] = [];
    const stringArrayToCsvString = (strings: string[]): string =>
      `"${strings
        .map((item: string | number) =>
          (item ?? "").toString().replace(/"/g, '""'),
        )
        .join('","')}"`;

    results.forEach((result) => {
      if (contentStrings.length === 0) {
        contentStrings.push(stringArrayToCsvString(result.headers.columns));
      }
      contentStrings.push(
        ...result.rows.map((item: TableRow) =>
          stringArrayToCsvString(item.cells),
        ),
      );
    });

    return contentStrings.join("\n");
  }

  public async fetchColumns(item: LibraryItem) {
    await this.setup();
    let offset = 0;
    let items = [];
    let totalItemCount = Infinity;
    do {
      const { data } = await this.retryOnFail(
        async () =>
          await this.dataAccessApi.getColumns(
            {
              sessionId: this.sessionId,
              limit: DefaultRecordLimit,
              start: offset,
              libref: item.library || "",
              tableName: item.name,
            },
            { headers: { Accept: "application/json" } },
          ),
      );

      items = [...items, ...data.items];
      totalItemCount = data.count;
      offset += DefaultRecordLimit;
    } while (offset < totalItemCount);

    return items;
  }

  public async getTable(item: LibraryItem) {
    await this.setup();
    const response = await this.retryOnFail(
      async () =>
        await this.dataAccessApi.getTable(
          {
            sessionId: this.sessionId,
            libref: item.library || "",
            tableName: item.name,
          },
          { headers: { Accept: "application/json" } },
        ),
    );

    return response.data;
  }

  public async deleteTable(item: LibraryItem) {
    await this.setup();
    try {
      await this.retryOnFail(
        async () =>
          await this.dataAccessApi.deleteTable({
            sessionId: this.sessionId,
            libref: item.library,
            tableName: item.name,
          }),
      );
    } catch (error) {
      throw new Error(
        l10n.t(Messages.TableDeletionError, { tableName: item.uid }),
      );
    }
  }

  public async getChildren(item?: LibraryItem): Promise<LibraryItem[]> {
    if (!item) {
      return await this.getLibraries();
    }

    return await this.getTables(item);
  }

  private async getLibraries(): Promise<LibraryItem[]> {
    await this.setup();

    let offset = 0;
    let items = [];
    let totalItemCount = Infinity;
    do {
      const { data } = await this.retryOnFail(
        async () =>
          await this.dataAccessApi.getLibraries(
            {
              sessionId: this.sessionId,
              limit: DefaultRecordLimit,
              start: offset,
            },
            requestOptions,
          ),
      );

      items = [...items, ...data.items];
      totalItemCount = data.count;
      offset += DefaultRecordLimit;
    } while (offset < totalItemCount);

    items.sort(sortById);

    const libraryItems: LibraryItem[] = await Promise.all(
      items.map(async (item: LibraryItem): Promise<LibraryItem> => {
        const { data } = await this.retryOnFail(
          async () =>
            await this.dataAccessApi.getLibrarySummary(
              {
                sessionId: this.sessionId,
                libref: item.id,
              },
              {
                headers: {
                  Accept: "application/json",
                },
              },
            ),
        );

        return { ...item, readOnly: data.readOnly };
      }),
    );

    return this.processItems(libraryItems, "library", undefined);
  }

  private async getTables(item?: LibraryItem): Promise<LibraryItem[]> {
    await this.setup();

    let offset = 0;
    let items = [];
    let totalItemCount = Infinity;
    do {
      const { data } = await this.retryOnFail(
        async () =>
          await this.dataAccessApi.getTables(
            {
              sessionId: this.sessionId,
              libref: item.id,
              limit: DefaultRecordLimit,
              start: offset,
            },
            requestOptions,
          ),
      );
      items = [...items, ...data.items];
      totalItemCount = data.count;
      offset += DefaultRecordLimit;
    } while (offset < totalItemCount);

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

  private async retryOnFail(
    callbackFn: () => Promise<AxiosResponse>,
  ): Promise<AxiosResponse> {
    try {
      return await callbackFn();
    } catch (error) {
      // If it's not a 404, we can't retry it
      if (error.response?.status !== 404) {
        throw error;
      }

      await this.connect();

      // If it fails a second time, we give up
      return await callbackFn();
    }
  }
}

export default LibraryModel;
