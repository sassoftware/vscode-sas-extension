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

class SASContentTreeItem extends TreeItem {
  children: TreeItem[] | undefined;

  constructor(label: string, children?: TreeItem[]) {
    super(
      label,
      children === undefined
        ? TreeItemCollapsibleState.None
        : TreeItemCollapsibleState.Collapsed
    );
    this.children = children;
  }
}

class SASContentProvider implements TreeDataProvider<TreeItem> {
  public onDidChangeTreeData?: Event<void | TreeItem | TreeItem[]>;
  private data: TreeItem[];

  constructor() {
    this.data = [
      new SASContentTreeItem("Hey", [
        new SASContentTreeItem("What?"),
        new SASContentTreeItem("Now?"),
      ]),
      new SASContentTreeItem("Bye", [
        new SASContentTreeItem("To?"),
        new SASContentTreeItem("OIJ?"),
      ]),
    ];

    // commands.registerCommand(
    //   `${SasContentPane}.selectNode`,
    //   (item: TreeItem) => {
    //     console.log({ item });
    //   }
    // );
  }

  getTreeItem(element: TreeItem): TreeItem | Thenable<TreeItem> {
    console.log("getTreeItem called");
    return element;
  }

  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    if (element === undefined) {
      return await this.sasContent();
    }

    return (element as SASContentTreeItem).children;
  }

  async folderContents(commonName: string, folderName: string): TreeItem {
    const folderResponse = await axios.request({
      url: `${config.endpoint}/folders/folders/${folderName}/members`,
      method: "get",
      headers: {
        Authorization: "Bearer " + apiConfig.accessToken,
        Accept: "application/json",
      },
    });
    console.log(folderResponse);
    console.log(
      folderResponse.data.items.map((item) => new SASContentTreeItem(item.name))
    );
    return new SASContentTreeItem(
      commonName,
      folderResponse.data.items.map((item) => new SASContentTreeItem(item.name))
    );
  }

  async sasContent(): Promise<TreeItem[]> {
    this.data = [await this.folderContents("My Folder", "@myFolder")];

    return this.data;
  }
}

export default SASContentProvider;
