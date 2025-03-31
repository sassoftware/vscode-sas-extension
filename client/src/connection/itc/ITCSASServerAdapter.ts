// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { FileType, Uri, workspace } from "vscode";

import { v4 } from "uuid";

import { onRunError } from "../../commands/run";
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
  sortedContentItems,
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
      const { success, data } = await this.execute(
        ScriptActions.CreateDirectory,
        {
          folderPath: parentItem.uri,
          folderName,
        },
      );

      if (!success) {
        return;
      }

      return this.convertPowershellResponseToContentItem(data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return;
    }
  }

  public async createNewItem(
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<ContentItem | undefined> {
    try {
      const { success, data } = await this.execute(ScriptActions.CreateFile, {
        folderPath: parentItem.uri,
        fileName,
        content: new TextDecoder().decode(buffer) || "",
      });

      if (!success) {
        return;
      }

      return this.convertPowershellResponseToContentItem(data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return;
    }
  }

  public async deleteItem(item: ContentItem): Promise<boolean> {
    try {
      const { success } = await this.execute(ScriptActions.DeleteFile, {
        filePath: item.uri,
      });
      return success;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return false;
    }
  }

  public async getChildItems(parentItem: ContentItem): Promise<ContentItem[]> {
    // If the user is fetching child items of the root folder, give them the
    // "home" directory
    if (parentItem.id === SERVER_FOLDER_ID) {
      const { success, data: items } = await this.execute(
        ScriptActions.GetChildItems,
        {
          path: "/",
        },
      );
      if (!success) {
        return [];
      }
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

    const { success, data: items } = await this.execute(
      ScriptActions.GetChildItems,
      {
        path: getLink(parentItem.links, "GET", "getDirectoryMembers").uri,
      },
    );
    if (!success) {
      return [];
    }

    const childItems = items.map(this.convertPowershellResponseToContentItem);

    return sortedContentItems(childItems);
  }

  private async getTempFile() {
    const tempFile = v4();
    const globalStorageUri = getGlobalStorageUri();
    try {
      await workspace.fs.readDirectory(globalStorageUri);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      await workspace.fs.createDirectory(globalStorageUri);
    }

    const outputFile = Uri.joinPath(globalStorageUri, tempFile);
    return outputFile;
  }

  public async getContentOfItem(item: ContentItem): Promise<string> {
    const filePath = item.uri;
    const outputFile = await this.getTempFile();

    try {
      const { success } = await this.execute(ScriptActions.FetchFileContent, {
        filePath,
        outputFile: outputFile.fsPath,
      });
      if (!success) {
        return "";
      }
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
      const { success, data } = await this.execute(ScriptActions.RenameFile, {
        oldPath: item.uri,
        newPath: targetParentFolderUri,
        newName: item.name,
      });
      if (!success) {
        return undefined;
      }
      return this.convertPowershellResponseToContentItem(data).vscUri;
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
      const { success, data } = await this.execute(ScriptActions.RenameFile, {
        oldPath: item.uri,
        newPath: item.parentFolderUri,
        newName,
      });
      if (!success) {
        return undefined;
      }
      return this.convertPowershellResponseToContentItem(data);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return undefined;
    }
  }

  public async updateContentOfItem(uri: Uri, content: string): Promise<void> {
    try {
      const item = await this.getItemAtPath(getResourceId(uri));
      await this.execute(ScriptActions.UpdateFile, {
        filePath: item.uri,
        content,
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return;
    }
  }

  protected async getItemAtPathWithName(
    path: string,
    name: string,
  ): Promise<ContentItem> {
    const { data: items } = await this.execute(ScriptActions.GetChildItems, {
      path,
    });

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

  private async execute(incomingCode: string, params: Record<string, string>) {
    let code = incomingCode;

    Object.keys(params).forEach((key: string) => {
      // This is a little confusing. Basically, we can pass in any kind of string. Some of those
      // strings break powershell (ex. NewFile+!@$%^&*.txt). Thus, we create one level of indirection
      // where we wrap these unprocessed strings in the powershell "heredoc" syntax before passing things
      // along
      const codeToPrefix = `$processed_${key}=\n@'\n${params[key]}\n'@\n`;
      code = codeToPrefix + code.replace(`$${key}`, `$processed_${key}`);
    });

    try {
      const output = await executeRawCode(code);
      return output ? JSON.parse(output) : "";
    } catch (e) {
      onRunError(e);
      return "";
    }
  }
}

export default ITCSASServerAdapter;
