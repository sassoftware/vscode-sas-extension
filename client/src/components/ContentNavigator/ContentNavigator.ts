import * as vscode from "vscode";
import { ContentItem } from "./types";
import { ContentModel, DataDescriptor } from "./viya";
import { profileConfig } from "../../commands/profile";

export class ContentNavigator {
  constructor(context: vscode.ExtensionContext) {
    const dataDescriptor = new DataDescriptor();
    const model = new ContentModel(
      profileConfig.getActiveProfileDetail()?.profile.endpoint,
      dataDescriptor
    );
    const dataProvider = new ContentDataProvider(model);
    model.serviceInit().then(() => {
      context.subscriptions.push(
        vscode.window.createTreeView("SAS.ContentNavigator", {
          treeDataProvider: dataProvider,
        })
      );
    });

    vscode.workspace.registerFileSystemProvider("sas", dataProvider);
    vscode.commands.registerCommand("SAS.openSASfile", (resource) =>
      this.openResource(resource)
    );
  }

  private openResource(resource: vscode.Uri): void {
    vscode.window.showTextDocument(resource);
  }
}

export class ContentDataProvider
  implements vscode.TreeDataProvider<ContentItem>, vscode.FileSystemProvider
{
  private _onDidChangeFile: vscode.EventEmitter<vscode.FileChangeEvent[]>;
  private _onDidChangeTreeData: vscode.EventEmitter<ContentItem>;
  private dataDescriptor: DataDescriptor;
  private textEncoder = new TextEncoder();
  private textDecoder = new TextDecoder();
  constructor(public readonly model: ContentModel) {
    this._onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    this._onDidChangeTreeData = new vscode.EventEmitter<ContentItem>();
    this.dataDescriptor = this.model.getDataDescriptor();
  }

  get onDidChangeFile(): vscode.Event<vscode.FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  get onDidChangeTreeData(): vscode.Event<ContentItem> {
    return this._onDidChangeTreeData.event;
  }
  getTreeItem(item: ContentItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
    console.log("dataprovider", "getTreeItem", item);
    return {
      id: this.dataDescriptor.getId(item),
      label: this.dataDescriptor.getLabel(item),
      collapsibleState: this.dataDescriptor.isContainer(item)
        ? vscode.TreeItemCollapsibleState.Collapsed
        : void 0,
      command: this.dataDescriptor.isContainer(item)
        ? void 0
        : {
            command: "SAS.openSASfile",
            arguments: [
              vscode.Uri.parse(
                `sas:/${this.dataDescriptor.getLabel(
                  item
                )}?id=${this.dataDescriptor.getResourceId(item)}`
              ),
            ],
            title: "Open SAS File",
          },
    };
  }
  getChildren(item?: ContentItem): vscode.ProviderResult<ContentItem[]> {
    console.log("dataprovider", "getChildren", item);
    return this.model.getChildren(item);
  }
  getParent?(item: ContentItem): vscode.ProviderResult<ContentItem> {
    console.log("dataprovider", "getParent", item);
    throw new Error("Method not implemented.");
  }
  watch(
    uri: vscode.Uri
    // _options: { recursive: boolean; excludes: string[] }
  ): vscode.Disposable {
    // ignore, fires for all changes...
    console.log("watch", uri);
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new vscode.Disposable(() => {});
  }
  stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
    console.log("stat", uri);
    return this.model.getResourceByUri(uri).then((resource) => {
      console.log("stat - resource", resource);
      return {
        type: this.dataDescriptor.isContainer(resource)
          ? vscode.FileType.Directory
          : vscode.FileType.File,
        ctime: this.dataDescriptor.getCreationDate(resource),
        mtime: this.dataDescriptor.getModifyDate(resource),
        size: 0,
      };
    });
  }
  readDirectory(
    uri: vscode.Uri
  ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    console.log("readDirectory", uri);
    throw new Error("Method not implemented.");
  }
  readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
    console.log("readFile", uri);
    return this.model
      .getContentByUri(uri)
      .then((content) => this.textEncoder.encode(content));
  }
  createDirectory(uri: vscode.Uri): void | Thenable<void> {
    console.log("createDirectory", uri);
    throw new Error("Method not implemented.");
  }
  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): void | Thenable<void> {
    console.log("writeFile", uri, options);
    // if (options.overwrite) {
    return this.model.saveContentToUri(uri, this.textDecoder.decode(content));
    // }
  }
  delete(
    uri: vscode.Uri
    // options: { recursive: boolean }
  ): void | Thenable<void> {
    console.log("writeFile", uri);
    throw new Error("Method not implemented.");
  }
  rename(
    oldUri: vscode.Uri
    // newUri: vscode.Uri,
    // options: { overwrite: boolean }
  ): void | Thenable<void> {
    console.log("writeFile", oldUri);
    throw new Error("Method not implemented.");
  }
  copy?(
    source: vscode.Uri
    // destination: vscode.Uri,
    // options: { overwrite: boolean }
  ): void | Thenable<void> {
    console.log("writeFile", source);
    throw new Error("Method not implemented.");
  }
}
