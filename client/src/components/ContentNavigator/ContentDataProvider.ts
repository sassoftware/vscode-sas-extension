// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  FileStat,
  FileSystemProvider,
  FileType,
  ProviderResult,
  TextDocumentContentProvider,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  window,
  Tab,
  TabInputText,
} from "vscode";
import { ContentModel } from "./ContentModel";
import { ContentItem } from "./types";
import {
  getCreationDate,
  getId,
  getLabel,
  getModifyDate,
  getUri,
  isContainer as getIsContainer,
  resourceType,
  getLink,
} from "./utils";

class ContentDataProvider
  implements
    TreeDataProvider<ContentItem>,
    FileSystemProvider,
    TextDocumentContentProvider
{
  private _onDidChangeFile: EventEmitter<FileChangeEvent[]>;
  private _onDidChangeTreeData: EventEmitter<ContentItem | undefined>;
  private readonly model: ContentModel;

  constructor(model: ContentModel) {
    this._onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
    this._onDidChangeTreeData = new EventEmitter<ContentItem | undefined>();
    this.model = model;
  }

  get onDidChangeFile(): Event<FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  get onDidChangeTreeData(): Event<ContentItem> {
    return this._onDidChangeTreeData.event;
  }

  public async connect(baseUrl: string): Promise<void> {
    await this.model.connect(baseUrl);
    this.refresh();
  }

  public getTreeItem(item: ContentItem): TreeItem | Promise<TreeItem> {
    const isContainer = getIsContainer(item);

    return {
      iconPath: isContainer ? ThemeIcon.Folder : ThemeIcon.File,
      contextValue: resourceType(item),
      id: getId(item),
      label: getLabel(item),
      collapsibleState: isContainer
        ? TreeItemCollapsibleState.Collapsed
        : undefined,
      command: isContainer
        ? undefined
        : {
            command: "SAS.openSASfile",
            arguments: [item],
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

  public async createFile(
    item: ContentItem,
    fileName: string
  ): Promise<Uri | undefined> {
    const newItem = await this.model.createFile(item, fileName);
    if (newItem) {
      this.refresh();
      return getUri(newItem);
    }
  }

  public async renameResource(
    item: ContentItem,
    name: string
  ): Promise<Uri | undefined> {
    const newItem = await this.model.renameResource(item, name);
    if (newItem) {
      return getUri(newItem);
    }
  }

  public writeFile(uri: Uri, content: Uint8Array): void | Promise<void> {
    return this.model.saveContentToUri(uri, new TextDecoder().decode(content));
  }

  public async deleteResource(item: ContentItem): Promise<boolean> {
    if (!(await closeFileIfOpen(getUri(item, item.__trash__)))) {
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
    if (!(await closeFileIfOpen(getUri(item, item.__trash__)))) {
      return false;
    }
    const success = await this.model.moveTo(item, recycleBinUri);
    if (success) {
      this.refresh();
    }
    return success;
  }

  public async restoreResource(item: ContentItem): Promise<boolean> {
    const previousParentUri = getLink(item.links, "GET", "previousParent")?.uri;
    if (!previousParentUri) {
      return false;
    }
    if (!(await closeFileIfOpen(getUri(item, item.__trash__)))) {
      return false;
    }
    const success = await this.model.moveTo(item, previousParentUri);
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

const closeFileIfOpen = async (file: Uri): Promise<boolean> => {
  const tabs: Tab[] = window.tabGroups.all.map((tg) => tg.tabs).flat();
  const tab = tabs.find(
    (tab) =>
      tab.input instanceof TabInputText && tab.input.uri.query === file.query // compare the file id
  );
  if (tab) {
    return window.tabGroups.close(tab);
  }
  return true;
};
