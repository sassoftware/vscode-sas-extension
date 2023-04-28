// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { readFile } from "fs";
import { basename } from "path";
import { promisify } from "util";
import {
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
  TextDocumentContentProvider,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
} from "vscode";
import { ContentModel } from "./ContentModel";
import { ContentItem } from "./types";
import {
  getCreationDate,
  getId,
  isContainer as getIsContainer,
  getLabel,
  getLink,
  getModifyDate,
  getTypeName,
  getUri,
  isItemInRecycleBin,
  resourceType,
} from "./utils";
import {
  FAVORITES_FOLDER_TYPE,
  ROOT_FOLDER_TYPE,
  TRASH_FOLDER_TYPE,
} from "./const";

class ContentDataProvider
  implements
    TreeDataProvider<ContentItem>,
    FileSystemProvider,
    TextDocumentContentProvider
{
  private _onDidChangeFile: EventEmitter<FileChangeEvent[]>;
  private _onDidChangeTreeData: EventEmitter<ContentItem | undefined>;
  private _onDidChange: EventEmitter<Uri>;
  private readonly model: ContentModel;
  private extensionUri: Uri;

  constructor(model: ContentModel, extensionUri: Uri) {
    this._onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
    this._onDidChangeTreeData = new EventEmitter<ContentItem | undefined>();
    this._onDidChange = new EventEmitter<Uri>();
    this.model = model;
    this.extensionUri = extensionUri;
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

  private iconPathForItem(
    item: ContentItem
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
            `icons/light/${icon}Light.svg`
          ),
        }
      : ThemeIcon.File;
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
      })
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
    folderName: string
  ): Promise<Uri | undefined> {
    const newItem = await this.model.createFolder(item, folderName);
    if (newItem) {
      this.refresh();
      return getUri(newItem);
    }
  }

  public async addFileToMyContent(file: Uri): Promise<Uri | undefined> {
    let fileData: Buffer;
    try {
      fileData = await promisify(readFile)(file.fsPath);
    } catch (e) {
      return undefined;
    }

    // There's a change we haven't connected to SAS content. Lets
    // do that here.
    if (!this.model.getDelegateFolder("@myFolder")) {
      await this.model.getChildren();
    }

    const myFolder = this.model.getDelegateFolder("@myFolder");
    if (!myFolder) {
      return undefined;
    }

    return await this.createFile(myFolder, basename(file.path), fileData);
  }

  public async createFile(
    item: ContentItem,
    fileName: string,
    buffer?: Buffer
  ): Promise<Uri | undefined> {
    const newItem = await this.model.createFile(item, fileName, buffer);
    if (newItem) {
      this.refresh();
      return getUri(newItem);
    }
  }

  public async renameResource(
    item: ContentItem,
    name: string
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
      children.map((child) => this.deleteResource(child))
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

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  public async getParent(
    element: ContentItem
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
}

export default ContentDataProvider;

const closeFileIfOpen = (item: ContentItem): boolean | Thenable<boolean> => {
  const fileUri = getUri(item, isItemInRecycleBin(item));
  const tabs: Tab[] = window.tabGroups.all.map((tg) => tg.tabs).flat();
  const tab = tabs.find(
    (tab) =>
      tab.input instanceof TabInputText && tab.input.uri.query === fileUri.query // compare the file id
  );
  if (tab) {
    return window.tabGroups.close(tab);
  }
  return true;
};
