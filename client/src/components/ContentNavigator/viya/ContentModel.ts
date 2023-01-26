import axios, { AxiosInstance } from "axios";
import { ContentItem, Link } from "../types";
import { DataDescriptor } from "./DataDescriptor";
import { ROOT_FOLDER, FILE_TYPES, FOLDER_TYPES, TRASH_FOLDER } from "./const";
import { Uri } from "vscode";
import { ajaxErrorHandler, getLink, getResourceId } from "../utils";
import { apiConfig } from "../../../session/rest";

interface AddMemberProperties {
  name?: string;
  contentType?: string;
}

export class ContentModel {
  protected dataDescriptor: DataDescriptor;
  private connection: AxiosInstance;
  private fileTokenMaps: {
    [id: string]: { etag?: string; lastModified: string };
  };
  private authorized: boolean;

  constructor(baseURL: string, dataDescriptor: DataDescriptor) {
    this.connection = axios.create({ baseURL });
    this.fileTokenMaps = {};
    this.dataDescriptor = dataDescriptor;
    this.authorized = false;
  }

  public setup(): void {
    this.connection.defaults.headers.common.Authorization =
      "Bearer " + apiConfig.accessToken;
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

    result.items.forEach((child) => {
      if (isTrash) {
        child.__trash__ = true;
      }
    });

    return result.items;
  }

  public getAncestors(item: ContentItem): Promise<ContentItem[]> {
    const ancestorsLink = getLink(item.links, "GET", "ancestors");
    if (ancestorsLink) {
      return this.connection.get(ancestorsLink.uri);
    }
    return Promise.reject();
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
    const res = await this.connection.get(resourceId + "/content");
    this.fileTokenMaps[resourceId] = {
      etag: res.headers.etag,
      lastModified: res.headers["last-modified"],
    };

    // We expect the returned data to be a string. If this isn't a string,
    // we can't really open it
    if (typeof res.data === "object") {
      throw new Error("Cannot open file");
    }

    return res.data;
  }

  public async createFile(
    item: ContentItem,
    fileName: string
  ): Promise<boolean> {
    const contentType = await this.getFileContentType(fileName);

    let fileCreationResponse = null;
    try {
      fileCreationResponse = await this.connection.post(
        `/files/files#rawUpload?typeDefName=${contentType}`,
        Buffer.from("", "binary"),
        {
          headers: {
            "Content-Type": "text/plain",
            // TODO #56 This doesn't work with Chinese characters
            "Content-Disposition": `filename="${fileName}"`,
          },
        }
      );
    } catch (error) {
      return false;
    }

    const fileLink: Link | null = getLink(
      (fileCreationResponse.data as ContentItem).links,
      "GET",
      "self"
    );

    return await this.addMember(
      fileLink?.uri,
      getLink(item.links, "POST", "addMember")?.uri,
      {
        name: fileName,
        contentType,
      }
    );
  }

  public async createFolder(item: ContentItem, name: string): Promise<boolean> {
    try {
      await this.connection.post(
        `/folders/folders?parentFolderUri=${item.uri}`,
        {
          name,
        }
      );
    } catch (error) {
      return false;
    }

    return true;
  }

  public async renameResource(
    item: ContentItem,
    name: string
  ): Promise<boolean> {
    // If we don't have a file token map for this resoure, lets grab
    // it from the server
    let fileTokenMap = this.fileTokenMaps[item.uri];
    if (!fileTokenMap) {
      try {
        const res = await this.connection.get(item.uri);
        fileTokenMap = {
          etag: res.headers.etag,
          lastModified: res.headers["last-modified"],
        };
      } catch (error) {
        return false;
      }
    }

    try {
      const patchResponse = await this.connection.patch(
        item.uri,
        { name },
        {
          headers: {
            "If-Unmodified-Since": this.fileTokenMaps[item.uri].lastModified,
            "If-Match": this.fileTokenMaps[item.uri].etag,
          },
        }
      );

      this.fileTokenMaps[item.uri] = {
        etag: patchResponse.headers.etag,
        lastModified: patchResponse.headers["last-modified"],
      };
    } catch (error) {
      return false;
    }

    return true;
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
      // TODO #56 Include recycle bin in next iteration
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
