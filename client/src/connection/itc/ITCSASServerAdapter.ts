// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { FileType, Uri, workspace } from "vscode";

import { v4 } from "uuid";

import {
  SAS_SERVER_ROOT_FOLDER,
  SAS_SERVER_ROOT_FOLDERS,
  SERVER_FOLDER_ID,
  SERVER_HOME_FOLDER_TYPE,
} from "../../components/ContentNavigator/const";
import {
  ContentAdapter,
  ContentItem,
  RootFolderMap,
} from "../../components/ContentNavigator/types";
import {
  convertStaticFolderToContentItem,
  createStaticFolder,
} from "../../components/ContentNavigator/utils";
import { getGlobalStorageUri } from "../../components/ExtensionContext";
import {
  getLink,
  getResourceId,
  getSasServerUri,
  resourceType,
} from "../rest/util";
import { executeRawCode } from "./CodeRunner";
import { PowershellResponse, ScriptActions } from "./types";
import { escapePowershellString } from "./util";

class ITCSASServerAdapter implements ContentAdapter {
  protected sessionId: string;
  private rootFolders: RootFolderMap;

  public constructor() {
    this.rootFolders = {};
  }

  /* The following methods are needed for favorites, which are not applicable to sas server */
  public async addChildItem(): Promise<boolean> {
    throw new Error("Method not implemented");
  }
  public async addItemToFavorites(): Promise<boolean> {
    throw new Error("Method not implemented");
  }
  public removeItemFromFavorites(): Promise<boolean> {
    throw new Error("Method not implemented");
  }
  public getRootFolder(): ContentItem | undefined {
    return undefined;
  }

  /* The following is needed for creating a flow, which isn't supported on sas server */
  public async getParentOfItem(): Promise<ContentItem | undefined> {
    return undefined;
  }

  /* The following is needed for creating a filename statement, which isn't supported on sas server */
  public async getFolderPathForItem(): Promise<string> {
    return "";
  }

  public async connect(): Promise<void> {
    return;
  }

  public connected(): boolean {
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
    _buffer?: ArrayBufferLike,
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
      return [
        convertStaticFolderToContentItem(
          createStaticFolder(
            uri,
            "Home",
            SERVER_HOME_FOLDER_TYPE,
            "/",
            "getDirectoryMembers",
          ),
          {
            write: true,
            delete: false,
            addMember: true,
          },
        ),
      ];
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
      return "";
    }

    const file = await workspace.fs.readFile(outputFile);
    const fileContents = (file || "").toString();
    await workspace.fs.delete(outputFile);
    return fileContents;
  }

  public async getContentOfUri(uri: Uri): Promise<string> {
    const item = await this.getItemAtPath(getResourceId(uri));
    return await this.getContentOfItem(item);
  }

  public async getItemOfUri(uri: Uri): Promise<ContentItem> {
    return this.getItemAtPath(getResourceId(uri));
  }

  public async getRootItems(): Promise<RootFolderMap> {
    for (let index = 0; index < SAS_SERVER_ROOT_FOLDERS.length; ++index) {
      const delegateFolderName = SAS_SERVER_ROOT_FOLDERS[index];
      this.rootFolders[delegateFolderName] = {
        uid: `${index}`,
        ...convertStaticFolderToContentItem(SAS_SERVER_ROOT_FOLDER, {
          write: false,
          delete: false,
          addMember: false,
        }),
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
    const pathPieces = path.split("\\");
    const name = pathPieces.pop();

    return await this.getItemAtPathWithName(pathPieces.join("\\"), name);
  }

  private convertPowershellResponseToContentItem(
    response: PowershellResponse,
  ): ContentItem {
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

    const modifiedTimeStamp = new Date(
      response.modifiedTimeStamp.replace(/[^0-9]/g, ""),
    ).getTime();
    const item: ContentItem = {
      id: uri,
      uri,
      name: response.name,
      creationTimeStamp: new Date(response.creationTimeStamp).getTime() ?? 0,
      modifiedTimeStamp,
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
        mtime: modifiedTimeStamp,
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
}

export default ITCSASServerAdapter;
