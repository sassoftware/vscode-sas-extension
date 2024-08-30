import { FileType, Uri } from "vscode";

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
  isItemInRecycleBin,
  isReference,
} from "../../components/ContentNavigator/utils";
import { appendSessionLogFn } from "../../components/logViewer";
import { FileProperties, FileSystemApi } from "./api/compute";
import { getApiConfig } from "./common";
import {
  getLink,
  getPermission,
  getResourceId,
  getResourceIdFromItem,
  getSasServerUri,
  getTypeName,
  resourceType,
} from "./util";

class RestSASServerAdapter implements ContentAdapter {
  protected baseUrl: string;
  protected fileSystemApi: ReturnType<typeof FileSystemApi>;
  protected sessionId: string;
  private rootFolders: RootFolderMap;

  public constructor() {
    this.rootFolders = {};
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
    throw new Error("cnf Method not implemented.");
  }

  public async createNewItem(
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<ContentItem | undefined> {
    throw new Error("cni Method not implemented.");
  }

  public async deleteItem(item: ContentItem): Promise<boolean> {
    throw new Error("di Method not implemented.");
  }

  public async getChildItems(parentItem: ContentItem): Promise<ContentItem[]> {
    // If the user is fetching child items of the root folder, give them the
    // "home" directory
    const id = "SAS_SERVER_HOME_DIRECTORY";
    if (parentItem.id === SERVER_FOLDER_ID) {
      return [
        this.enrichWithDataProviderProperties({
          ...createStaticFolder(
            id,
            "Home",
            "userRoot",
            `/compute/sessions/${this.sessionId}/files/~fs~/members`,
            "getDirectoryMembers",
          ),
          creationTimeStamp: 0,
          modifiedTimeStamp: 0,
          permission: undefined,
        }),
      ];
    }

    const { data } = await this.fileSystemApi.getDirectoryMembers({
      sessionId: this.sessionId,
      directoryPath: parseMemberUri(
        getLink(parentItem.links, "GET", "getDirectoryMembers").uri,
        this.sessionId,
      ),
    });

    // TODO (sas-server) We need to paginate and sort results
    return data.items.map((childItem: FileProperties, index) => ({
      ...this.filePropertiesToContentItem(childItem),
      uid: `${parentItem.uid}/${index}`,
      ...this.enrichWithDataProviderProperties(
        this.filePropertiesToContentItem(childItem),
      ),
    }));

    function parseMemberUri(uri: string, sessionId: string): string {
      return uri
        .replace(`/compute/sessions/${sessionId}/files/`, "")
        .replace("/members", "");
    }
  }

  public async getContentOfItem(item: ContentItem): Promise<string> {
    throw new Error("getContentOfItem");
  }

  public async getContentOfUri(uri: Uri): Promise<string> {
    // TODO (sas-server) We're using this a bunch. Make things more better-er
    const path = getResourceId(uri).replace(
      `/compute/sessions/${this.sessionId}/files/`,
      "",
    );

    const { data } = await this.fileSystemApi.getFileContentFromSystem(
      {
        sessionId: this.sessionId,
        filePath: path,
      },
      {
        responseType: "arraybuffer",
      },
    );

    // Disabling typescript checks on this line as this function is typed
    // to return AxiosResponse<void,any>. However, it appears to return
    // AxiosResponse<string,>.
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return data as unknown as string;
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
      // TODO (sas-server) cleanup/reuse this
      fileOrDirectoryPath: resourceId.replace(
        `/compute/sessions/${this.sessionId}/files/`,
        "",
      ),
    });

    return this.enrichWithDataProviderProperties(
      this.filePropertiesToContentItem(data),
    );
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
        ...this.enrichWithDataProviderProperties(result.data),
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
    throw new Error("Method not implemented.");
  }

  public async restoreItem(item: ContentItem): Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  public async updateContentOfItem(uri: Uri, content: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  private enrichWithDataProviderProperties(
    item: ContentItem,
    flags?: ContentItem["flags"],
  ): ContentItem {
    item.flags = flags;
    return {
      ...item,
      permission: getPermission(item),
      contextValue: resourceType(item),
      fileStat: {
        ctime: item.creationTimeStamp,
        mtime: item.modifiedTimeStamp,
        size: 0,
        type: getIsContainer(item) ? FileType.Directory : FileType.File,
      },
      isReference: isReference(item),
      resourceId: getResourceIdFromItem(item),
      vscUri: getSasServerUri(item, flags?.isInRecycleBin || false),
      typeName: getTypeName(item),
    };

    function getIsContainer(item: ContentItem): boolean {
      if (item.fileStat?.type === FileType.Directory) {
        return true;
      }

      const typeName = getTypeName(item);
      if (isItemInRecycleBin(item) && isReference(item)) {
        return false;
      }
      if (FOLDER_TYPES.indexOf(typeName) >= 0) {
        return true;
      }
      return false;
    }
  }

  private filePropertiesToContentItem(
    fileProperties: FileProperties,
  ): ContentItem {
    const links = fileProperties.links.map((link) => ({
      method: link.method,
      rel: link.rel,
      href: link.href,
      type: link.type,
      uri: link.uri,
    }));

    const id = getLink(links, "GET", "self").uri;
    return {
      id,
      uri: id,
      name: fileProperties.name,
      creationTimeStamp: 0,
      modifiedTimeStamp: new Date(fileProperties.modifiedTimeStamp).getTime(),
      links,
      // These will be overwritten
      permission: {
        write: false,
        delete: false,
        addMember: false,
      },
      fileStat: {
        type: fileProperties.isDirectory ? FileType.Directory : FileType.File,
        ctime: 0,
        mtime: 0,
        size: 0,
      },
    };
  }
}

export default RestSASServerAdapter;
