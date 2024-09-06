import { FileType, Uri } from "vscode";

import { AxiosResponse } from "axios";

import { getSession } from "..";
import {
  FOLDER_TYPES,
  SAS_SERVER_ROOT_FOLDER,
  SAS_SERVER_ROOT_FOLDERS,
  SERVER_FOLDER_ID,
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
    this.fileSystemApi = FileSystemApi(getApiConfig());
  }

  public connected(): boolean {
    // TODO
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

    if (buffer) {
      const etag = response.headers.etag;
      // TODO (sas-server) This could be combined with update content most likely.
      const filePath = this.trimComputePrefix(
        getLink(response.data.links, "GET", "self").uri,
      );
      await this.fileSystemApi.updateFileContentOnSystem({
        sessionId: this.sessionId,
        filePath,
        body: new File([buffer], response.data.name),
        ifMatch: etag,
      });
    }

    return this.filePropertiesToContentItem(response.data);
  }

  public async deleteItem(item: ContentItem): Promise<boolean> {
    throw new Error("di Method not implemented.");
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
            "userRoot",
            `/compute/sessions/${this.sessionId}/files/~fs~/members`,
            "getDirectoryMembers",
          ),
        ),
      ];
    }

    const { data } = await this.fileSystemApi.getDirectoryMembers({
      sessionId: this.sessionId,
      directoryPath: this.trimComputePrefix(
        getLink(parentItem.links, "GET", "getDirectoryMembers").uri,
      ).replace("/members", ""),
    });

    // TODO (sas-server) We need to paginate and sort results
    return data.items.map((childItem: FileProperties, index) => ({
      ...this.filePropertiesToContentItem(childItem),
      uid: `${parentItem.uid}/${index}`,
    }));
  }

  public async getContentOfItem(item: ContentItem): Promise<string> {
    throw new Error("getContentOfItem");
  }

  public async getContentOfUri(uri: Uri): Promise<string> {
    const path = this.trimComputePrefix(getResourceId(uri));

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

  public async getFolderPathForItem(item: ContentItem): Promise<string> {
    throw new Error("getFolderPathForItem Method not implemented.");
  }

  public async getItemOfId(id: string): Promise<ContentItem> {
    throw new Error("getItemOfId Method not implemented.");
  }

  public async getItemOfUri(uri: Uri): Promise<ContentItem> {
    const resourceId = getResourceId(uri);

    const { data } = await this.fileSystemApi.getFileorDirectoryProperties({
      sessionId: this.sessionId,
      fileOrDirectoryPath: this.trimComputePrefix(resourceId),
    });

    return this.filePropertiesToContentItem(data);
  }

  public async getParentOfItem(
    item: ContentItem,
  ): Promise<ContentItem | undefined> {
    throw new Error("getParentOfItem Method not implemented.");
  }

  public getRootFolder(name: string): ContentItem | undefined {
    throw new Error("getRootFolder Method not implemented.");
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
    const filePath = this.trimComputePrefix(item.uri);

    const isDirectory = item.fileStat?.type === FileType.Directory;
    const parsedFilePath = filePath.split("~fs~");
    parsedFilePath.pop();
    const path = parsedFilePath.join("/");

    const response = await this.fileSystemApi.updateFileOrDirectoryOnSystem({
      sessionId: this.sessionId,
      fileOrDirectoryPath: filePath,
      ifMatch: "",
      fileProperties: { name: newName, path, isDirectory },
    });

    this.updateFileMetadata(filePath, response);

    return this.filePropertiesToContentItem(response.data);
  }

  public async restoreItem(item: ContentItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async updateContentOfItem(uri: Uri, content: string): Promise<void> {
    const filePath = this.trimComputePrefix(getResourceId(uri));
    const { etag } = this.getFileInfo(filePath);

    const response = await this.fileSystemApi.updateFileContentOnSystem({
      sessionId: this.sessionId,
      filePath,
      // updateFileContentOnSystem requires body to be a File type. However, the
      // underlying code is expecting a string. This forces compute to accept
      // a string.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      body: content as unknown as File,
      ifMatch: etag,
    });

    this.updateFileMetadata(filePath, response);
  }

  private filePropertiesToContentItem(
    fileProperties: FileProperties,
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
    return uri.replace(`/compute/sessions/${this.sessionId}/files/`, "");
  }

  private updateFileMetadata(id: string, { headers }: AxiosResponse) {
    this.fileMetadataMap[id] = {
      etag: headers.etag,
    };
  }

  private getFileInfo(resourceId: string) {
    if (resourceId in this.fileMetadataMap) {
      return this.fileMetadataMap[resourceId];
    }
    return {
      etag: "",
    };
  }
}

export default RestSASServerAdapter;
