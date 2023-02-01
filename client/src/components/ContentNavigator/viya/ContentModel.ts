// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import axios, { AxiosInstance } from "axios";
import { ContentItem, Link } from "../types";
import { DataDescriptor } from "./DataDescriptor";
import {
  FILE_TYPES,
  FOLDER_TYPES,
  Messages,
  ROOT_FOLDER,
  TRASH_FOLDER,
} from "./const";
import { Uri } from "vscode";
import { getLink, getResourceId } from "../utils";
import { getApiConfig } from "../../../connection/rest/common";

interface AddMemberProperties {
  name?: string;
  contentType?: string;
}

export class ContentModel {
  private connection: AxiosInstance;
  private dataDescriptor: DataDescriptor;
  private fileTokenMaps: {
    [id: string]: { etag: string; lastModified: string };
  };
  private authorized: boolean;

  constructor(dataDescriptor: DataDescriptor) {
    this.dataDescriptor = dataDescriptor;
    this.fileTokenMaps = {};
    this.authorized = false;
  }

  public connect(baseURL: string): void {
    this.connection = axios.create({ baseURL });
    this.connection.defaults.headers.common.Authorization =
      "Bearer " + getApiConfig().accessToken;
    this.authorized = true;
  }

  public getDataDescriptor(): DataDescriptor {
    return this.dataDescriptor;
  }

  public async getChildren(item: ContentItem): Promise<ContentItem[]> {
    if (!this.authorized) {
      return [];
    }

    if (!item) {
      return this.getRootChildren();
    }

    const parentIsContent = item === ROOT_FOLDER;
    const typeQuery = this.generateTypeQuery(item === ROOT_FOLDER);

    const membersLink = getLink(item.links, "GET", "members");
    let membersUrl = membersLink ? membersLink.uri : null;
    if (!membersUrl && item.uri) {
      membersUrl = `${item.uri}/members`;
    }

    if (!membersUrl) {
      const selfLink = getLink(item.links, "GET", "self");
      if (!selfLink) {
        console.error(
          "Invalid state: FolderService object has no self link : " + item.name
        );
        return Promise.reject({ status: 404 });
      }
      membersUrl = selfLink.uri + "/members";
    }

    membersUrl = membersUrl + "?limit=1000000";

    const filters = [];

    if (parentIsContent) {
      filters.push("isNull(parent)");
    }
    if (typeQuery) {
      filters.push(typeQuery);
    }

    if (filters.length === 1) {
      membersUrl = membersUrl + "&filter=" + filters[0];
    } else if (filters.length > 1) {
      membersUrl = membersUrl + "&filter=and(" + filters.join(",") + ")";
    }

    const res = await this.connection.get(membersUrl);
    const result = res.data;
    if (!result.items) {
      return Promise.reject();
    }
    const isTrash =
      TRASH_FOLDER === this.dataDescriptor.getTypeName(item) || item.__trash__;

    return result.items.map((childItem: ContentItem) => ({
      ...childItem,
      uid: `${childItem.id}${item.name}`.replace(/\s/g, ""),
      __trash__: isTrash,
    }));
  }

  public async getParent(item: ContentItem): Promise<ContentItem | undefined> {
    const ancestorsLink = getLink(item.links, "GET", "ancestors");
    if (!ancestorsLink) {
      return;
    }

    const resp = await this.connection.get(ancestorsLink.uri);
    if (resp.data.ancestors && resp.data.ancestors.length > 0) {
      return resp.data.ancestors[0];
    }
  }

  public async getResourceByUri(uri: Uri): Promise<ContentItem> {
    const resourceId = getResourceId(uri);
    const res = await this.connection.get(resourceId);
    this.fileTokenMaps[resourceId] = {
      etag: res.headers.etag,
      lastModified: res.headers["last-modified"],
    };

    return res.data;
  }

  public async getContentByUri(uri: Uri): Promise<string> {
    const resourceId = getResourceId(uri);
    const res = await this.connection.get(resourceId + "/content", {
      transformResponse: (response) => response,
    });

    this.fileTokenMaps[resourceId] = {
      etag: res.headers.etag,
      lastModified: res.headers["last-modified"],
    };

    // We expect the returned data to be a string. If this isn't a string,
    // we can't really open it
    if (typeof res.data === "object") {
      throw new Error(Messages.FileOpenError);
    }

    return res.data;
  }

  public async createFile(
    item: ContentItem,
    fileName: string
  ): Promise<ContentItem | undefined> {
    const contentType = await this.getFileContentType(fileName);

    let fileCreationResponse = null;
    try {
      fileCreationResponse = await this.connection.post(
        `/files/files#rawUpload?typeDefName=${contentType}`,
        Buffer.from("", "binary"),
        {
          headers: {
            "Content-Type": "text/plain",
            "Content-Disposition": `filename="${fileName}"`,
          },
        }
      );
    } catch (error) {
      return;
    }

    const fileLink: Link | null = getLink(
      (fileCreationResponse.data as ContentItem).links,
      "GET",
      "self"
    );

    const memberAdded = await this.addMember(
      fileLink?.uri,
      getLink(item.links, "POST", "addMember")?.uri,
      {
        name: fileName,
        contentType,
      }
    );
    if (!memberAdded) {
      return;
    }

    return fileCreationResponse.data;
  }

  public async createFolder(
    item: ContentItem,
    name: string
  ): Promise<ContentItem | undefined> {
    const parentFolderUri =
      item.uri || getLink(item.links || [], "GET", "self")?.uri || null;
    if (!parentFolderUri) {
      return;
    }

    try {
      const createFolderResponse = await this.connection.post(
        `/folders/folders?parentFolderUri=${parentFolderUri}`,
        {
          name,
        }
      );

      return createFolderResponse.data;
    } catch (error) {
      return;
    }
  }

  public async renameResource(
    item: ContentItem,
    name: string
  ): Promise<ContentItem | undefined> {
    const itemIsReference = item.type === "reference";
    const uri = itemIsReference
      ? getLink(item.links, "GET", "self").uri
      : item.uri;

    // If we don't have a file token map for this resoure, lets grab
    // it from the server
    let fileTokenMap = this.fileTokenMaps[uri];
    if (!fileTokenMap) {
      try {
        const res = await this.connection.get(uri);
        fileTokenMap = {
          etag: res.headers.etag,
          lastModified: res.headers["last-modified"],
        };
      } catch (error) {
        return;
      }
    }

    try {
      const patchResponse = await this.connection.patch(
        uri,
        { name },
        {
          headers: {
            "If-Unmodified-Since": fileTokenMap.lastModified,
            "If-Match": fileTokenMap.etag,
          },
        }
      );

      this.fileTokenMaps[uri] = {
        etag: patchResponse.headers.etag,
        lastModified: patchResponse.headers["last-modified"],
      };

      // The links in My Favorites are of type reference. Instead of passing
      // back the reference objects, we want to pass back the underlying source
      // objects.
      if (itemIsReference) {
        const referencedItem = await this.connection.get(item.uri);
        return referencedItem.data;
      }

      return patchResponse.data;
    } catch (error) {
      return;
    }
  }

  public async saveContentToUri(uri: Uri, content: string): Promise<void> {
    const resourceId = getResourceId(uri);
    const res = await this.connection.put(resourceId + "/content", content, {
      headers: {
        "Content-Type": "text/plain",
        "If-Match": this.fileTokenMaps[resourceId].etag,
        "If-Unmodified-Since": this.fileTokenMaps[resourceId].lastModified,
      },
    });
    this.fileTokenMaps[resourceId] = {
      etag: res.headers.etag,
      lastModified: res.headers["last-modified"],
    };
  }

  public async getUri(item: ContentItem): Promise<Uri> {
    if (item.type !== "reference") {
      return this.dataDescriptor.getUri(item);
    }

    // If we're attempting to open a favorite, open the underlying file instead.
    try {
      const resp = await this.connection.get(item.uri);
      return this.dataDescriptor.getUri(resp.data);
    } catch (error) {
      return this.dataDescriptor.getUri(item);
    }
  }

  public async delete(item: ContentItem): Promise<boolean> {
    const link = item.links.find((link: Link) => link.rel === "delete");
    if (!link) {
      return false;
    }

    try {
      await this.connection.delete(link.uri);
    } catch (error) {
      return false;
    }

    return true;
  }

  private async addMember(
    uri: string | undefined,
    addMemberUri: string | undefined,
    properties: AddMemberProperties
  ): Promise<boolean> {
    if (!uri || !addMemberUri) {
      return false;
    }

    try {
      await this.connection.post(addMemberUri, {
        uri,
        type: "CHILD",
        ...properties,
      });
    } catch (error) {
      return false;
    }

    return true;
  }

  private generateTypeQuery(parentIsContent: boolean): string {
    // Generate type query segment if applicable
    let typeQuery = "";
    // Determine the set of types on which to filter
    const includedTypes = FILE_TYPES.concat(FOLDER_TYPES);

    // Generate type query string
    typeQuery = "in(" + (parentIsContent ? "type" : "contentType") + ",";
    for (let i = 0; i < includedTypes.length; i++) {
      typeQuery += "'" + includedTypes[i] + "'";
      if (i !== includedTypes.length - 1) {
        typeQuery += ",";
      }
    }
    typeQuery += ")";

    return typeQuery;
  }

  private async getFileContentType(fileName: string): Promise<string> {
    const defaultContentType = "file";
    const ext = fileName.split(".").pop().toLowerCase();
    if (ext === "sas") {
      return "programFile";
    }

    try {
      const typeResponse = await this.connection.get(
        `/types/types?filter=contains('extensions', '${ext}')`
      );

      if (!typeResponse.data.items || typeResponse.data.items.length === 0) {
        return typeResponse.data.items[0].name;
      }
    } catch {
      return defaultContentType;
    }

    return defaultContentType;
  }

  private async getRootChildren(): Promise<ContentItem[]> {
    const supportedDelegateFolders = [
      "@myFavorites",
      "@myFolder",
      "@sasRoot",
      // TODO #109 Include recycle bin in next iteration
      // "@myRecycleBin",
    ];
    const shortcuts: ContentItem[] = [];
    let numberCompletedServiceCalls = 0;

    return new Promise<ContentItem[]>((resolve) => {
      supportedDelegateFolders.forEach((sDelegate, index) => {
        let serviceDelegateFoldersDeferred;
        if (sDelegate === "@sasRoot") {
          serviceDelegateFoldersDeferred = Promise.resolve({
            data: ROOT_FOLDER,
          });
        } else {
          serviceDelegateFoldersDeferred = this.connection.get(
            `/folders/folders/${sDelegate}`
          );
        }
        serviceDelegateFoldersDeferred
          .then((result) => (shortcuts[index] = result.data))
          .finally(() => {
            numberCompletedServiceCalls++;
            if (
              numberCompletedServiceCalls === supportedDelegateFolders.length
            ) {
              resolve(shortcuts.filter((folder) => !!folder));
            }
          });
      });
    });
  }
}
