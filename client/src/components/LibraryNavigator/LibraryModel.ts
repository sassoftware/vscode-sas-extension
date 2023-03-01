import { authentication, ProgressLocation, window } from "vscode";
import { getSession } from "../../connection";
import { DataAccessApi } from "../../connection/rest/api/compute";
import { getApiConfig } from "../../connection/rest/common";
import { SASAuthProvider } from "../AuthProvider";
import {
  LibraryItemType,
  LibraryItem,
  TableData,
  TableHeader,
  TableRow,
} from "./types";

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

  public async getDataAccessAPI(): Promise<{
    dataAccessApi: ReturnType<typeof DataAccessApi>;
    sessionId: string;
  }> {
    if (this.sessionId && this.dataAccessApi) {
      return { sessionId: this.sessionId, dataAccessApi: this.dataAccessApi };
    }

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

    return { sessionId: this.sessionId, dataAccessApi: this.dataAccessApi };
  }

  public async loadViewData(item: LibraryItem): Promise<TableData> {
    const { dataAccessApi, sessionId } = await this.getDataAccessAPI();
    const response = await dataAccessApi.getRows({
      sessionId,
      libref: item.library,
      tableName: item.name,
      includeColumnNames: true,
    });

    return {
      headers: response.data.items[0] as TableHeader,
      rows: response.data.items.slice(1) as TableRow[],
    };
  }

  public async getTable(item: LibraryItem) {
    const { dataAccessApi, sessionId } = await this.getDataAccessAPI();

    const response = await dataAccessApi.getTable({
      sessionId,
      libref: item.library,
      tableName: item.name,
    });

    return response.data;
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
    const { dataAccessApi, sessionId } = await this.getDataAccessAPI();
    const options = {
      headers: { Accept: "application/vnd.sas.collection+json" },
    };

    const {
      data: { items },
    } = await dataAccessApi.getLibraries({ sessionId }, options);
    items.push({
      id: "WORK",
      name: "WORK",
      links: [],
    });

    const libraries = this.processItems(
      items as LibraryItem[],
      "library",
      undefined
    );

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
    const { dataAccessApi, sessionId } = await this.getDataAccessAPI();
    const options = {
      headers: { Accept: "application/vnd.sas.collection+json" },
    };

    const {
      data: { items },
    } = await dataAccessApi.getTables({ sessionId, libref: item.id }, options);

    return this.processItems(items as LibraryItem[], "table", item.id);
  }

  private processItems(
    items: LibraryItem[],
    type: LibraryItemType,
    library: string | undefined
  ): LibraryItem[] {
    return items.map(
      ({ id, name, links }: LibraryItem): LibraryItem => ({
        uid: `${library}.${id}`,
        type,
        id,
        name,
        links,
        library,
      })
    );
  }
}

export default LibraryModel;
