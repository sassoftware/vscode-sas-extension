// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CancellationToken,
  DataTransfer,
  DataTransferItem,
  Disposable,
  DocumentDropEdit,
  DocumentSelector,
  Event,
  EventEmitter,
  Position,
  ProviderResult,
  TextDocument,
  TreeDataProvider,
  TreeDragAndDropController,
  TreeItem,
  TreeItemCollapsibleState,
  TreeView,
  Uri,
  languages,
  window,
} from "vscode";

import { Writable } from "stream";

import { SubscriptionProvider } from "../SubscriptionProvider";
import LibraryModel from "./LibraryModel";
import { Icons, Messages, WorkLibraryId } from "./const";
import { LibraryAdapter, LibraryItem, LibraryType, TableType } from "./types";

export const libraryItemMimeType =
  "application/vnd.code.tree.librarydataprovider";
const tableTextMimeType = `${libraryItemMimeType}.text`;
class LibraryDataProvider
  implements
    TreeDataProvider<LibraryItem>,
    TreeDragAndDropController<LibraryItem>,
    SubscriptionProvider
{
  private _onDidChangeTreeData = new EventEmitter<LibraryItem | undefined>();
  private _treeView: TreeView<LibraryItem>;
  private _dropEditProvider: Disposable;

  public dropMimeTypes: string[] = [];
  public dragMimeTypes: string[] = [libraryItemMimeType, tableTextMimeType];

  get onDidChangeTreeData(): Event<LibraryItem> {
    return this._onDidChangeTreeData.event;
  }

  constructor(
    private readonly model: LibraryModel,
    private readonly extensionUri: Uri,
  ) {
    this._treeView = window.createTreeView("librarydataprovider", {
      treeDataProvider: this,
      dragAndDropController: this,
      canSelectMany: true,
    });
    this._dropEditProvider = languages.registerDocumentDropEditProvider(
      this.selector(),
      this,
    );
  }

  public getSubscriptions(): Disposable[] {
    return [this._treeView, this._dropEditProvider];
  }

  public handleDrag(
    source: LibraryItem[],
    dataTransfer: DataTransfer,
  ): void | Thenable<void> {
    const dataTransferItem = new DataTransferItem(source);
    dataTransfer.set(libraryItemMimeType, dataTransferItem);
    if (source?.[0].library) {
      dataTransfer.set(
        tableTextMimeType,
        new DataTransferItem(source?.[0].uid),
      );
    }
  }

  public async provideDocumentDropEdits(
    _document: TextDocument,
    position: Position,
    dataTransfer: DataTransfer,
    token: CancellationToken,
  ): Promise<DocumentDropEdit | undefined> {
    const dataTransferItem = dataTransfer.get(this.dragMimeTypes[1]);
    if (token.isCancellationRequested || !dataTransferItem) {
      return undefined;
    }

    return { insertText: dataTransferItem.value };
  }

  public selector(): DocumentSelector {
    return { language: "sas" };
  }

  public getTreeItem(item: LibraryItem): TreeItem | Promise<TreeItem> {
    const iconPath = this.iconPathForItem(item);
    return {
      id: item.uid,
      iconPath: iconPath
        ? {
            light: Uri.joinPath(this.extensionUri, iconPath.light),
            dark: Uri.joinPath(this.extensionUri, iconPath.dark),
          }
        : undefined,
      label: item.name,
      contextValue: `${item.type}-${item.readOnly ? "readonly" : "actionable"}`,
      collapsibleState:
        item.type === LibraryType
          ? TreeItemCollapsibleState.Collapsed
          : TreeItemCollapsibleState.None,
      command:
        item.type === TableType
          ? {
              command: "SAS.viewTable",
              arguments: [
                item,
                this.model.getTableResultSet(item),
                () => this.model.fetchColumns(item),
              ],
              title: Messages.ViewTableCommandTitle,
            }
          : undefined,
    };
  }

  private iconPathForItem(
    item: LibraryItem,
  ): { light: string; dark: string } | undefined {
    switch (item.type) {
      case TableType:
        return Icons.DataSet;
      case LibraryType:
        if (item.id === WorkLibraryId) {
          return Icons.WorkLibrary;
        }

        if (item.readOnly) {
          return Icons.ReadOnlyLibrary;
        }

        return Icons.Library;
      default:
        return;
    }
  }

  public getChildren(item?: LibraryItem): ProviderResult<LibraryItem[]> {
    return this.model.getChildren(item);
  }

  public writeTableContentsToStream(stream: Writable, item: LibraryItem) {
    return this.model.writeTableContentsToStream(stream, item);
  }

  public async deleteTable(item: LibraryItem): Promise<void> {
    await this.model.deleteTable(item);
    this._onDidChangeTreeData.fire(undefined);
  }

  public watch(): Disposable {
    // ignore, fires for all changes...
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => {});
  }

  public useAdapter(libraryAdapter: LibraryAdapter): void {
    this.model.useAdapter(libraryAdapter);
    this._onDidChangeTreeData.fire(undefined);
  }
}

export default LibraryDataProvider;
