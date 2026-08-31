// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { SortModelItem } from "ag-grid-community";
import { AxiosResponse } from "axios";

import { getSession } from "..";
import {
  LibraryAdapter,
  LibraryItem,
  TableColumnCollection,
  TableData,
  TableQuery,
} from "../../components/LibraryNavigator/types";
import { appendSessionLogFn } from "../../components/logViewer";
import { baseFormatName } from "../../panels/columnIconClassifier";
import { FormatCategoryCache } from "../formatCategory";
import {
  DataAccessApi,
  FormatsApi,
  InformatsApi,
  RowCollection,
  TableInfo,
} from "./api/compute";
import { getApiConfig } from "./common";

const requestOptions = {
  headers: { Accept: "application/vnd.sas.collection+json" },
};

class RestLibraryAdapter implements LibraryAdapter {
  protected dataAccessApi: ReturnType<typeof DataAccessApi>;
  protected InformatsApi: ReturnType<typeof InformatsApi>;
  protected FormatsApi: ReturnType<typeof FormatsApi>;
  protected sessionId: string;
  protected formatCategories: FormatCategoryCache = new FormatCategoryCache(
    (formatNames) => this.fetchFormatCategories(formatNames),
  );

  public constructor() {}

  public async connect(): Promise<void> {
    const session = getSession();
    session.onSessionLogFn = appendSessionLogFn;

    await session.setup();

    this.sessionId = session?.sessionId();
    this.dataAccessApi = DataAccessApi(getApiConfig());
    this.InformatsApi = InformatsApi(getApiConfig());
    this.FormatsApi = FormatsApi(getApiConfig());
    // Format definitions are session scoped, so previously resolved categories no longer apply.
    this.formatCategories.clear();
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
            where: query && query.filterValue ? query.filterValue : undefined,
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

  public async getColumns(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<TableColumnCollection> {
    await this.setup();
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

    const items = data.items ?? [];
    const categories = await this.formatCategories.resolve(
      items.map((column) => column.format),
    );

    const columns = items.map((column) => ({
      ...column,
      formatCategory: categories.get(baseFormatName(column.format)) ?? "",
    }));

    return {
      ...data,
      items: columns,
    };
  }

  // The Compute service reports a format's category (char, date, datetime, time, curr, num, ...),
  // which getColumns cannot provide because every non-character column is reported as FLOAT.
  private async fetchFormatCategories(
    formatNames: string[],
  ): Promise<Record<string, string>> {
    return await this.requestFormatCategories(formatNames);
  }

  private async requestFormatCategories(
    formatNames: string[],
  ): Promise<Record<string, string>> {
    const entries = await Promise.all(
      formatNames.map(async (formatName) => {
        try {
          const formatResp = await this.FormatsApi.getFormat({
            sessionId: this.sessionId,
            formatName,
          });

          let category = formatResp?.data?.category || "";

          if (!category) {
            const informatResp = await this.InformatsApi.getInformat({
              sessionId: this.sessionId,
              informatName: formatName,
            });

            category = informatResp?.data?.category || "";
          }

          return [formatName, category];
        } catch {
          return [formatName, ""];
        }
      }),
    );

    return Object.fromEntries(entries);
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
