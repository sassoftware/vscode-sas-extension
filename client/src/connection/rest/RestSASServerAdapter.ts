// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { FileType, Uri } from "vscode";

import { AxiosResponse } from "axios";

import { getSession } from "..";
import {
  FOLDER_TYPES,
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
import {
  createStaticFolder,
  isReference,
} from "../../components/ContentNavigator/utils";
import { appendSessionLogFn } from "../../components/logViewer";
import { FileProperties, FileSystemApi } from "./api/compute";
import { getApiConfig } from "./common";
import {
  getLink,
  getResourceId,
  getResourceIdFromItem,
  getSasServerUri,
  getTypeName,
  resourceType,
} from "./util";

const SAS_SERVER_HOME_DIRECTORY = "SAS_SERVER_HOME_DIRECTORY";

class RestSASServerAdapter implements ContentAdapter {
  protected baseUrl: string;
  protected fileSystemApi: ReturnType<typeof FileSystemApi>;
  protected sessionId: string;
  private rootFolders: RootFolderMap;
  private fileMetadataMap: {
    [id: string]: { etag: string; lastModified?: string; contentType?: string };
  };

  public constructor() {
    this.rootFolders = {};
    this.fileMetadataMap = {};
  }

  public async connect(): Promise<void> {
    const session = getSession();
    session.onSessionLogFn = appendSessionLogFn;

    await session.setup(true);

    this.sessionId = session?.sessionId();
    // This proxies all calls to the fileSystem api to reconnect
    // if we ever get a 401 (unauthorized)
    const reconnect = async () => await this.connect();
    this.fileSystemApi = new Proxy(FileSystemApi(getApiConfig()), {
      get: function (target, property) {
        if (typeof target[property] === "function") {
          return new Proxy(target[property], {
            apply: async function (target, _this, argList) {
              try {
                return await target(...argList);
              } catch (error) {
                if (error.response?.status !== 401) {
                  throw error;
                }

                await reconnect();

                return await target(...argList);
              }
            },
          });
        }

        return target[property];
      },
    });
  }

  public connected(): boolean {
    // TODO (sas-server)
    return true;
  }

  public async setup(): Promise<void> {
    if (this.sessionId && this.fileSystemApi) {
      return;
    }

    await this.connect();
  }

  public async addChildItem(
    childItemUri: string | undefined,
    parentItemUri: string | undefined,
    properties: AddChildItemProperties,
  ): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async addItemToFavorites(item: ContentItem): Promise<boolean> {
    throw new Error("fds Method not implemented.");
  }

  public async createNewFolder(
    parentItem: ContentItem,
    folderName: string,
  ): Promise<ContentItem | undefined> {
    const response = await this.fileSystemApi.createFileOrDirectory({
      sessionId: this.sessionId,
      fileOrDirectoryPath: this.trimComputePrefix(parentItem.uri),
      fileProperties: { name: folderName, isDirectory: true },
    });

    return this.filePropertiesToContentItem(response.data);
  }

  public async createNewItem(
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<ContentItem | undefined> {
    const response = await this.fileSystemApi.createFileOrDirectory({
      sessionId: this.sessionId,
      fileOrDirectoryPath: this.trimComputePrefix(parentItem.uri),
      fileProperties: { name: fileName, isDirectory: false },
    });

    const contentItem = this.filePropertiesToContentItem(response.data);

    if (buffer) {
      await this.updateContentOfItemAtPath(
        this.trimComputePrefix(contentItem.uri),
        new TextDecoder().decode(buffer),
      );
    }

    return contentItem;
  }

  public async deleteItem(item: ContentItem): Promise<boolean> {
    const filePath = this.trimComputePrefix(item.uri);
    try {
      await this.fileSystemApi.deleteFileOrDirectoryFromSystem({
        sessionId: this.sessionId,
        fileOrDirectoryPath: filePath,
        ifMatch: "",
      });
      delete this.fileMetadataMap[filePath];
      return true;
    } catch (e) {
      return false;
    }
  }

  public async getChildItems(parentItem: ContentItem): Promise<ContentItem[]> {
    // If the user is fetching child items of the root folder, give them the
    // "home" directory
    if (parentItem.id === SERVER_FOLDER_ID) {
      return [
        this.filePropertiesToContentItem(
          createStaticFolder(
            SAS_SERVER_HOME_DIRECTORY,
            "Home",
            SERVER_HOME_FOLDER_TYPE,
            `/compute/sessions/${this.sessionId}/files/~fs~/members`,
            "getDirectoryMembers",
          ),
        ),
      ];
    }

    const allItems = [];
    const limit = 100;
    let start = 0;
    let totalItemCount = 0;
    do {
      const response = await this.fileSystemApi.getDirectoryMembers({
        sessionId: this.sessionId,
        directoryPath: this.trimComputePrefix(
          getLink(parentItem.links, "GET", "getDirectoryMembers").uri,
        ).replace("/members", ""),
        limit,
        start,
      });
      totalItemCount = response.data.count;

      allItems.push(
        ...response.data.items.map((childItem: FileProperties, index) => ({
          ...this.filePropertiesToContentItem(childItem),
          uid: `${parentItem.uid}/${index + start}`,
        })),
      );

      start += limit;
    } while (start < totalItemCount);

    return allItems.sort((a, b) => {
      const aIsDirectory = a.fileStat?.type === FileType.Directory;
      const bIsDirectory = b.fileStat?.type === FileType.Directory;
      if (aIsDirectory && !bIsDirectory) {
        return -1;
      } else if (!aIsDirectory && bIsDirectory) {
        return 1;
      } else {
        return a.name.localeCompare(b.name);
      }
    });
  }

  public async getContentOfItem(item: ContentItem): Promise<string> {
    const path = this.trimComputePrefix(item.uri);
    return await this.getContentOfItemAtPath(path);
  }

  public async getContentOfUri(uri: Uri): Promise<string> {
    const path = this.trimComputePrefix(getResourceId(uri));
    return await this.getContentOfItemAtPath(path);
  }

  private async getContentOfItemAtPath(path: string) {
    const response = await this.fileSystemApi.getFileContentFromSystem(
      {
        sessionId: this.sessionId,
        filePath: path,
      },
      {
        responseType: "arraybuffer",
      },
    );

    this.updateFileMetadata(path, response);

    // Disabling typescript checks on this line as this function is typed
    // to return AxiosResponse<void,any>. However, it appears to return
    // AxiosResponse<string,>.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return response.data as unknown as string;
  }

  public async getFolderPathForItem(): Promise<string> {
    // This is for creating a filename statement which won't work as expected for
    // file system files.
    return "";
  }

  public async getItemOfUri(uri: Uri): Promise<ContentItem> {
    const fileOrDirectoryPath = this.trimComputePrefix(getResourceId(uri));
    const response = await this.fileSystemApi.getFileorDirectoryProperties({
      sessionId: this.sessionId,
      fileOrDirectoryPath,
    });

    this.updateFileMetadata(fileOrDirectoryPath, response);

    return this.filePropertiesToContentItem(response.data);
  }

  public async getParentOfItem(
    item: ContentItem,
  ): Promise<ContentItem | undefined> {
    const parentPathPieces = this.trimComputePrefix(item.uri).split("~fs~");
    parentPathPieces.pop();
    const fileOrDirectoryPath = parentPathPieces.join("~fs~");
    const response = await this.fileSystemApi.getFileorDirectoryProperties({
      sessionId: this.sessionId,
      fileOrDirectoryPath,
    });

    return this.filePropertiesToContentItem(response.data);
  }

  public getRootFolder(): ContentItem | undefined {
    return undefined;
  }

  public async getRootItems(): Promise<RootFolderMap> {
    await this.setup();

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

  public async getUriOfItem(item: ContentItem): Promise<Uri> {
    if (item.type !== "reference") {
      return item.vscUri;
    }

    return item.vscUri;
    // // If we're attempting to open a favorite, open the underlying file instead.
    // try {
    //   return (await this.getItemOfId(item.uri)).vscUri;
    // } catch (error) {
    //   return item.vscUri;
    // }
  }

  public async moveItem(
    item: ContentItem,
    targetParentFolderUri: string,
  ): Promise<boolean> {
    const currentFilePath = this.trimComputePrefix(item.uri);
    const newFilePath = this.trimComputePrefix(targetParentFolderUri);
    const { etag } = await this.getFileInfo(currentFilePath, true);
    const params = {
      sessionId: this.sessionId,
      fileOrDirectoryPath: currentFilePath,
      ifMatch: etag,
      fileProperties: {
        name: item.name,
        path: newFilePath.split("~fs~").join("/"),
      },
    };

    const response =
      await this.fileSystemApi.updateFileOrDirectoryOnSystem(params);
    delete this.fileMetadataMap[currentFilePath];
    this.updateFileMetadata(newFilePath, response);

    return !!this.filePropertiesToContentItem(response.data);
  }

  public async removeItemFromFavorites(item: ContentItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async renameItem(
    item: ContentItem,
    newName: string,
  ): Promise<ContentItem | undefined> {
    const filePath = this.trimComputePrefix(item.uri);

    const parsedFilePath = filePath.split("~fs~");
    parsedFilePath.pop();
    const path = parsedFilePath.join("/");

    const response = await this.fileSystemApi.updateFileOrDirectoryOnSystem({
      sessionId: this.sessionId,
      fileOrDirectoryPath: filePath,
      ifMatch: "",
      fileProperties: { name: newName, path },
    });

    this.updateFileMetadata(filePath, response);

    return this.filePropertiesToContentItem(response.data);
  }

  public async updateContentOfItem(uri: Uri, content: string): Promise<void> {
    const filePath = this.trimComputePrefix(getResourceId(uri));
    return await this.updateContentOfItemAtPath(filePath, content);
  }

  private async updateContentOfItemAtPath(
    filePath: string,
    content: string,
  ): Promise<void> {
    const { etag } = await this.getFileInfo(filePath);
    const data = {
      sessionId: this.sessionId,
      filePath,
      // updateFileContentOnSystem requires body to be a File type. However, the
      // underlying code is expecting a string. This forces compute to accept
      // a string.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      body: content as unknown as File,
      ifMatch: etag,
    };
    const response = await this.fileSystemApi.updateFileContentOnSystem(data);

    this.updateFileMetadata(filePath, response);
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
    const isRootFolder = [SERVER_FOLDER_ID, SAS_SERVER_HOME_DIRECTORY].includes(
      id,
    );
    const item = {
      id,
      uri: id,
      name: fileProperties.name,
      creationTimeStamp: 0,
      modifiedTimeStamp: new Date(fileProperties.modifiedTimeStamp).getTime(),
      links,
      permission: {
        write: !isRootFolder && !fileProperties.readOnly,
        delete: !isRootFolder && !fileProperties.readOnly,
        addMember:
          !!getLink(links, "POST", "makeDirectory") ||
          !!getLink(links, "POST", "createFile"),
      },
      flags,
      type: fileProperties.type || "",
    };

    const typeName = getTypeName(item);

    return {
      ...item,
      contextValue: resourceType(item),
      fileStat: {
        ctime: item.creationTimeStamp,
        mtime: item.modifiedTimeStamp,
        size: 0,
        type:
          fileProperties.isDirectory ||
          FOLDER_TYPES.indexOf(typeName) >= 0 ||
          isRootFolder
            ? FileType.Directory
            : FileType.File,
      },
      isReference: isReference(item),
      resourceId: getResourceIdFromItem(item),
      vscUri: getSasServerUri(item, flags?.isInRecycleBin || false),
      typeName: getTypeName(item),
    };
  }

  private trimComputePrefix(uri: string): string {
    return decodeURI(
      uri.replace(`/compute/sessions/${this.sessionId}/files/`, ""),
    );
  }

  private updateFileMetadata(id: string, { headers }: AxiosResponse) {
    this.fileMetadataMap[id] = {
      etag: headers.etag,
    };

    return this.fileMetadataMap[id];
  }

  private async getFileInfo(path: string, forceRefresh?: boolean) {
    if (!forceRefresh && path in this.fileMetadataMap) {
      return this.fileMetadataMap[path];
    }

    // If we don't have file metadata stored, lets attempt to fetch it
    try {
      const response = await this.fileSystemApi.getFileorDirectoryProperties({
        sessionId: this.sessionId,
        fileOrDirectoryPath: path,
      });
      return this.updateFileMetadata(path, response);
    } catch (e) {
      // Intentionally blank
    }

    return {
      etag: "",
    };
  }
}

export default RestSASServerAdapter;
