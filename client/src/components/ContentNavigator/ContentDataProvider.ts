import { ContentItem } from "./types";
import {
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  FileStat,
  FileSystemProvider,
  FileType,
  ProviderResult,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
} from "vscode";
import { DataDescriptor } from "./viya/DataDescriptor";
import { ContentModel } from "./viya/ContentModel";

class ContentDataProvider
  implements TreeDataProvider<ContentItem>, FileSystemProvider
{
  private _onDidChangeFile: EventEmitter<FileChangeEvent[]>;
  private _onDidChangeTreeData: EventEmitter<ContentItem>;
  private dataDescriptor: DataDescriptor;
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();
  constructor(public readonly model: ContentModel) {
    this._onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
    this._onDidChangeTreeData = new EventEmitter<ContentItem>();
    this.dataDescriptor = this.model.getDataDescriptor();
  }

  get onDidChangeFile(): Event<FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  get onDidChangeTreeData(): Event<ContentItem> {
    return this._onDidChangeTreeData.event;
  }

  public getTreeItem(item: ContentItem): TreeItem | Thenable<TreeItem> {
    const isContainer = this.dataDescriptor.isContainer(item);

    console.log("resourceType", this.dataDescriptor.resourceType(item), {
      item,
    });

    return {
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
            arguments: [
              Uri.parse(
                `sas:/${this.dataDescriptor.getLabel(
                  item
                )}?id=${this.dataDescriptor.getResourceId(item)}`
              ),
            ],
            title: "Open SAS File",
          },
    };
  }

  public getChildren(item?: ContentItem): ProviderResult<ContentItem[]> {
    console.log("dataprovider", "getChildren", item);
    return this.model.getChildren(item);
  }

  public getParent?(item: ContentItem): ProviderResult<ContentItem> {
    console.log("dataprovider", "getParent", item);
    throw new Error("Method not implemented.");
  }

  public watch(
    uri: Uri
    // _options: { recursive: boolean; excludes: string[] }
  ): Disposable {
    // ignore, fires for all changes...
    console.log("watch", uri);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => {});
  }

  public stat(uri: Uri): FileStat | Thenable<FileStat> {
    console.log("stat", uri);
    return this.model.getResourceByUri(uri).then((resource) => {
      console.log("stat - resource", resource);
      return {
        type: this.dataDescriptor.isContainer(resource)
          ? FileType.Directory
          : FileType.File,
        ctime: this.dataDescriptor.getCreationDate(resource),
        mtime: this.dataDescriptor.getModifyDate(resource),
        size: 0,
      };
    });
  }

  public readDirectory(
    uri: Uri
  ): [string, FileType][] | Thenable<[string, FileType][]> {
    console.log("readDirectory", uri);
    throw new Error("Method not implemented.");
  }

  public readFile(uri: Uri): Uint8Array | Thenable<Uint8Array> {
    console.log("readFile", uri);
    return this.model
      .getContentByUri(uri)
      .then((content) => this.textEncoder.encode(content));
  }

  public createDirectory(uri: Uri): void | Thenable<void> {
    console.log("createDirectory", uri);
    throw new Error("Method not implemented.");
  }

  public writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void | Thenable<void> {
    console.log("writeFile", uri, options);
    // if (options.overwrite) {
    return this.model.saveContentToUri(uri, this.textDecoder.decode(content));
    // }
  }

  public delete(
    uri: Uri
    // options: { recursive: boolean }
  ): void | Thenable<void> {
    console.log("writeFile", uri);
    throw new Error("Method not implemented.");
  }

  public rename(
    oldUri: Uri
    // newUri: Uri,
    // options: { overwrite: boolean }
  ): void | Thenable<void> {
    console.log("writeFile", oldUri);
    throw new Error("Method not implemented.");
  }

  public copy?(
    source: Uri
    // destination: Uri,
    // options: { overwrite: boolean }
  ): void | Thenable<void> {
    console.log("writeFile", source);
    throw new Error("Method not implemented.");
  }
}

export default ContentDataProvider;
