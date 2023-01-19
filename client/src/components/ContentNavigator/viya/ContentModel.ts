import * as vscode from "vscode";
import { ContentModel as BaseContentModel } from "../base/ContentModel";
import { ContentItem } from "../types";
import axios, { AxiosInstance } from "axios";
import * as ServicesUtil from "../utils";
import { DataDescriptor } from "./DataDescriptor";
import { getApiConfig } from "../../../connection/rest/common";
import { ROOT_FOLDER, FILE_TYPES, FOLDER_TYPES } from "./const";

export class ContentModel extends BaseContentModel {
  protected dataDescriptor: DataDescriptor;
  private conn: AxiosInstance;
  private fileTokenMaps: {
    [id: string]: { etag: string; lastModified: string };
  };

  constructor(endpoint: string, dataDescriptor: DataDescriptor) {
    super(endpoint, dataDescriptor);
    this.conn = axios.create({
      baseURL: endpoint,
    });
    this.fileTokenMaps = {};
  }

  public async serviceInit(): Promise<void> {
    try {
      const accessToken = await waitForAccessToken();
      this.conn.defaults.headers.common.Authorization = "Bearer " + accessToken;
    } catch (e) {
      ServicesUtil.ajaxErrorHandler(e);
    }
  }
  public getDataDescriptor(): DataDescriptor {
    return this.dataDescriptor;
  }

  public async getChildren(item: ContentItem): Promise<ContentItem[]> {
    console.log("model", "getChildren", item);
    if (!item) {
      return this.getRootChildren();
    }

    const parentIsContent = item === ROOT_FOLDER;

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

    const membersLink = ServicesUtil.getLink(item.links, "GET", "members");
    let membersUrl = membersLink
      ? membersLink.uri
      : item.uri
      ? item.uri + "/members"
      : null;
    if (!membersUrl) {
      const selfLink = ServicesUtil.getLink(item.links, "GET", "self");
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
    const res = await this.conn.get(membersUrl);
    const result = res.data;
    if (!result.items) {
      return Promise.reject();
    }
    const isTrash =
      "trashFolder" === this.dataDescriptor.getTypeName(item) || item.__trash__;

    result.items.forEach((child) => {
      if (isTrash) {
        child.__trash__ = true;
      }
    });
    return result.items;
  }

  public getAncestors(item: ContentItem): Promise<ContentItem[]> {
    const ancestorsLink = ServicesUtil.getLink(item.links, "GET", "ancestors");
    if (ancestorsLink) {
      return this.conn.get(ancestorsLink.uri);
    }
    return Promise.reject();
  }

  private async getRootChildren() {
    const supportedDelegateFolders = [
      "@myFavorites",
      "@myFolder" /*"@appDataFolder","@myHistory"*/,
      "@sasRoot",
      "@myRecycleBin",
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
          serviceDelegateFoldersDeferred = this.conn.get(
            "/folders/folders/" + sDelegate
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

  public async getResourceByUri(uri: vscode.Uri): Promise<ContentItem> {
    console.log("getResourceByUri", uri);
    const resourceId = uri.query.substring(3); // ?id=...
    const res = await this.conn.get(resourceId);
    this.fileTokenMaps[resourceId] = {
      etag: res.headers.etag,
      lastModified: res.headers["last-modified"],
    };
    return res.data;
  }

  public async getContentByUri(uri: vscode.Uri) {
    console.log("getContentByUri", uri);
    const resourceId = uri.query.substring(3); // ?id=...
    const res = await this.conn.get(resourceId + "/content");
    this.fileTokenMaps[resourceId] = {
      etag: res.headers.etag,
      lastModified: res.headers["last-modified"],
    };
    return res.data;
  }

  public async saveContentToUri(uri: vscode.Uri, content: string) {
    console.log("saveContentToUri", uri);
    const resourceId = uri.query.substring(3); // ?id=...
    const res = await this.conn.put(resourceId + "/content", content, {
      headers: {
        "Content-Type": "text/plain",
        "If-Match": this.fileTokenMaps[resourceId].etag,
        "If-Unmodified-Since": this.fileTokenMaps[resourceId].lastModified,
      },
    });
    console.log("save", res.headers);
    this.fileTokenMaps[resourceId] = {
      etag: res.headers.etag,
      lastModified: res.headers["last-modified"],
    };
  }
}

// FIXME: ContentModel is executed before the access token came back
function waitForAccessToken() {
  return new Promise<string>((resolve) => {
    const intervalId = setInterval(() => {
      const accessToken = getApiConfig().accessToken;
      if (accessToken && typeof accessToken === "string") {
        clearInterval(intervalId);
        resolve(accessToken);
      }
    }, 200);
  });
}
