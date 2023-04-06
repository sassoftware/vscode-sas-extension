// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { ProgressLocation, window } from "vscode";
import { getSession } from "../../connection";
import { DataAccessApi } from "../../connection/rest/api/compute";
import { getApiConfig } from "../../connection/rest/common";
import { LibraryItemType, LibraryItem, TableData } from "./types";
import { sprintf } from "sprintf-js";
import { DefaultRecordLimit, Messages } from "./const";
import { AxiosResponse } from "axios";

const sortById = (a: LibraryItem, b: LibraryItem) => a.id.localeCompare(b.id);

class LibraryModel {
  protected dataAccessApi: ReturnType<typeof DataAccessApi>;
  protected sessionId: string;

  public async connect(): Promise<void> {
    const session = getSession();

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Connecting to SAS session...",
      },
      async () => {
        await session.setup();
      }
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

  public async loadViewData(item: LibraryItem): Promise<TableData> {
    await this.setup();
    const response = await this.retryOnFail(
      async () =>
        await this.dataAccessApi.getRows({
          sessionId: this.sessionId,
          libref: item.library,
          tableName: item.name,
          includeColumnNames: true,
        })
    );

    return {
      headers: response.data.items[0],
      rows: response.data.items.slice(1),
    };
  }

  public async getTable(item: LibraryItem) {
    await this.setup();
    const response = await this.retryOnFail(
      async () =>
        await this.dataAccessApi.getTable({
          sessionId: this.sessionId,
          libref: item.library,
          tableName: item.name,
        })
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
          })
      );
    } catch (error) {
      throw new Error(
        sprintf(Messages.TableDeletionError, { tableName: item.uid })
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
    const options = {
      headers: { Accept: "application/vnd.sas.collection+json" },
    };

    let offset = -1 * DefaultRecordLimit;
    let items = [];
    let totalItemCount = Infinity;
    do {
      offset += DefaultRecordLimit;
      const { data } = await this.retryOnFail(
        async () =>
          await this.dataAccessApi.getLibraries(
            {
              sessionId: this.sessionId,
              limit: DefaultRecordLimit,
              start: offset,
            },
            options
          )
      );

      items = [...items, ...data.items];
      totalItemCount = data.count;
    } while (offset < totalItemCount);

    items.sort(sortById);

    const libraryItems: LibraryItem[] = await Promise.all(
      items.map(async (item: LibraryItem): Promise<LibraryItem> => {
        const { data } = await this.retryOnFail(
          async () =>
            await this.dataAccessApi.getLibrarySummary({
              sessionId: this.sessionId,
              libref: item.id,
            })
        );

        return { ...item, readOnly: data.readOnly };
      })
    );

    return this.processItems(libraryItems, "library", undefined);
  }

  private async getTables(item?: LibraryItem): Promise<LibraryItem[]> {
    await this.setup();
    const options = {
      headers: { Accept: "application/vnd.sas.collection+json" },
    };

    let offset = -1 * DefaultRecordLimit;
    let items = [];
    let totalItemCount = Infinity;
    do {
      offset += DefaultRecordLimit;
      const { data } = await this.retryOnFail(
        async () =>
          await this.dataAccessApi.getTables(
            {
              sessionId: this.sessionId,
              libref: item.id,
              limit: DefaultRecordLimit,
              start: offset,
            },
            options
          )
      );
      items = [...items, ...data.items];
      totalItemCount = data.count;
    } while (offset < totalItemCount);

    return this.processItems(items, "table", item);
  }

  private processItems(
    items: LibraryItem[],
    type: LibraryItemType,
    library: LibraryItem | undefined
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
        })
      )
      .sort(sortById);
  }

  private async retryOnFail(
    callbackFn: () => Promise<AxiosResponse>
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
