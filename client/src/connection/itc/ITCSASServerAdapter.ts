import { FileType, Uri } from "vscode";

import { ITCSession } from ".";
import { getSession } from "..";
import {
  SAS_SERVER_ROOT_FOLDER,
  SAS_SERVER_ROOT_FOLDERS,
  SERVER_FOLDER_ID,
  SERVER_HOME_FOLDER_TYPE,
} from "../../components/ContentNavigator/const";
import {
  AddChildItemProperties,
  ContentAdapter,
  ContentItem,
  RootFolderMap,
} from "../../components/ContentNavigator/types";
import { createStaticFolder } from "../../components/ContentNavigator/utils";
import { SAS_SERVER_HOME_DIRECTORY } from "../rest/RestSASServerAdapter";
import { FileProperties } from "../rest/api/compute";
import { getLink, resourceType } from "../rest/util";
import { executeCode } from "./CodeRunner";
import { escapePowershellString } from "./util";

class ITCSASServerAdapter implements ContentAdapter {
  protected sessionId: string;
  private rootFolders: RootFolderMap;
  private fileMetadataMap: {
    [id: string]: { etag: string; lastModified?: string; contentType?: string };
  };

  public constructor() {
    this.rootFolders = {};
  }

  public async addChildItem(
    childItemUri: string | undefined,
    parentItemUri: string | undefined,
    properties: AddChildItemProperties,
  ): Promise<boolean> {
    throw new Error("addChildItem not implemented");
  }

  public async addItemToFavorites(item: ContentItem): Promise<boolean> {
    throw new Error("addItemToFavorites not implemented");
  }

  public async connect(baseUrl: string): Promise<void> {
    return;
  }

  public connected(): boolean {
    return true;
  }

  public async createNewFolder(
    parentItem: ContentItem,
    folderName: string,
  ): Promise<ContentItem | undefined> {
    const d = await this.execute(
      `$runner.CreateDirectory("${escapePowershellString(parentItem.uri)}", "${escapePowershellString(folderName)}")`,
    );
    console.log(d);
    return;
  }

  public async createNewItem(
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<ContentItem | undefined> {
    const d = await this.execute(
      `$runner.CreateFile("${escapePowershellString(parentItem.uri)}", "${escapePowershellString(fileName)}")`,
    );
    console.log(d);
    return;
  }

  public async deleteItem(item: ContentItem): Promise<boolean> {
    await this.execute(
      `$runner.DeleteFile("${escapePowershellString(item.uri)}")`,
    );
  }

  public async getChildItems(parentItem: ContentItem): Promise<ContentItem[]> {
    // If the user is fetching child items of the root folder, give them the
    // "home" directory
    if (parentItem.id === SERVER_FOLDER_ID) {
      const items = await this.execute(`$runner.GetChildItems("/")`);
      const uri = items[0].parentFolderUri;
      const homeDirectory: ContentItem = {
        creationTimeStamp: 0,
        id: uri,
        links: [
          { method: "GET", rel: "self", href: uri, uri, type: "GET" },
          {
            method: "GET",
            rel: "getDirectoryMembers",
            href: "/",
            uri,
            type: "GET",
          },
        ],
        modifiedTimeStamp: 0,
        name: "Home",
        uri,
        permission: {
          write: true,
          delete: false,
          addMember: true,
        },
        type: SERVER_HOME_FOLDER_TYPE,
        fileStat: {
          ctime: 0,
          mtime: 0,
          size: 0,
          type: FileType.Directory,
        },
      };
      homeDirectory.contextValue = resourceType(homeDirectory);
      return [homeDirectory];
    }

    const folderPath = getLink(
      parentItem.links,
      "GET",
      "getDirectoryMembers",
    ).uri;
    const items = await this.execute(
      `$runner.GetChildItems("${escapePowershellString(folderPath)}")`,
    );
    const childItems = items.map(this.convertPowershellResponseToContentItem);
    return childItems;
  }

  private convertPowershellResponseToContentItem(response: any): ContentItem {
    // response.category can be 0, 1, or 2. 0 is directory, 1 is "sas" type, 2 is other file types
    const type = response.category === 0 ? FileType.Directory : FileType.File;

    const uri = buildUri(response.parentFolderUri, response.name);
    const links = [
      type === FileType.Directory && {
        method: "GET",
        rel: "getDirectoryMembers",
        href: uri,
        uri: uri,
        type: "GET",
      },
      { method: "GET", rel: "self", href: uri, uri: uri, type: "GET" },
    ].filter((link) => link);

    const item = {
      id: uri,
      uri,
      name: response.name,
      creationTimeStamp: 0,
      modifiedTimeStamp: response.modifiedTimeStamp.replace(/[^0-9]/g, ""),
      links,
      permission: {
        write: true,
        delete: true,
        addMember: type === FileType.Directory,
      },
      type: "",
      parentFolderUri: response.parentFolderUri,
      fileStat: {
        ctime: 0,
        mtime: response.modifiedTimeStamp.replace(/[^0-9]/g, ""),
        size: response.size,
        type,
      },
    };

    return {
      ...item,
      contextValue: resourceType(item),
      // isReference: isReference(item),
      // resourceId: getResourceIdFromItem(item),
      // vscUri: getSasServerUri(item, flags?.isInRecycleBin || false),
      // typeName: getTypeName(item),
    };

    function buildUri(parentPath: string, name: string): string {
      return `${parentPath}\\${name}`;
    }
  }

  private async execute(code: string) {
    const session = getSession();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const output = await (session as ITCSession).execute(code);
    return JSON.parse(output);
  }

  public async getContentOfItem(item: ContentItem): Promise<string> {
    throw new Error("getContentOfItem not implemented");
  }

  public async getContentOfUri(uri: Uri): Promise<string> {
    throw new Error("getContentOfUri not implemented");
  }

  public async getFolderPathForItem(item: ContentItem): Promise<string> {
    throw new Error("getFolderPathForItem not implemented");
  }

  public async getItemOfUri(uri: Uri): Promise<ContentItem> {
    throw new Error("getItemOfUri not implemented");
  }

  public async getParentOfItem(
    item: ContentItem,
  ): Promise<ContentItem | undefined> {
    throw new Error("getParentOfItem not implemented");
  }

  public getRootFolder(name: string): ContentItem | undefined {
    throw new Error("getRootFolder not implemented");
  }

  public async getRootItems(): Promise<RootFolderMap> {
    for (let index = 0; index < SAS_SERVER_ROOT_FOLDERS.length; ++index) {
      const delegateFolderName = SAS_SERVER_ROOT_FOLDERS[index];
      const result =
        delegateFolderName === "@sasServerRoot"
          ? { data: SAS_SERVER_ROOT_FOLDER }
          : { data: {} };

      this.rootFolders[delegateFolderName] = {
        ...result.data,
        uid: `${index}`,
        ...this.filePropertiesToContentItem(result.data),
      };
    }

    return this.rootFolders;
  }

  public async getUriOfItem(
    item: ContentItem,
    readOnly: boolean,
  ): Promise<Uri> {
    return item.vscUri;
  }

  public async moveItem(
    item: ContentItem,
    targetParentFolderUri: string,
  ): Promise<Uri | undefined> {
    throw new Error("moveItem not implemented");
  }

  public removeItemFromFavorites(item: ContentItem): Promise<boolean> {
    throw new Error("removeItemFromFavorites not implemented");
  }

  public async renameItem(
    item: ContentItem,
    newName: string,
  ): Promise<ContentItem | undefined> {
    throw new Error("renameItem not implemented");
  }

  public async updateContentOfItem(uri: Uri, content: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  private filePropertiesToContentItem(
    fileProperties: FileProperties & { type?: string },
    flags?: ContentItem["flags"],
  ): ContentItem {
    const links = fileProperties.links.map((link) => ({
      method: link.method,
      rel: link.rel,
      href: link.href,
      type: link.type,
      uri: link.uri,
    }));

    const id = getLink(links, "GET", "self").uri;

    const item = {
      id,
      uri: id,
      name: fileProperties.name,
      creationTimeStamp: 0,
      modifiedTimeStamp: 0,
      links,
      permission: {
        write: false,
        delete: false,
        addMember: false,
      },
      flags,
      type: fileProperties.type || "",
      parentFolderUri: "",
    };

    return {
      ...item,
      contextValue: resourceType(item),
      fileStat: {
        ctime: item.creationTimeStamp,
        mtime: item.modifiedTimeStamp,
        size: 0,
        type: FileType.Directory,
      },
      // isReference: isReference(item),
      // resourceId: getResourceIdFromItem(item),
      // vscUri: getSasServerUri(item, flags?.isInRecycleBin || false),
      // typeName: getTypeName(item),
    };
  }
}

export default ITCSASServerAdapter;
