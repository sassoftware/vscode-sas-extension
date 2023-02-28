import { authentication, ProgressLocation, window } from "vscode";
import { getSession } from "../../connection";
import { DataAccessApi } from "../../connection/rest/api/compute";
import { getApiConfig } from "../../connection/rest/common";
import { SASAuthProvider } from "../AuthProvider";
import { LibraryItem, TableData, TableHeader, TableRow } from "./types";

class LibraryModel {
  private dataAccessApi: ReturnType<typeof DataAccessApi>;
  private sessionId: string;

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
    const { dataAccessApi, sessionId } = await this.getDataAccessAPI();
    const options = {
      headers: { Accept: "application/vnd.sas.collection+json" },
    };

    const response = item
      ? await dataAccessApi.getTables({ sessionId, libref: item.id }, options)
      : await dataAccessApi.getLibraries({ sessionId }, options);

    const type = item ? "table" : "library";
    const items = response.data.items;
    if (!item) {
      items.push({
        id: "WORK",
        name: "WORK",
        links: [],
      });
    }

    return items.map(
      ({ id, name, links }: LibraryItem): LibraryItem => ({
        type,
        id,
        name,
        links,
        library: item?.id || undefined,
      })
    );
  }
}

export default LibraryModel;
