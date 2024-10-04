// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri } from "vscode";

import { ALL_ROOT_FOLDERS, Messages } from "./const";
import { ContentAdapter, ContentItem } from "./types";
import { isItemInRecycleBin } from "./utils";

export class ContentModel {
  private contentAdapter: ContentAdapter;

  constructor(contentAdapter: ContentAdapter) {
    this.contentAdapter = contentAdapter;
  }

  public connected(): boolean {
    return this.contentAdapter.connected();
  }

  public async connect(baseURL: string): Promise<void> {
    await this.contentAdapter.connect(baseURL);
  }

  public getAdapter() {
    return this.contentAdapter;
  }

  public async getChildren(item?: ContentItem): Promise<ContentItem[]> {
    if (!this.connected()) {
      return [];
    }

    if (!item) {
      return Object.entries(await this.contentAdapter.getRootItems())
        .sort(
          // sort the delegate folders as the order in the supportedDelegateFolders
          (a, b) =>
            ALL_ROOT_FOLDERS.indexOf(a[0]) - ALL_ROOT_FOLDERS.indexOf(b[0]),
        )
        .map((entry) => entry[1]);
    }

    return await this.contentAdapter.getChildItems(item);
  }

  public async getParent(item: ContentItem): Promise<ContentItem | undefined> {
    return await this.contentAdapter.getParentOfItem(item);
  }

  public async getResourceByUri(uri: Uri): Promise<ContentItem> {
    return await this.contentAdapter.getItemOfUri(uri);
  }

  public async getContentByUri(uri: Uri): Promise<string> {
    let data;
    try {
      data = (await this.contentAdapter.getContentOfUri(uri)).toString();
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      throw new Error(Messages.FileOpenError);
    }

    // We expect the returned data to be a string. If this isn't a string,
    // we can't really open it
    if (typeof data === "object") {
      throw new Error(Messages.FileOpenError);
    }

    return data;
  }

  public async downloadFile(item: ContentItem): Promise<Buffer | undefined> {
    try {
      const data = await this.contentAdapter.getContentOfItem(item);

      return Buffer.from(data, "binary");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      throw new Error(Messages.FileDownloadError);
    }
  }

  public async createFile(
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<ContentItem | undefined> {
    return await this.contentAdapter.createNewItem(
      parentItem,
      fileName,
      buffer,
    );
  }

  public async createFolder(
    item: ContentItem,
    name: string,
  ): Promise<ContentItem | undefined> {
    return await this.contentAdapter.createNewFolder(item, name);
  }

  public async renameResource(
    item: ContentItem,
    name: string,
  ): Promise<ContentItem | undefined> {
    return await this.contentAdapter.renameItem(item, name);
  }

  public async saveContentToUri(uri: Uri, content: string): Promise<void> {
    await this.contentAdapter.updateContentOfItem(uri, content);
  }

  public async getUri(item: ContentItem, readOnly: boolean): Promise<Uri> {
    return await this.contentAdapter.getUriOfItem(item, readOnly);
  }

  public async delete(item: ContentItem): Promise<boolean> {
    return await this.contentAdapter.deleteItem(item);
  }

  public async addFavorite(item: ContentItem): Promise<boolean> {
    return await this.contentAdapter.addItemToFavorites(item);
  }

  public async removeFavorite(item: ContentItem): Promise<boolean> {
    return await this.contentAdapter.removeItemFromFavorites(item);
  }

  public async moveTo(
    item: ContentItem,
    targetParentFolderUri: string,
  ): Promise<boolean | Uri> {
    return await this.contentAdapter.moveItem(item, targetParentFolderUri);
  }

  public getDelegateFolder(name: string): ContentItem | undefined {
    return this.contentAdapter.getRootFolder(name);
  }

  public async getFileFolderPath(contentItem: ContentItem): Promise<string> {
    return await this.contentAdapter.getFolderPathForItem(contentItem);
  }

  public canRecycleResource(item: ContentItem): boolean {
    return (
      this.contentAdapter.recycleItem &&
      this.contentAdapter.restoreItem &&
      !isItemInRecycleBin(item) &&
      item.permission.write
    );
  }

  public async recycleResource(item: ContentItem) {
    return await this.contentAdapter?.recycleItem(item);
  }

  public async restoreResource(item: ContentItem) {
    return await this.contentAdapter?.restoreItem(item);
  }
}
