import {
  commands,
  Event,
  ProviderResult,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";
import { apiConfig, computeSession, config } from "../session/rest";
import { FileSystemApi, SessionsApi } from "../session/rest/api/compute";
import axios, { AxiosResponse, AxiosRequestConfig } from "axios";

export const SasContentPane = "sas-content";

const getTimeZone = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60) * (offset < 0 ? -1 : 1);
  const minutes = offset % 60;
  const realhours = hours * -1;
  const absHours = Math.abs(hours);
  const absMinutes = Math.abs(minutes);
  const strHours = absHours < 10 ? `0${absHours}` : `${absHours}`;
  const strMinutes = absMinutes < 10 ? `0${absMinutes}` : `${absMinutes}`;
  const plusOrMinus = realhours > 0 ? "+" : "-";
  return `GMT${plusOrMinus}${strHours}:${strMinutes}`;
};

interface TreeItemMetaData {
  contentType: string;
  resourceLink: string;
  extension: string;
}

interface MetadataResponseLink {
  rel: string;
  uri: string;
}

interface MetadataResponse {
  name: string;
  contentType: string;
  links: MetadataResponseLink[];
}

const parseMetadata = (metadata: MetadataResponse): TreeItemMetaData => {
  return {
    contentType: metadata.contentType,
    resourceLink:
      metadata.links.find(
        (link: MetadataResponseLink) => link.rel === "getResource"
      )?.uri || "",
    extension:
      metadata.contentType === "file" && metadata.name.split(".").pop(),
  };
};

class SASContentTreeItem extends TreeItem {
  children: TreeItem[] | undefined;
  metadata: TreeItemMetaData | undefined;

  constructor(
    label: string,
    children?: TreeItem[],
    metadata?: TreeItemMetaData
  ) {
    super(
      label,
      // TODO #56 Remove me
      children === undefined && metadata.contentType !== "folder"
        ? TreeItemCollapsibleState.None
        : TreeItemCollapsibleState.Collapsed
    );
    this.children = children;
    this.metadata = metadata;
    this.command = {
      title: "open",
      command: `${SasContentPane}.selectNode`,
      arguments: [this],
    };
  }
}

class SASContentProvider implements TreeDataProvider<TreeItem> {
  public onDidChangeTreeData?: Event<void | TreeItem | TreeItem[]>;
  private data: TreeItem[];

  constructor() {
    this.data = [];

    commands.registerCommand(
      `${SasContentPane}.selectNode`,
      (item: SASContentTreeItem) => {
        console.log("Clicked", { item });
      }
    );
  }

  getTreeItem(element: TreeItem): TreeItem | Thenable<TreeItem> {
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (element === undefined) {
      return await this.sasContent();
    }

    return (element as SASContentTreeItem).children;
  }

  async folderContents(
    commonName: string,
    folderName: string
  ): Promise<SASContentTreeItem> {
    const folderResponse = await axios.request({
      url: `${config.endpoint}/folders/folders/${encodeURIComponent(
        folderName
      )}/members`,
      method: "get",
      headers: {
        Authorization: "Bearer " + apiConfig.accessToken,
        Accept: "application/json",
      },
    });

    console.log(folderResponse.data);

    return new SASContentTreeItem(
      commonName,
      folderResponse.data.items.map(
        (item) =>
          new SASContentTreeItem(item.name, undefined, parseMetadata(item))
      )
    );
  }

  async sasContent(): Promise<TreeItem[]> {
    this.data = [await this.folderContents("My Folder", "@myFolder")];

    return this.data;
  }
}

export default SASContentProvider;
