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
import {
  DEFAULT_FILE_CONTENT_TYPE,
  FILE_TYPES,
  FOLDER_TYPES,
  Messages,
  ROOT_FOLDER,
  TRASH_FOLDER_TYPE,
} from "./const";
import { ContentItem, Link } from "./types";
import {
  getFileContentType,
  getItemContentType,
  getLink,
  getPermission,
  getResourceId,
  getResourceIdFromItem,
  getTypeName,
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

  constructor() {
    this.fileMetadataMap = {};
    this.authorized = false;
    this.delegateFolders = {};
    this.viyaCadence = "";
  }

  public connected(): boolean {
    return this.authorized;
  }

  public async connect(baseURL: string): Promise<void> {
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
    if (!this.authorized) {
      return [];
    }

    if (!item) {
      return this.getRootChildren();
    }

    if (!this.viyaCadence) {
      this.viyaCadence = await this.getViyaCadence();
    }

    const parentIsContent = item.uri === ROOT_FOLDER.uri;
    const typeQuery = this.generateTypeQuery(parentIsContent);

    const membersLink = getLink(item.links, "GET", "members");
    let membersUrl = membersLink ? membersLink.uri : null;
    if (!membersUrl && item.uri) {
      membersUrl = `${item.uri}/members`;
    }

    if (!membersUrl) {
      const selfLink = getLink(item.links, "GET", "self");
      if (!selfLink) {
        console.error(
          "Invalid state: FolderService object has no self link : " + item.name,
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
    membersUrl =
      membersUrl +
      `&sortBy=${
        parentIsContent || this.viyaCadence === "2023.03" // 2023.03 fails query with this sortBy param
          ? ""
          : "eq(contentType,'folder'):descending,"
      }name:primary:ascending,type:ascending`;

    const res = await this.connection.get(membersUrl);
    const result = res.data;
    if (!result.items) {
      return Promise.reject();
    }
    const myFavoritesFolder = this.getDelegateFolder("@myFavorites");
    const isInRecycleBin =
      TRASH_FOLDER_TYPE === getTypeName(item) || item.flags?.isInRecycleBin;
    const isInMyFavorites =
      getResourceIdFromItem(item) === getResourceIdFromItem(myFavoritesFolder);
    const all_favorites = isInMyFavorites
      ? []
      : await this.getChildren(myFavoritesFolder);

    return result.items.map((childItem: ContentItem, index) => ({
      ...childItem,
      uid: `${item.uid}/${index}`,
      permission: getPermission(childItem),
      flags: {
        isInRecycleBin,
        isInMyFavorites,
        hasFavoriteId: all_favorites.find(
          (favorite) =>
            getResourceIdFromItem(favorite) ===
            getResourceIdFromItem(childItem),
        )?.id,
      },
    }));
  }

  public async getParent(item: ContentItem): Promise<ContentItem | undefined> {
    const ancestorsLink = getLink(item.links, "GET", "ancestors");
    if (!ancestorsLink) {
      return;
    }
    const resp = await this.connection.get(ancestorsLink.uri);
    if (resp.data && resp.data.length > 0) {
      return resp.data[0];
    }
  }

  public async getResourceByUri(uri: Uri): Promise<ContentItem> {
    const resourceId = getResourceId(uri);
    return (await this.getResourceById(resourceId)).data;
  }

  public async getContentByUri(uri: Uri): Promise<string> {
    const resourceId = getResourceId(uri);
    let res;
    try {
      res = await this.connection.get(resourceId + "/content", {
        transformResponse: (response) => response,
      });
    } catch (e) {
      throw new Error(Messages.FileOpenError);
    }

    // We expect the returned data to be a string. If this isn't a string,
    // we can't really open it
    if (typeof res.data === "object") {
      throw new Error(Messages.FileOpenError);
    }

    return res.data;
  }

  public async downloadFile(item: ContentItem): Promise<Buffer | undefined> {
    const uri = getUri(item);
    const resourceId = getResourceId(uri);

    try {
      const res = await this.connection.get(resourceId + "/content", {
        responseType: "arraybuffer",
      });

      return Buffer.from(res.data, "binary");
    } catch (e) {
      throw new Error(Messages.FileDownloadError);
    }
  }

  public async createFile(
    item: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<ContentItem | undefined> {
    const typeDef = await this.getTypeDefinition(fileName);
    let createdResource: ContentItem;
    try {
      const fileCreationResponse = await this.connection.post<ContentItem>(
        `/files/files#rawUpload?typeDefName=${typeDef}`,
        buffer || Buffer.from("", "binary"),
        {
          headers: {
            "Content-Type": getFileContentType(fileName),
            "Content-Disposition": `filename*=UTF-8''${encodeURI(fileName)}`,
            Accept: "application/vnd.sas.file+json",
          },
        },
      );
      createdResource = fileCreationResponse.data;
    } catch (error) {
      return;
    }

    const fileLink: Link | null = getLink(createdResource.links, "GET", "self");
    const memberAdded = await this.addMember(
      fileLink?.uri,
      getLink(item.links, "POST", "addMember")?.uri,
      {
        name: fileName,
        contentType: typeDef,
      },
    );
    if (!memberAdded) {
      return;
    }

    return createdResource;
  }

  public async createFolder(
    item: ContentItem,
    name: string,
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
        },
      );
      return createFolderResponse.data;
    } catch (error) {
      return;
    }
  }

  public async renameResource(
    item: ContentItem,
    name: string,
  ): Promise<ContentItem | undefined> {
    const itemIsReference = item.type === "reference";
    const uri = itemIsReference
      ? getLink(item.links, "GET", "self").uri
      : item.uri;

    try {
      const validationUri = getLink(item.links, "PUT", "validateRename")?.uri;
      if (validationUri) {
        await this.connection.put(
          validationUri
            .replace("{newname}", encodeURI(name))
            .replace("{newtype}", getTypeName(item)),
        );
      }

      // not sure why but the response of moveTo request does not return the latest etag so request it every time
      const { data: fileData } = await this.getResourceById(uri);
      const contentType = getFileContentType(name);
      const fileMetadata = this.fileMetadataMap[uri];
      const patchResponse = await this.connection.put(
        uri,
        { ...fileData, name },
        {
          headers: {
            "If-Unmodified-Since": fileMetadata.lastModified,
            "If-Match": fileMetadata.etag,
            "Content-Type": getItemContentType(item),
          },
        },
      );

      this.updateFileMetadata(uri, patchResponse, contentType);

      // The links in My Favorites are of type reference. Instead of passing
      // back the reference objects, we want to pass back the underlying source
      // objects.
      if (itemIsReference) {
        return (await this.getResourceById(item.uri)).data;
      }

      return patchResponse.data;
    } catch (error) {
      return;
    }
  }

  private getFileInfo(resourceId: string): {
    etag: string;
    lastModified: string;
    contentType: string;
  } {
    if (resourceId in this.fileMetadataMap) {
      return this.fileMetadataMap[resourceId];
    }
    const now = new Date();
    const timestamp = now.toUTCString();
    return {
      etag: "",
      lastModified: timestamp,
      contentType: DEFAULT_FILE_CONTENT_TYPE,
    };
  }

  public async saveContentToUri(uri: Uri, content: string): Promise<void> {
    const resourceId = getResourceId(uri);
    const { etag, lastModified, contentType } = this.getFileInfo(resourceId);
    const headers = {
      "Content-Type": contentType,
      "If-Unmodified-Since": lastModified,
    };
    if (etag !== "") {
      headers["If-Match"] = etag;
    }
    try {
      const res = await this.connection.put(resourceId + "/content", content, {
        headers,
      });
      this.updateFileMetadata(resourceId, res, contentType);
    } catch (error) {
      console.log(error);
    }
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

  public async addMember(
    uri: string | undefined,
    addMemberUri: string | undefined,
    properties: AddMemberProperties,
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

  public async addFavorite(item: ContentItem): Promise<boolean> {
    const myFavorites = this.getDelegateFolder("@myFavorites");
    return await this.addMember(
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
    const deleteMemberUri = item.flags?.isInMyFavorites
      ? getLink(item.links, "DELETE", "delete")?.uri
      : item.flags?.hasFavoriteId
        ? `${getResourceIdFromItem(
            this.getDelegateFolder("@myFavorites"),
          )}/members/${item.flags?.hasFavoriteId}`
        : undefined;
    if (!deleteMemberUri) {
      return false;
    }
    try {
      await this.connection.delete(deleteMemberUri);
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

  private async getRootChildren(): Promise<ContentItem[]> {
    const supportedDelegateFolders = [
      "@myFavorites",
      "@myFolder",
      "@sasRoot",
      "@myRecycleBin",
    ];
    let numberCompletedServiceCalls = 0;

    return new Promise<ContentItem[]>((resolve) => {
      supportedDelegateFolders.forEach(async (sDelegate, index) => {
        let result;
        if (sDelegate === "@sasRoot") {
          result = {
            data: ROOT_FOLDER,
          };
        } else {
          result = await this.connection.get(`/folders/folders/${sDelegate}`);
        }
        this.delegateFolders[sDelegate] = {
          ...result.data,
          uid: `${index}`,
          permission: getPermission(result.data),
        };

        numberCompletedServiceCalls++;
        if (numberCompletedServiceCalls === supportedDelegateFolders.length) {
          resolve(
            Object.entries(this.delegateFolders)
              .sort(
                // sort the delegate folders as the order in the supportedDelegateFolders
                (a, b) =>
                  supportedDelegateFolders.indexOf(a[0]) -
                  supportedDelegateFolders.indexOf(b[0]),
              )
              .map((entry) => entry[1]),
          );
        }
      });
    });
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

  private async getViyaCadence(): Promise<string> {
    try {
      const { data } = await this.connection.get(
        "/deploymentData/cadenceVersion",
      );
      return data.cadenceVersion;
    } catch (e) {
      console.error("fail to retrieve the viya cadence");
    }
    return "unknown";
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
