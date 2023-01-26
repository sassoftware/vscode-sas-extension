import { ContentItem } from "./types";
import { ContentModel } from "./viya/ContentModel";
import { DataDescriptor } from "./viya/DataDescriptor";
import {
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  FileStat,
  FileSystemProvider,
  FileType,
  ProviderResult,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
} from "vscode";

class ContentDataProvider
  implements TreeDataProvider<ContentItem>, FileSystemProvider
{
  private _onDidChangeFile: EventEmitter<FileChangeEvent[]>;
  private _onDidChangeTreeData: EventEmitter<ContentItem | undefined>;
  private dataDescriptor: DataDescriptor;
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();
  private model: ContentModel;

  constructor(public readonly model: ContentModel) {
    this._onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
    this._onDidChangeTreeData = new EventEmitter<ContentItem | undefined>();
    this.model = model;
    this.dataDescriptor = this.model.getDataDescriptor();
  }

  get onDidChangeFile(): Event<FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  get onDidChangeTreeData(): Event<ContentItem> {
    return this._onDidChangeTreeData.event;
  }

  public async setup(): Promise<void> {
    this.model.setup();
    this.refresh();
  }

  public getTreeItem(item: ContentItem): TreeItem | Promise<TreeItem> {
    const isContainer = this.dataDescriptor.isContainer(item);

    return {
      iconPath: isContainer ? ThemeIcon.Folder : ThemeIcon.File,
      contextValue: this.dataDescriptor.resourceType(item),
      id: this.dataDescriptor.getId(item),
      label: this.dataDescriptor.getLabel(item),
      collapsibleState: isContainer
        ? TreeItemCollapsibleState.Collapsed
        : undefined,
      command: isContainer
        ? undefined
        : {
            command: "SAS.openSASfile",
            arguments: [this.dataDescriptor.getUri(item)],
            title: "Open SAS File",
          },
    };
  }

  public getChildren(item?: ContentItem): ProviderResult<ContentItem[]> {
    return this.model.getChildren(item);
  }

  // TODO #56 What's this for?
  public watch(
    uri: Uri
    // _options: { recursive: boolean; excludes: string[] }
  ): Disposable {
    // ignore, fires for all changes...
    console.log("watch", uri);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => {});
  }

  public stat(uri: Uri): FileStat | Promise<FileStat> {
    return this.model.getResourceByUri(uri).then(
      (resource): FileStat => ({
        type: this.dataDescriptor.isContainer(resource)
          ? FileType.Directory
          : FileType.File,
        ctime: this.dataDescriptor.getCreationDate(resource),
        mtime: this.dataDescriptor.getModifyDate(resource),
        size: 0,
      })
    );
  }

  public readFile(uri: Uri): Uint8Array | Promise<Uint8Array> {
    return this.model
      .getContentByUri(uri)
      .then((content) => this.textEncoder.encode(content));
  }

  public async createFolder(
    item: ContentItem,
    folderName: string
  ): Promise<boolean> {
    const success = await this.model.createFolder(item, folderName);
    if (success) {
      this.refresh();
    }

    return success;
  }

  public async createFile(
    item: ContentItem,
    fileName: string
  ): Promise<boolean> {
    const success = await this.model.createFile(item, fileName);
    if (success) {
      this.refresh();
    }

    return success;
  }

  public async renameResource(
    item: ContentItem,
    name: string
  ): Promise<boolean> {
    const success = await this.model.renameResource(item, name);
    if (success) {
      this.refresh();
    }

    return success;
  }

  // TODO #56 Lets make sure we don't overwrite newer files (should be handled by method)
  public writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void | Promise<void> {
    console.log("writeFile", uri, options);
    // if (options.overwrite) {
    return this.model.saveContentToUri(uri, this.textDecoder.decode(content));
    // }
  }

  public async deleteResource(item: ContentItem): Promise<boolean> {
    const success = await this.model.delete(item);
    if (success) {
      this.refresh();
    }

    return success;
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
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
