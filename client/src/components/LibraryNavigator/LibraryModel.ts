import { authentication, ProgressLocation, window } from "vscode";
import { getSession } from "../../connection";
import {
  DataAccessApi,
  Library,
  LibrarySummary,
} from "../../connection/rest/api/compute";
import { getApiConfig } from "../../connection/rest/common";
import { SASAuthProvider } from "../AuthProvider";
import {
  LibraryItemType,
  LibraryItem,
  TableData,
  TableHeader,
  TableRow,
} from "./types";
import { sprintf } from "sprintf-js";
import { Messages } from "./const";
import { AxiosError } from "axios";

class LibraryModel {
  private dataAccessApi: ReturnType<typeof DataAccessApi>;
  private sessionId: string;
  private libraries: Record<string, LibraryItem>;

  constructor() {
    this.libraries = {};
  }

  public async connect(): Promise<void> {
    const session = getSession();
    let computeSession = null;

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: "Connecting to SAS session...",
      },
      async () => {
        computeSession = await session.setup();
      }
    );

    // Lets catch some error cases here
    this.sessionId = computeSession && computeSession.sessionId;
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
      headers: response.data.items[0] as TableHeader,
      rows: response.data.items.slice(1) as TableRow[],
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

    if (item) {
      return await this.getTables(item);
    }
  }

  public getParent(item: LibraryItem): LibraryItem | undefined {
    return this.libraries[item.library];
  }

  private async getLibraries(): Promise<LibraryItem[]> {
    await this.setup();
    const options = {
      headers: { Accept: "application/vnd.sas.collection+json" },
    };

    const {
      data: { items },
    } = await this.retryOnFail(
      async () =>
        await this.dataAccessApi.getLibraries(
          { sessionId: this.sessionId },
          options
        )
    );

    const libraryItems: LibraryItem[] = await Promise.all(
      items.map(async (item: LibraryItem): Promise<LibraryItem> => {
        const { data } = await this.retryOnFail(
          async () =>
            await this.dataAccessApi.getLibrarySummary({
              sessionId: this.sessionId,
              libref: item.id,
            })
        );

        return { ...item, readOnly: (data as Library).readOnly };
      })
    );

    libraryItems.push({
      uid: "WORK",
      id: "WORK",
      name: "WORK",
      readOnly: false,
      type: "library",
    });

    const libraries = this.processItems(libraryItems, "library", undefined);

    // TODO #129 consider cleaning this up
    this.libraries = libraries.reduce(
      (carry: Record<string, LibraryItem>, item: LibraryItem) => ({
        ...carry,
        [item.id]: item,
      }),
      {}
    );

    return libraries;
  }

  private async getTables(item?: LibraryItem): Promise<LibraryItem[]> {
    await this.setup();
    const options = {
      headers: { Accept: "application/vnd.sas.collection+json" },
    };

    const {
      data: { items },
    } = await this.retryOnFail(
      async () =>
        await this.dataAccessApi.getTables(
          { sessionId: this.sessionId, libref: item.id },
          options
        )
    );

    return this.processItems(items as LibraryItem[], "table", item);
  }

  private processItems(
    items: LibraryItem[],
    type: LibraryItemType,
    library: LibraryItem | undefined
  ): LibraryItem[] {
    return items.map(
      (libraryItem: LibraryItem): LibraryItem => ({
        ...libraryItem,
        uid: `${library?.id}.${libraryItem.id}`,
        library: library?.id,
        readOnly:
          libraryItem.readOnly !== undefined
            ? libraryItem.readOnly
            : library?.readOnly || false,
        type,
      })
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async retryOnFail(callbackFn: () => Promise<any>): Promise<any> {
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
