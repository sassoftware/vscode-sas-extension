// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { SortModelItem } from "ag-grid-community";
import { AxiosResponse } from "axios";

import { getSession } from "..";
import {
  LibraryAdapter,
  LibraryItem,
  TableData,
} from "../../components/LibraryNavigator/types";
import { appendSessionLogFn } from "../../components/logViewer";
import {
  ColumnCollection,
  DataAccessApi,
  RowCollection,
  TableInfo,
} from "./api/compute";
import { getApiConfig } from "./common";

const requestOptions = {
  headers: { Accept: "application/vnd.sas.collection+json" },
};

class RestLibraryAdapter implements LibraryAdapter {
  protected dataAccessApi: ReturnType<typeof DataAccessApi>;
  protected sessionId: string;

  public constructor() {}

  public async connect(): Promise<void> {
    const session = getSession();
    session.onSessionLogFn = appendSessionLogFn;

    await session.setup();

    this.sessionId = session?.sessionId();
    this.dataAccessApi = DataAccessApi(getApiConfig());
  }

  public async setup(): Promise<void> {
    if (this.sessionId && this.dataAccessApi) {
      return;
    }

    await this.connect();
  }

  public async getRows(
    item: LibraryItem,
    start: number,
    limit: number,
    sortModel: SortModelItem[],
  ): Promise<TableData> {
    const { data } = await this.retryOnFail<RowCollection>(
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

    return {
      rows: data.items,
      count: data.count,
    };
  }

  public async getRowsAsCSV(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<TableData> {
    const response = await this.retryOnFail(
      async () =>
        await this.dataAccessApi.getRowsAsCSV(
          {
            includeColumnNames: true,
            includeIndex: true,
            libref: item.library || "",
            // Since we're including column names, we need to grab one more row
            limit: limit + 1,
            sessionId: this.sessionId,
            start,
            tableName: item.name,
          },
          requestOptions,
        ),
    );

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const data = response.data as unknown as RowCollection;
    return {
      rows: data.items,
      count: data.count,
    };
  }

  public async getColumns(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<ColumnCollection> {
    const { data } = await this.retryOnFail(
      async () =>
        await this.dataAccessApi.getColumns(
          {
            sessionId: this.sessionId,
            limit,
            start,
            libref: item.library || "",
            tableName: item.name,
          },
          { headers: { Accept: "application/json" } },
        ),
    );

    return data;
  }

  public async getTableRowCount(
    item: LibraryItem,
  ): Promise<{ rowCount: number; maxNumberOfRowsToRead: number }> {
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

    return { rowCount: response.data.rowCount, maxNumberOfRowsToRead: 1000 };
  }

  public async getTableInfo(item: LibraryItem): Promise<TableInfo> {
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

  private async retryOnFail<T>(
    callbackFn: () => Promise<AxiosResponse<T>>,
  ): Promise<AxiosResponse<T>> {
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

  public async deleteTable(item: LibraryItem): Promise<void> {
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      throw new Error("Cannot delete table");
    }
  }

  public async getLibraries(
    start: number,
    limit: number,
  ): Promise<{ items: LibraryItem[]; count: number }> {
    const { data } = await this.retryOnFail(
      async () =>
        await this.dataAccessApi.getLibraries(
          {
            sessionId: this.sessionId,
            limit,
            start,
          },
          requestOptions,
        ),
    );

    const libraryItems: LibraryItem[] = await Promise.all(
      data.items.map(async (item: LibraryItem): Promise<LibraryItem> => {
        const { data: responseData } = await this.retryOnFail(
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

        return {
          ...item,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          readOnly: (responseData as { readOnly: boolean }).readOnly,
        };
      }),
    );

    return { items: libraryItems, count: data.count };
  }

  public async getTables(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<{ items: LibraryItem[]; count: number }> {
    const { data } = await this.retryOnFail(
      async () =>
        await this.dataAccessApi.getTables(
          {
            sessionId: this.sessionId,
            libref: item.id,
            limit,
            start,
          },
          requestOptions,
        ),
    );

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return { items: data.items as LibraryItem[], count: data.count };
  }
}

export default RestLibraryAdapter;
