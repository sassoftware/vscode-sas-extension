import { FileType, Uri } from "vscode";

import {
  SAS_SERVER_ROOT_FOLDER,
  SAS_SERVER_ROOT_FOLDERS,
} from "../../components/ContentNavigator/const";
import {
  AddChildItemProperties,
  ContentAdapter,
  ContentItem,
  RootFolderMap,
} from "../../components/ContentNavigator/types";
import { FileProperties } from "../rest/api/compute";
import { getLink, resourceType } from "../rest/util";

class ITCSASServerAdapter implements ContentAdapter {
  protected sessionId: string;
  private rootFolders: RootFolderMap;
  private fileMetadataMap: {
    [id: string]: { etag: string; lastModified?: string; contentType?: string };
  };

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
    throw new Error("createNewFolder not implemented");
  }

  public async createNewItem(
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<ContentItem | undefined> {
    throw new Error("createNewItem not implemented");
  }

  public async deleteItem(item: ContentItem): Promise<boolean> {
    throw new Error("deleteItem not implemented");
  }

  public async getChildItems(parentItem: ContentItem): Promise<ContentItem[]> {
    throw new Error("getChildItems not implemented");
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
    throw new Error("getUriOfItem not implemented");
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
