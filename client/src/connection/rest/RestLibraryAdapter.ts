// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { SortModelItem } from "ag-grid-community";
import { AxiosResponse } from "axios";

import { getSession } from "..";
import {
  LibraryAdapter,
  LibraryItem,
  TableData,
  TableQuery,
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

const buildWhereClause = (query: TableQuery | undefined): string | undefined => {
  if (!query) {
    return undefined;
  }

  const whereParts = [query.filterValue, ...Object.values(query.columnFilters || {})]
    .map((value) => value?.trim())
    .filter((value) => !!value)
    .map((value) => `(${value})`);

  return whereParts.length > 0 ? whereParts.join(" and ") : undefined;
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
    item: Pick<LibraryItem, "name" | "library">,
    start: number,
    limit: number,
    sortModel: SortModelItem[],
    query: TableQuery | undefined,
  ): Promise<TableData> {
    if (sortModel.length > 0) {
      return await this.getSortedRows(item, start, limit, sortModel, query);
    }

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
            formatMissingValues: true,
            where: buildWhereClause(query),
          },
          requestOptions,
        ),
    );

    return {
      rows: data.items,
      count: data.count,
    };
  }

  private async getSortedRows(
    item: Pick<LibraryItem, "name" | "library">,
    start: number,
    limit: number,
    sortModel: SortModelItem[],
    query: TableQuery | undefined,
  ): Promise<TableData> {
    const { data: viewData } = await this.retryOnFail(
      async () =>
        await this.dataAccessApi.createView(
          {
            sessionId: this.sessionId,
            libref: item.library || "",
            tableName: item.name,
            viewRequest: {
              sortBy: sortModel.map((sortModelItem) => ({
                key: sortModelItem.colId,
                direction:
                  sortModelItem.sort === "asc" ? "ascending" : "descending",
              })),
            },
          },
          requestOptions,
        ),
    );

    const results = await this.getRows(
      {
        library: viewData.libref,
        name: viewData.name,
      },
      start,
      limit,
      [],
      query,
    );

    await this.deleteTable({ library: viewData.libref, name: viewData.name });

    return results;
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

  public async getDistinctColumnValues(
    item: Pick<LibraryItem, "name" | "library">,
    columnName: string,
    query: TableQuery | undefined,
    maxValues: number = 100,
  ): Promise<(string | number | null)[]> {
    const distinctValues: (string | number | null)[] = [];
    const seen = new Set<string>();
    let start = 0;
    const limit = 100;
    let totalCount = Infinity;

    while (start < totalCount && distinctValues.length < maxValues) {
      const { data } = await this.retryOnFail<RowCollection>(
        async () =>
          await this.dataAccessApi.getRows(
            {
              sessionId: this.sessionId,
              libref: item.library || "",
              tableName: item.name,
              includeColumns: columnName,
              includeIndex: false,
              start,
              limit,
              formatMissingValues: true,
              where: buildWhereClause(query),
            },
            requestOptions,
          ),
      );

      totalCount = data.count;

      for (const row of data.items || []) {
        const value = row.cells?.[0] ?? null;
        const valueKey = JSON.stringify(value);
        if (seen.has(valueKey)) {
          continue;
        }

        seen.add(valueKey);
        distinctValues.push(value);
        if (distinctValues.length >= maxValues) {
          break;
        }
      }

      if ((data.items || []).length === 0) {
        break;
      }
      start += limit;
    }

    return distinctValues;
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

  public async deleteTable({
    library,
    name,
  }: Pick<LibraryItem, "library" | "name">): Promise<void> {
    await this.setup();
    try {
      await this.retryOnFail(
        async () =>
          await this.dataAccessApi.deleteTable({
            sessionId: this.sessionId,
            libref: library,
            tableName: name,
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
