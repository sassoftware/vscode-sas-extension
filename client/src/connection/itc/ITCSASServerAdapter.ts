import { FileType, Uri, workspace } from "vscode";

import { v4 } from "uuid";

import { ITCSession } from ".";
import { getSession } from "..";
import {
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
import { createStaticFolder } from "../../components/ContentNavigator/utils";
import { getGlobalStorageUri } from "../../components/ExtensionContext";
import { SAS_SERVER_HOME_DIRECTORY } from "../rest/RestSASServerAdapter";
import { FileProperties } from "../rest/api/compute";
import {
  getLink,
  getResourceId,
  getSasServerUri,
  resourceType,
} from "../rest/util";
import { executeCode, executeRawCode } from "./CodeRunner";
import { ScriptActions } from "./types";
import { escapePowershellString } from "./util";

class ITCSASServerAdapter implements ContentAdapter {
  protected sessionId: string;
  private rootFolders: RootFolderMap;
  private fileMetadataMap: {
    [id: string]: { etag: string; lastModified?: string; contentType?: string };
  };

  public constructor() {
    this.rootFolders = {};
  }

  public async addChildItem(): Promise<boolean> {
    throw new Error("Method not implemented");
  }

  public async addItemToFavorites(): Promise<boolean> {
    throw new Error("Method not implemented");
  }

  public removeItemFromFavorites(): Promise<boolean> {
    throw new Error("Method not implemented");
  }

  public async connect(): Promise<void> {
    return;
  }

  public connected(): boolean {
    // @TODO FIX ME
    return true;
  }

  public async createNewFolder(
    parentItem: ContentItem,
    folderName: string,
  ): Promise<ContentItem | undefined> {
    try {
      const { uri } = await this.execute(ScriptActions.CreateDirectory, {
        folderPath: parentItem.uri,
        folderName,
      });

      if (!uri) {
        return;
      }

      return this.convertPowershellResponseToContentItem({
        uri,
        name: folderName,
        creationTimeStamp: new Date().getTime().toString(),
        modifiedTimeStamp: new Date().getTime().toString(),
        category: 0,
        parentFolderUri: parentItem.uri,
        size: 0,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return;
    }
  }

  public async createNewItem(
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
    localFilePath?: string,
  ): Promise<ContentItem | undefined> {
    try {
      await this.execute(ScriptActions.CreateFile, {
        folderPath: parentItem.uri,
        fileName,
        localFilePath: localFilePath || "",
      });

      return await this.getItemAtPathWithName(parentItem.uri, fileName);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return;
    }
  }

  public async deleteItem(item: ContentItem): Promise<boolean> {
    try {
      await this.execute(ScriptActions.DeleteFile, {
        filePath: escapePowershellString(item.uri),
        recursive: item.fileStat.type === FileType.Directory,
      });
      return true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return false;
    }
  }

  public async getChildItems(parentItem: ContentItem): Promise<ContentItem[]> {
    // If the user is fetching child items of the root folder, give them the
    // "home" directory
    if (parentItem.id === SERVER_FOLDER_ID) {
      const items = await this.execute(ScriptActions.GetChildItems, {
        path: "/",
      });
      const uri = items[0].parentFolderUri;
      const homeDirectory: ContentItem = {
        creationTimeStamp: 0,
        id: uri,
        links: [
          { method: "GET", rel: "self", href: uri, uri, type: "GET" },
          {
            method: "GET",
            rel: "getDirectoryMembers",
            href: "/",
            uri,
            type: "GET",
          },
        ],
        modifiedTimeStamp: 0,
        name: "Home",
        uri,
        permission: {
          write: true,
          delete: false,
          addMember: true,
        },
        type: SERVER_HOME_FOLDER_TYPE,
        fileStat: {
          ctime: 0,
          mtime: 0,
          size: 0,
          type: FileType.Directory,
        },
      };
      homeDirectory.contextValue = resourceType(homeDirectory);
      return [homeDirectory];
    }

    const response = await this.execute(ScriptActions.GetChildItems, {
      path: getLink(parentItem.links, "GET", "getDirectoryMembers").uri,
    });
    // Even though we specify a response array in powershell, if there is
    // only 1 item it returns _just_ the item
    const items = Array.isArray(response) ? response : [response];
    const childItems = items.map(this.convertPowershellResponseToContentItem);

    return childItems;
  }

  private convertPowershellResponseToContentItem(response: any): ContentItem {
    // response.category can be 0, 1, or 2. 0 is directory, 1 is "sas" type, 2 is other file types
    const type = response.category === 0 ? FileType.Directory : FileType.File;
    const uri = response.uri;
    const links = [
      type === FileType.Directory && {
        method: "GET",
        rel: "getDirectoryMembers",
        href: uri,
        uri: uri,
        type: "GET",
      },
      { method: "GET", rel: "self", href: uri, uri: uri, type: "GET" },
    ].filter((link) => link);

    const item = {
      id: uri,
      uri,
      name: response.name,
      creationTimeStamp: 0,
      modifiedTimeStamp: response.modifiedTimeStamp.replace(/[^0-9]/g, ""),
      links,
      permission: {
        write: true,
        delete: true,
        addMember: type === FileType.Directory,
      },
      type: "",
      parentFolderUri: response.parentFolderUri,
      fileStat: {
        ctime: 0,
        mtime: response.modifiedTimeStamp.replace(/[^0-9]/g, ""),
        size: response.size,
        type,
      },
    };

    return {
      ...item,
      contextValue: resourceType(item),
      vscUri: getSasServerUri(item, false),
    };
  }

  private async execute(
    incomingCode: string,
    params: Record<string, string | boolean>,
    processedParams?: Record<string, string>,
  ) {
    let code = incomingCode;
    Object.keys(params).forEach((key: string) => {
      const replacement =
        typeof params[key] === "string"
          ? escapePowershellString(params[key])
          : params[key]
            ? "$true"
            : "$false";
      code = code.replace(`$${key}`, replacement);
    });
    Object.keys(processedParams || {}).forEach((key: string) => {
      code = code.replace(`$${key}`, processedParams[key]);
    });

    const output = await executeRawCode(code);
    return output ? JSON.parse(output) : "";
  }

  public async getContentOfItem(item: ContentItem): Promise<string> {
    const filePath = item.uri;
    const tempFile = v4();
    const globalStorageUri = getGlobalStorageUri();
    try {
      await workspace.fs.readDirectory(globalStorageUri);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      await workspace.fs.createDirectory(globalStorageUri);
    }

    const outputFile = Uri.joinPath(globalStorageUri, tempFile);

    try {
      await this.execute(ScriptActions.FetchFileContent, {
        filePath,
        outputFile: outputFile.fsPath,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      // TODO WE SHOULD REALLY FIGURE OUT HOW TO RESOLVE THIS BECAUSE WE
      // STILL SEE THE ERROR ALTHOUGH WE SHOULDN'T
      return "";
    }

    const file = await workspace.fs.readFile(outputFile);
    return (file || "").toString();
  }

  public async getContentOfUri(uri: Uri): Promise<string> {
    const item = await this.getItemAtPath(getResourceId(uri));
    return await this.getContentOfItem(item);
  }

  public async getFolderPathForItem(): Promise<string> {
    // This is for creating a filename statement which won't work as expected for
    // file system files.
    return "";
  }

  protected async getItemAtPathWithName(
    path: string,
    name: string,
  ): Promise<ContentItem> {
    const response = await this.execute(ScriptActions.GetChildItems, {
      path,
    });
    const items = Array.isArray(response) ? response : [response];
    const foundItem = items.find((item) => item.name === name);
    return this.convertPowershellResponseToContentItem(foundItem);
  }

  protected async getItemAtPath(path: string): Promise<ContentItem> {
    // TODO We may need to handle this differently
    const pathPieces = path.split("\\");
    const name = pathPieces.pop();

    return await this.getItemAtPathWithName(pathPieces.join("\\"), name);
  }

  public async getItemOfUri(uri: Uri): Promise<ContentItem> {
    return this.getItemAtPath(getResourceId(uri));
  }

  public async getParentOfItem(): Promise<ContentItem | undefined> {
    // This is required for creating a flow, which isn't available for sas9
    return undefined;
  }

  public getRootFolder(): ContentItem | undefined {
    // This is required for favorites, which aren't available for sas9
    return undefined;
  }

  public async getRootItems(): Promise<RootFolderMap> {
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
    return item.vscUri;
  }

  public async moveItem(
    item: ContentItem,
    targetParentFolderUri: string,
  ): Promise<Uri | undefined> {
    try {
      const response = await this.execute(ScriptActions.RenameFile, {
        oldPath: item.uri,
        newPath: targetParentFolderUri,
        newName: item.name,
      });
      if (response.length === 0) {
        return undefined;
      }
      return this.convertPowershellResponseToContentItem(response[0]).vscUri;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return undefined;
    }
  }

  public async renameItem(
    item: ContentItem,
    newName: string,
  ): Promise<ContentItem | undefined> {
    try {
      const response = await this.execute(ScriptActions.RenameFile, {
        oldPath: item.uri,
        newPath: item.parentFolderUri,
        newName,
      });
      if (response.length === 0) {
        return undefined;
      }
      return this.convertPowershellResponseToContentItem(response[0]);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return undefined;
    }
  }

  public async updateContentOfItem(uri: Uri, content: string): Promise<void> {
    const item = await this.getItemAtPath(getResourceId(uri));

    await this.execute(ScriptActions.UpdateFile, {
      filePath: item.uri,
      content,
    });
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

    const item = {
      id,
      uri: id,
      name: fileProperties.name,
      creationTimeStamp: 0,
      modifiedTimeStamp: 0,
      links,
      permission: {
        write: false,
        delete: false,
        addMember: false,
      },
      flags,
      type: fileProperties.type || "",
      parentFolderUri: "",
    };

    return {
      ...item,
      contextValue: resourceType(item),
      fileStat: {
        ctime: item.creationTimeStamp,
        mtime: item.modifiedTimeStamp,
        size: 0,
        type: FileType.Directory,
      },
      // isReference: isReference(item),
      // resourceId: getResourceIdFromItem(item),
      // vscUri: getSasServerUri(item, flags?.isInRecycleBin || false),
      // typeName: getTypeName(item),
    };
  }
}

export default ITCSASServerAdapter;
