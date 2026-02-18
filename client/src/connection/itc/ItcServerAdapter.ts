// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { FileType, Uri, workspace } from "vscode";

import { v4 } from "uuid";

import { onRunError } from "../../commands/run";
import {
  Messages,
  SAS_SERVER_ROOT_FOLDER,
  SAS_SERVER_ROOT_FOLDERS,
  SERVER_FOLDER_ID,
} from "../../components/ContentNavigator/const";
import {
  ContentAdapter,
  ContentItem,
  RootFolderMap,
} from "../../components/ContentNavigator/types";
import {
  ContextMenuAction,
  ContextMenuProvider,
  convertStaticFolderToContentItem,
  createStaticFolder,
  homeDirectoryNameAndType,
  sortedContentItems,
} from "../../components/ContentNavigator/utils";
import { getGlobalStorageUri } from "../../components/ExtensionContext";
import { ProfileWithFileRootOptions } from "../../components/profile";
import { getLink, getResourceId, getSasServerUri } from "../rest/util";
import { executeRawCode } from "./CodeRunner";
import { PowershellResponse, ScriptActions } from "./types";
import { getDirectorySeparator } from "./util";

class ItcServerAdapter implements ContentAdapter {
  protected sessionId: string;
  private rootFolders: RootFolderMap;
  private contextMenuProvider: ContextMenuProvider;

  public constructor(
    protected readonly fileNavigationCustomRootPath: ProfileWithFileRootOptions["fileNavigationCustomRootPath"],
    protected readonly fileNavigationRoot: ProfileWithFileRootOptions["fileNavigationRoot"],
  ) {
    this.rootFolders = {};
    this.contextMenuProvider = new ContextMenuProvider(
      [
        ContextMenuAction.CreateChild,
        ContextMenuAction.Delete,
        ContextMenuAction.Update,
        ContextMenuAction.CopyPath,
        ContextMenuAction.AllowDownload,
      ],
      {
        [ContextMenuAction.CopyPath]: (item) => item.id !== SERVER_FOLDER_ID,
      },
    );
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
  public async getParentOfItem(
    item: ContentItem,
  ): Promise<ContentItem | undefined> {
    const parent = await this.getItemAtPath(item.parentFolderUri);
    if (!parent) {
      return undefined;
    }

    return parent;
  }

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
        content: buffer ? Buffer.from(buffer).toString("base64") : "",
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

  private fileNavigationRootSettings() {
    return {
      fileNavigationCustomRootPath: this.fileNavigationCustomRootPath,
      fileNavigationRoot: this.fileNavigationRoot || "USER",
    };
  }

  public async getChildItems(parentItem: ContentItem): Promise<ContentItem[]> {
    // If the user is fetching child items of the root folder, give them the
    // "home" directory
    if (parentItem.id === SERVER_FOLDER_ID) {
      const { success, data: items } = await this.execute(
        ScriptActions.GetChildItems,
        {
          path: "/",
          ...this.fileNavigationRootSettings(),
        },
      );
      if (!success) {
        if (this.fileNavigationRoot === "CUSTOM") {
          throw new Error(Messages.FileNavigationRootUserError);
        }
        return [];
      }
      const uri = items[0].parentFolderUri;
      const homeFolder = convertStaticFolderToContentItem(
        createStaticFolder(
          uri,
          ...homeDirectoryNameAndType(
            this.fileNavigationRoot,
            this.fileNavigationCustomRootPath,
          ),
          "/",
          "getDirectoryMembers",
        ),
        {
          write: false,
          delete: false,
          addMember: true,
        },
      );
      homeFolder.contextValue =
        this.contextMenuProvider.availableActions(homeFolder);
      return [homeFolder];
    }

    const { success, data: items } = await this.execute(
      ScriptActions.GetChildItems,
      {
        path: getLink(parentItem.links, "GET", "getDirectoryMembers").uri,
        ...this.fileNavigationRootSettings(),
      },
    );
    if (!success) {
      return [];
    }

    const childItems = items.map(
      this.convertPowershellResponseToContentItem.bind(this),
    );

    return sortedContentItems(childItems);
  }

  public async getPathOfItem(item: ContentItem): Promise<string> {
    return item.uri;
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
    await workspace.fs.delete(outputFile);
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return file as unknown as string;
  }

  public async getContentOfUri(uri: Uri): Promise<string> {
    const item = await this.getItemAtPath(getResourceId(uri));
    return ((await this.getContentOfItem(item)) || "").toString();
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

  public calculateNewFileUri(
    closedFileUri: Uri,
    movedItem: ContentItem,
    newItemUri: Uri,
  ): Uri | null {
    const isFolder = movedItem.fileStat?.type === FileType.Directory;

    // If the moved item is a file and matches the closed file, return the new URI
    if (
      !isFolder &&
      closedFileUri.toString() === movedItem.vscUri?.toString()
    ) {
      return newItemUri;
    }

    // If the moved item is a folder, calculate the new path for files within it
    if (isFolder && movedItem.vscUri) {
      const extractPathFromUri = (uri: string): string => {
        try {
          const queryStart = uri.indexOf("?");
          if (queryStart === -1) {
            return uri;
          }
          return uri.substring(0, queryStart);
        } catch (error) {
          console.error("Failed to extract path from URI:", error);
          return "";
        }
      };

      const oldBasePath = extractPathFromUri(movedItem.vscUri.toString());
      const closedFilePath = extractPathFromUri(closedFileUri.toString());

      // Check if the closed file was inside the moved folder
      const dirSeparator = getDirectorySeparator(oldBasePath);
      const isChildFile =
        oldBasePath &&
        closedFilePath &&
        (closedFilePath.startsWith(oldBasePath + dirSeparator) ||
          closedFilePath === oldBasePath);

      if (isChildFile && oldBasePath !== closedFilePath) {
        try {
          const relativePath = closedFilePath.substring(oldBasePath.length);
          const newUriStr = newItemUri.toString();

          // Extract the path without query parameters
          const queryStart = newUriStr.indexOf("?");
          const newPath =
            queryStart === -1 ? newUriStr : newUriStr.substring(0, queryStart);

          // Combine new path with relative path
          const newFilePath = newPath.endsWith(dirSeparator)
            ? newPath + relativePath.substring(1)
            : newPath + relativePath;

          // Reconstruct URI with query parameters if present
          if (queryStart !== -1) {
            const queryString = newUriStr.substring(queryStart);
            return Uri.parse(newFilePath + queryString);
          }

          return Uri.parse(newFilePath);
        } catch (error) {
          console.error("Failed to construct new file URI:", error);
          return null;
        }
      }
    }

    return null;
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
      ...this.fileNavigationRootSettings(),
    });

    const foundItem = items.find((item) => item.name === name);
    return this.convertPowershellResponseToContentItem(foundItem);
  }

  protected async getItemAtPath(path: string): Promise<ContentItem> {
    const separator = getDirectorySeparator(path);
    const pathPieces = path.split(separator);
    const name = pathPieces.pop();

    return await this.getItemAtPathWithName(pathPieces.join(separator), name);
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
      contextValue: this.contextMenuProvider.availableActions(item),
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
      const decodedOutput = output ? JSON.parse(output) : "";

      // If we do have an error message with more information, lets dump it to console
      if (decodedOutput && !decodedOutput.success && decodedOutput.message) {
        console.dir(decodedOutput.message);
      }

      return decodedOutput;
    } catch (e) {
      onRunError(e);
      return "";
    }
  }
}

export default ItcServerAdapter;
