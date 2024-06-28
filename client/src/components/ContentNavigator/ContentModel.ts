// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, authentication } from "vscode";

import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

import {
  associateFlowObject,
  createStudioSession,
} from "../../connection/studio";
import { SASAuthProvider } from "../AuthProvider";
import { Messages, ROOT_FOLDERS } from "./const";
import { ContentAdapter, ContentItem } from "./types";
import {
  getLink,
  getResourceId,
  getResourceIdFromItem,
  getUri,
  isContainer,
} from "./utils";

interface AddMemberProperties {
  name?: string;
  contentType?: string;
  type?: string;
}

export class ContentModel {
  private connection: AxiosInstance;
  private fileMetadataMap: {
    [id: string]: { etag: string; lastModified: string; contentType: string };
  };
  private authorized: boolean;
  private viyaCadence: string;
  private delegateFolders: { [name: string]: ContentItem };
  private contentAdapter: ContentAdapter;

  constructor(contentAdapter: ContentAdapter) {
    this.contentAdapter = contentAdapter;
    this.fileMetadataMap = {};
    this.authorized = false;
    this.delegateFolders = {};
    this.viyaCadence = "";
  }

  public connected(): boolean {
    return this.contentAdapter.connected();
  }

  public async connect(baseURL: string): Promise<void> {
    await this.contentAdapter.connect(baseURL);

    // TODO Get rid of this
    this.connection = axios.create({ baseURL });
    this.connection.interceptors.response.use(
      (response: AxiosResponse) => response,
      async (error: AxiosError) => {
        const originalRequest: AxiosRequestConfig & { _retry?: boolean } =
          error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          await this.updateAccessToken();
          return this.connection(originalRequest);
        }

        return Promise.reject(error);
      },
    );
    await this.updateAccessToken();
    this.viyaCadence = "";
    this.authorized = true;
  }

  public async getChildren(item?: ContentItem): Promise<ContentItem[]> {
    if (!this.connected()) {
      return [];
    }

    if (!item) {
      return Object.entries(await this.contentAdapter.getRootItems())
        .sort(
          // sort the delegate folders as the order in the supportedDelegateFolders
          (a, b) => ROOT_FOLDERS.indexOf(a[0]) - ROOT_FOLDERS.indexOf(b[0]),
        )
        .map((entry) => entry[1]);
    }

    return await this.contentAdapter.getChildItems(item);
  }

  public async getParent(item: ContentItem): Promise<ContentItem | undefined> {
    return this.contentAdapter.getParentOfItem(item);
  }

  public async getResourceByUri(uri: Uri): Promise<ContentItem> {
    return this.contentAdapter.getItemOfUri(uri);
  }

  public async getContentByUri(uri: Uri): Promise<string> {
    let data;
    try {
      data = (await this.contentAdapter.getContentOfUri(uri)).toString();
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

  public async acquireStudioSessionId(): Promise<string> {
    try {
      const result = await createStudioSession(this.connection);
      return result;
    } catch (error) {
      return "";
    }
  }

  public async associateFlowFile(
    name: string,
    uri: Uri,
    parent: ContentItem,
    studioSessionId: string,
  ): Promise<string | undefined> {
    try {
      return await associateFlowObject(
        name,
        getResourceId(uri),
        getResourceIdFromItem(parent),
        studioSessionId,
        this.connection,
      );
    } catch (error) {
      console.log(error);
    }
  }

  public async getUri(item: ContentItem, readOnly: boolean): Promise<Uri> {
    if (item.type !== "reference") {
      return getUri(item, readOnly);
    }

    // If we're attempting to open a favorite, open the underlying file instead.
    try {
      const resp = await this.connection.get(item.uri);
      return getUri(resp.data, readOnly);
    } catch (error) {
      return getUri(item, readOnly);
    }
  }

  public async delete(item: ContentItem): Promise<boolean> {
    // folder service will return 409 error if the deleting folder has non-folder item even if add recursive parameter
    // delete the resource or move item to recycle bin will automatically delete the favorites as well.
    return await (isContainer(item)
      ? this.deleteFolder(item)
      : this.deleteResource(item));
  }

  private async deleteFolder(item: ContentItem): Promise<boolean> {
    try {
      const children = await this.getChildren(item);
      await Promise.all(children.map((child) => this.delete(child)));
      const deleteRecursivelyLink = getLink(
        item.links,
        "DELETE",
        "deleteRecursively",
      )?.uri;
      const deleteResourceLink = getLink(
        item.links,
        "DELETE",
        "deleteResource",
      )?.uri;
      if (!deleteRecursivelyLink && !deleteResourceLink) {
        return false;
      }
      const deleteLink =
        deleteRecursivelyLink ?? `${deleteResourceLink}?recursive=true`;
      await this.connection.delete(deleteLink);
    } catch (error) {
      return false;
    }
    return true;
  }

  private async deleteResource(item: ContentItem): Promise<boolean> {
    const deleteResourceLink = getLink(
      item.links,
      "DELETE",
      "deleteResource",
    )?.uri;
    if (!deleteResourceLink) {
      return false;
    }
    try {
      await this.connection.delete(deleteResourceLink);
    } catch (error) {
      return false;
    }
    // Due to delay in folders service's automatic deletion of associated member we need
    // to attempt manual deletion of member to ensure subsequent data refreshes don't occur before
    // member is deleted. Per Gary Williams, we must do these steps sequentially not concurrently.
    // If member already deleted, server treats this call as NO-OP.
    try {
      const deleteLink = getLink(item.links, "DELETE", "delete")?.uri;
      if (deleteLink) {
        await this.connection.delete(deleteLink);
      }
    } catch (error) {
      return error.response.status === 404 || error.response.status === 403;
    }
    return true;
  }

  public async moveTo(
    item: ContentItem,
    targetParentFolderUri: string,
  ): Promise<boolean> {
    const newItemData = {
      ...item,
      parentFolderUri: targetParentFolderUri,
    };
    const updateLink = getLink(item.links, "PUT", "update");
    try {
      await this.connection.put(updateLink.uri, newItemData);
    } catch (error) {
      return false;
    }
    return true;
  }

  public async addFavorite(item: ContentItem): Promise<boolean> {
    const myFavorites = this.getDelegateFolder("@myFavorites");
    return await this.contentAdapter.addChildItem(
      getResourceIdFromItem(item),
      getLink(myFavorites.links, "POST", "addMember").uri,
      {
        type: "reference",
        name: item.name,
        contentType: item.contentType,
      },
    );
  }

  public async removeFavorite(item: ContentItem): Promise<boolean> {
    const deleteMemberUri = await getDeleteMemberUri();
    if (!deleteMemberUri) {
      return false;
    }
    try {
      await this.connection.delete(deleteMemberUri);
    } catch (error) {
      return false;
    }
    return true;

    async function getDeleteMemberUri(): Promise<string> {
      if (item.flags?.isInMyFavorites) {
        return getLink(item.links, "DELETE", "delete")?.uri;
      }

      const myFavoritesFolder = this.getDelegateFolder("@myFavorites");
      const allFavorites = await this.getChildren(myFavoritesFolder);
      const favoriteId = allFavorites.find(
        (favorite) =>
          getResourceIdFromItem(favorite) === getResourceIdFromItem(item),
      )?.id;
      if (!favoriteId) {
        return undefined;
      }

      return `${getResourceIdFromItem(myFavoritesFolder)}/members/${favoriteId}`;
    }
  }

  private async getTypeDefinition(fileName: string): Promise<string> {
    const defaultContentType = "file";
    const ext = fileName.split(".").pop().toLowerCase();
    if (ext === "sas") {
      return "programFile";
    }

    try {
      const typeResponse = await this.connection.get(
        `/types/types?filter=contains('extensions', '${ext}')`,
      );

      if (typeResponse.data.items && typeResponse.data.items.length !== 0) {
        return typeResponse.data.items[0].name;
      }
    } catch {
      return defaultContentType;
    }

    return defaultContentType;
  }

  public getDelegateFolder(name: string): ContentItem | undefined {
    return this.delegateFolders[name];
  }

  private async updateAccessToken(): Promise<void> {
    const session = await authentication.getSession(SASAuthProvider.id, [], {
      createIfNone: true,
    });
    this.connection.defaults.headers.common.Authorization = `Bearer ${session.accessToken}`;
  }

  public async getFileFolderPath(contentItem: ContentItem): Promise<string> {
    if (isContainer(contentItem)) {
      return "";
    }

    const filePathParts = [];
    let currentContentItem: Pick<ContentItem, "parentFolderUri" | "name"> =
      contentItem;
    do {
      try {
        const { data: parentData } = await this.connection.get(
          currentContentItem.parentFolderUri,
        );
        currentContentItem = parentData;
      } catch (e) {
        return "";
      }

      filePathParts.push(currentContentItem.name);
    } while (currentContentItem.parentFolderUri);

    return "/" + filePathParts.reverse().join("/");
  }

  private updateFileMetadata(
    id: string,
    { headers, data }: AxiosResponse,
    contentType?: string,
  ) {
    this.fileMetadataMap[id] = {
      etag: headers.etag,
      lastModified: headers["last-modified"],
      contentType: contentType || data.contentType,
    };
  }

  private async getResourceById(id: string): Promise<AxiosResponse> {
    const res = await this.connection.get(id);
    this.updateFileMetadata(id, res);
    return res;
  }
}
