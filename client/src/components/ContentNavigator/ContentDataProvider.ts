// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { lstat, readFile, readdir } from "fs";
import { basename, join } from "path";
import { promisify } from "util";
import {
  DataTransfer,
  DataTransferItem,
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  FileStat,
  FileSystemProvider,
  FileType,
  ProviderResult,
  Tab,
  TabInputText,
  TabInputNotebook,
  TextDocumentContentProvider,
  ThemeIcon,
  TreeDataProvider,
  TreeDragAndDropController,
  TreeItem,
  TreeItemCollapsibleState,
  TreeView,
  Uri,
  l10n,
  window,
} from "vscode";
import { profileConfig } from "../../commands/profile";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { ViyaProfile } from "../profile";
import { ContentModel } from "./ContentModel";
import {
  FAVORITES_FOLDER_TYPE,
  Messages,
  ROOT_FOLDER_TYPE,
  TRASH_FOLDER_TYPE,
} from "./const";
import { ContentItem } from "./types";
import {
  getCreationDate,
  getId,
  isContainer as getIsContainer,
  getLabel,
  getLink,
  getModifyDate,
  getResourceIdFromItem,
  getTypeName,
  getUri,
  isItemInRecycleBin,
  isReference,
  resourceType,
} from "./utils";
import { convertSASNotebookToFlow } from "./convert";

const contentItemMimeType = "application/vnd.code.tree.contentdataprovider";
class ContentDataProvider
  implements
    TreeDataProvider<ContentItem>,
    FileSystemProvider,
    TextDocumentContentProvider,
    SubscriptionProvider,
    TreeDragAndDropController<ContentItem>
{
  private _onDidChangeFile: EventEmitter<FileChangeEvent[]>;
  private _onDidChangeTreeData: EventEmitter<ContentItem | undefined>;
  private _onDidChange: EventEmitter<Uri>;
  private _treeView: TreeView<ContentItem>;
  private readonly model: ContentModel;
  private extensionUri: Uri;

  public dropMimeTypes: string[] = [contentItemMimeType, "text/uri-list"];
  public dragMimeTypes: string[] = [contentItemMimeType];

  get treeView(): TreeView<ContentItem> {
    return this._treeView;
  }

  constructor(model: ContentModel, extensionUri: Uri) {
    this._onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
    this._onDidChangeTreeData = new EventEmitter<ContentItem | undefined>();
    this._onDidChange = new EventEmitter<Uri>();
    this.model = model;
    this.extensionUri = extensionUri;

    this._treeView = window.createTreeView("contentdataprovider", {
      treeDataProvider: this,
      dragAndDropController: this,
      canSelectMany: true,
    });

    this._treeView.onDidChangeVisibility(async () => {
      if (this._treeView.visible) {
        const activeProfile: ViyaProfile = profileConfig.getProfileByName(
          profileConfig.getActiveProfile(),
        );
        await this.connect(activeProfile.endpoint);
      }
    });
  }

  public async handleDrop(
    target: ContentItem,
    sources: DataTransfer,
  ): Promise<void> {
    for (const mimeType of this.dropMimeTypes) {
      const item = sources.get(mimeType);
      if (!item || !item.value) {
        continue;
      }

      switch (mimeType) {
        case contentItemMimeType:
          await Promise.all(
            item.value.map(
              async (contentItem: ContentItem) =>
                await this.handleContentItemDrop(target, contentItem),
            ),
          );
          break;
        case "text/uri-list":
          await this.handleDataTransferItemDrop(target, item);
          break;
        default:
          break;
      }
    }
  }

  public handleDrag(
    source: ContentItem[],
    dataTransfer: DataTransfer,
  ): void | Thenable<void> {
    const dataTransferItem = new DataTransferItem(source);
    dataTransfer.set(this.dragMimeTypes[0], dataTransferItem);
  }

  public getSubscriptions(): Disposable[] {
    return [this._treeView];
  }

  get onDidChangeFile(): Event<FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  get onDidChangeTreeData(): Event<ContentItem> {
    return this._onDidChangeTreeData.event;
  }

  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  public async connect(baseUrl: string): Promise<void> {
    await this.model.connect(baseUrl);
    this.refresh();
  }

  public async getTreeItem(item: ContentItem): Promise<TreeItem> {
    const isContainer = getIsContainer(item);

    const uri = await this.getUri(item, false);

    return {
      iconPath: this.iconPathForItem(item),
      contextValue: resourceType(item),
      id: getId(item),
      label: getLabel(item),
      collapsibleState: isContainer
        ? TreeItemCollapsibleState.Collapsed
        : undefined,
      command: isContainer
        ? undefined
        : {
            command: "vscode.open",
            arguments: [uri],
            title: "Open SAS File",
          },
    };
  }

  public async provideTextDocumentContent(uri: Uri): Promise<string> {
    // use text document content provider to display the readonly editor for the files in the recycle bin
    return await this.model.getContentByUri(uri);
  }

  public getChildren(item?: ContentItem): ProviderResult<ContentItem[]> {
    return this.model.getChildren(item);
  }

  public watch(): Disposable {
    // ignore, fires for all changes...
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => {});
  }

  public async stat(uri: Uri): Promise<FileStat> {
    return await this.model.getResourceByUri(uri).then(
      (resource): FileStat => ({
        type: getIsContainer(resource) ? FileType.Directory : FileType.File,
        ctime: getCreationDate(resource),
        mtime: getModifyDate(resource),
        size: 0,
      }),
    );
  }

  public async readFile(uri: Uri): Promise<Uint8Array> {
    return await this.model
      .getContentByUri(uri)
      .then((content) => new TextEncoder().encode(content));
  }

  public getUri(item: ContentItem, readOnly: boolean): Promise<Uri> {
    return this.model.getUri(item, readOnly);
  }

  public async createFolder(
    item: ContentItem,
    folderName: string,
  ): Promise<Uri | undefined> {
    const newItem = await this.model.createFolder(item, folderName);
    if (newItem) {
      this.refresh();
      return getUri(newItem);
    }
  }

  public async createFile(
    item: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<Uri | undefined> {
    const newItem = await this.model.createFile(item, fileName, buffer);
    if (newItem) {
      this.refresh();
      return getUri(newItem);
    }
  }

  public async renameResource(
    item: ContentItem,
    name: string,
  ): Promise<Uri | undefined> {
    if (!(await closeFileIfOpen(item))) {
      return;
    }
    const newItem = await this.model.renameResource(item, name);
    if (newItem) {
      return getUri(newItem);
    }
  }

  public writeFile(uri: Uri, content: Uint8Array): void | Promise<void> {
    return this.model.saveContentToUri(uri, new TextDecoder().decode(content));
  }

  public associateFlow(
    name: string,
    uri: Uri,
    parent: ContentItem,
  ): Promise<string> {
    return this.model.associateFlowFile(name, uri, parent);
  }

  public async deleteResource(item: ContentItem): Promise<boolean> {
    if (!(await closeFileIfOpen(item))) {
      return false;
    }
    const success = await this.model.delete(item);
    if (success) {
      this.refresh();
    }
    return success;
  }

  public async recycleResource(item: ContentItem): Promise<boolean> {
    const recycleBin = this.model.getDelegateFolder("@myRecycleBin");
    if (!recycleBin) {
      // fallback to delete
      return this.deleteResource(item);
    }
    const recycleBinUri = getLink(recycleBin.links, "GET", "self")?.uri;
    if (!recycleBinUri) {
      return false;
    }
    if (!(await closeFileIfOpen(item))) {
      return false;
    }
    const success = await this.model.moveTo(item, recycleBinUri);
    if (success) {
      this.refresh();
      // update the text document content as well just in case that this file was just restored and updated
      this._onDidChange.fire(getUri(item, true));
    }
    return success;
  }

  public async restoreResource(item: ContentItem): Promise<boolean> {
    const previousParentUri = getLink(item.links, "GET", "previousParent")?.uri;
    if (!previousParentUri) {
      return false;
    }
    if (!(await closeFileIfOpen(item))) {
      return false;
    }
    const success = await this.model.moveTo(item, previousParentUri);
    if (success) {
      this.refresh();
    }
    return success;
  }

  public async emptyRecycleBin(): Promise<boolean> {
    const recycleBin = this.model.getDelegateFolder("@myRecycleBin");
    const children = await this.getChildren(recycleBin);
    const result = await Promise.all(
      children.map((child) => this.deleteResource(child)),
    );
    const success = result.length === children.length;
    if (success) {
      this.refresh();
    }
    return success;
  }

  public async addToMyFavorites(item: ContentItem): Promise<boolean> {
    const success = await this.model.addFavorite(item);
    if (success) {
      this.refresh();
    }
    return success;
  }

  public async removeFromMyFavorites(item: ContentItem): Promise<boolean> {
    const success = await this.model.removeFavorite(item);
    if (success) {
      this.refresh();
    }
    return success;
  }

  public async handleCreationResponse(
    resource: ContentItem,
    newUri: Uri | undefined,
    errorMessage: string,
  ): Promise<void> {
    if (!newUri) {
      window.showErrorMessage(errorMessage);
      return;
    }

    this.reveal(resource);
  }

  public async convertNotebookToFlow(
    item: ContentItem,
    name: string,
  ): Promise<string | undefined> {
    const parent = await this.getParent(item);
    const resourceUri = getUri(item);
    try {
      // get the content of the .sasnb file
      const contentString: string = await this.provideTextDocumentContent(
        resourceUri,
      );
      // convert the .sasnb file to a .flw file
      const flowDataUint8Array = convertSASNotebookToFlow(contentString, name);
      if (flowDataUint8Array.length === 0) {
        window.showErrorMessage(Messages.NoCodeToConvert);
        return;
      }
      const newUri = await this.createFile(parent, name, flowDataUint8Array);
      this.handleCreationResponse(
        parent,
        newUri,
        l10n.t(Messages.NewFileCreationError, { name: name }),
      );
      // associate the new .flw file with SAS Studio
      return await this.associateFlow(name, newUri, parent);
    } catch (error) {
      window.showErrorMessage(error);
    }
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public async getParent(
    element: ContentItem,
  ): Promise<ContentItem | undefined> {
    return await this.model.getParent(element);
  }

  public async delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public rename(): void | Promise<void> {
    throw new Error("Method not implemented.");
  }

  public readDirectory():
    | [string, FileType][]
    | Thenable<[string, FileType][]> {
    throw new Error("Method not implemented.");
  }

  public createDirectory(): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }

  public reveal(item: ContentItem): void {
    this._treeView.reveal(item, {
      expand: true,
      select: false,
      focus: false,
    });
  }

  private async handleContentItemDrop(
    target: ContentItem,
    item: ContentItem,
  ): Promise<void> {
    let success = false;
    let message = Messages.FileDropError;
    if (item.flags.isInRecycleBin) {
      message = Messages.FileDragFromTrashError;
    } else if (isReference(item)) {
      message = Messages.FileDragFromFavorites;
    } else if (target.type === TRASH_FOLDER_TYPE) {
      success = await this.recycleResource(item);
    } else if (target.type === FAVORITES_FOLDER_TYPE) {
      success = await this.addToMyFavorites(item);
    } else {
      const targetUri = getResourceIdFromItem(target);
      if (targetUri) {
        success = await this.model.moveTo(item, targetUri);
      }

      if (success) {
        this.refresh();
      }
    }

    if (!success) {
      await window.showErrorMessage(
        l10n.t(message, {
          name: item.name,
        }),
      );
    }
  }

  private async handleFolderDrop(
    target: ContentItem,
    path: string,
  ): Promise<boolean> {
    const folder = await this.model.createFolder(target, basename(path));
    let success = true;
    if (!folder) {
      await window.showErrorMessage(
        l10n.t(Messages.FileDropError, {
          name: basename(path),
        }),
      );

      return false;
    }

    // Read all the files in the folder and upload them
    const filesOrFolders = await promisify(readdir)(path);
    await Promise.all(
      filesOrFolders.map(async (fileOrFolderName: string) => {
        const fileOrFolder = join(path, fileOrFolderName);
        const isDirectory = (
          await promisify(lstat)(fileOrFolder)
        ).isDirectory();
        if (isDirectory) {
          success = await this.handleFolderDrop(folder, fileOrFolder);
        } else {
          const name = basename(fileOrFolder);
          const fileCreated = await this.createFile(
            folder,
            name,
            await promisify(readFile)(fileOrFolder),
          );
          if (!fileCreated) {
            success = false;
            await window.showErrorMessage(
              l10n.t(Messages.FileDropError, {
                name,
              }),
            );
          }
        }
      }),
    );

    return success;
  }

  private async handleDataTransferItemDrop(
    target: ContentItem,
    item: DataTransferItem,
  ): Promise<void> {
    // If a user drops multiple files, there will be multiple
    // uris separated by newlines
    await Promise.all(
      item.value.split("\n").map(async (uri: string) => {
        const itemUri = Uri.parse(uri.trim());
        const name = basename(itemUri.path);
        const isDirectory = (
          await promisify(lstat)(itemUri.fsPath)
        ).isDirectory();

        if (isDirectory) {
          const success = await this.handleFolderDrop(target, itemUri.fsPath);
          if (success) {
            this.refresh();
          }

          return;
        }

        const fileCreated = await this.createFile(
          target,
          name,
          await promisify(readFile)(itemUri.fsPath),
        );

        if (!fileCreated) {
          await window.showErrorMessage(
            l10n.t(Messages.FileDropError, {
              name,
            }),
          );
        }
      }),
    );
  }

  private iconPathForItem(
    item: ContentItem,
  ): ThemeIcon | { light: Uri; dark: Uri } {
    const isContainer = getIsContainer(item);
    let icon = "";
    if (isContainer) {
      const type = getTypeName(item);
      switch (type) {
        case ROOT_FOLDER_TYPE:
          icon = "sasFolders";
          break;
        case TRASH_FOLDER_TYPE:
          icon = "delete";
          break;
        case FAVORITES_FOLDER_TYPE:
          icon = "favoritesFolder";
          break;
        default:
          icon = "folder";
          break;
      }
    } else {
      const extension = item.name.split(".").pop().toLowerCase();
      if (extension === "sas") {
        icon = "sasProgramFile";
      }
    }
    return icon !== ""
      ? {
          dark: Uri.joinPath(this.extensionUri, `icons/dark/${icon}Dark.svg`),
          light: Uri.joinPath(
            this.extensionUri,
            `icons/light/${icon}Light.svg`,
          ),
        }
      : ThemeIcon.File;
  }
}

export default ContentDataProvider;

const closeFileIfOpen = (item: ContentItem): boolean | Thenable<boolean> => {
  const fileUri = getUri(item, isItemInRecycleBin(item));
  const tabs: Tab[] = window.tabGroups.all.map((tg) => tg.tabs).flat();
  const tab = tabs.find(
    (tab) =>
      (tab.input instanceof TabInputText ||
        tab.input instanceof TabInputNotebook) &&
      tab.input.uri.query === fileUri.query, // compare the file id
  );
  if (tab) {
    return window.tabGroups.close(tab);
  }
  return true;
};
