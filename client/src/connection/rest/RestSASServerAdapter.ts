import { Uri } from "vscode";

import {
  AddChildItemProperties,
  ContentAdapter,
  ContentItem,
  RootFolderMap,
} from "../../components/ContentNavigator/types";

class RestSASServerAdapter implements ContentAdapter {
  public async connect(baseUrl: string): Promise<void> {
    // TODO
    return;
  }
  public connected(): boolean {
    // TODO
    return true;
  }

  public async addChildItem(
    childItemUri: string | undefined,
    parentItemUri: string | undefined,
    properties: AddChildItemProperties,
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async addItemToFavorites(item: ContentItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async createNewFolder(
    parentItem: ContentItem,
    folderName: string,
  ): Promise<ContentItem | undefined> {
    throw new Error("Method not implemented.");
  }

  public async createNewItem(
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<ContentItem | undefined> {
    throw new Error("Method not implemented.");
  }

  public async deleteItem(item: ContentItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async getChildItems(parentItem: ContentItem): Promise<ContentItem[]> {
    throw new Error("Method not implemented.");
  }

  public async getContentOfItem(item: ContentItem): Promise<string> {
    throw new Error("Method not implemented.");
  }

  public async getContentOfUri(uri: Uri): Promise<string> {
    throw new Error("Method not implemented.");
  }

  public async getFolderPathForItem(item: ContentItem): Promise<string> {
    throw new Error("Method not implemented.");
  }

  public async getItemOfId(id: string): Promise<ContentItem> {
    throw new Error("Method not implemented.");
  }

  public async getItemOfUri(uri: Uri): Promise<ContentItem> {
    throw new Error("Method not implemented.");
  }

  public async getParentOfItem(
    item: ContentItem,
  ): Promise<ContentItem | undefined> {
    throw new Error("Method not implemented.");
  }

  public getRootFolder(name: string): ContentItem | undefined {
    throw new Error("Method not implemented.");
  }

  public async getRootItems(): Promise<RootFolderMap> {
    // TODO
    return {};
  }

  public async getUriOfItem(
    item: ContentItem,
    readOnly: boolean,
  ): Promise<Uri> {
    throw new Error("Method not implemented.");
  }

  public async moveItem(
    item: ContentItem,
    targetParentFolderUri: string,
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async recycleItem(
    item: ContentItem,
  ): Promise<{ newUri?: Uri; oldUri?: Uri }> {
    throw new Error("Method not implemented.");
  }

  public async removeItemFromFavorites(item: ContentItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async renameItem(
    item: ContentItem,
    newName: string,
  ): Promise<ContentItem | undefined> {
    throw new Error("Method not implemented.");
  }

  public async restoreItem(item: ContentItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async updateContentOfItem(uri: Uri, content: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export default RestSASServerAdapter;
