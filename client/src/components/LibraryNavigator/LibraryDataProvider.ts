// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  ProviderResult,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
} from "vscode";
import {
  Icons,
  LibraryType,
  Messages,
  TableType,
  WorkLibraryId,
} from "./const";
import LibraryModel from "./LibraryModel";
import { LibraryItem } from "./types";

class LibraryDataProvider implements TreeDataProvider<LibraryItem> {
  private _onDidChangeTreeData: EventEmitter<LibraryItem | undefined>;
  private model: LibraryModel;
  public dropMimeTypes: string[];
  public dragMimeTypes: string[];
  private extensionUri: Uri;

  onDidChangeFile: Event<FileChangeEvent[]>;

  get onDidChangeTreeData(): Event<LibraryItem> {
    return this._onDidChangeTreeData.event;
  }

  constructor(model: LibraryModel, extensionUri: Uri) {
    this._onDidChangeTreeData = new EventEmitter<LibraryItem | undefined>();
    this.model = model;
    this.dragMimeTypes = ["application/vnd.code.tree.libraryDragAndDrop"];
    this.extensionUri = extensionUri;
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
              arguments: [item, () => this.model.loadViewData(item)],
              title: Messages.ViewTableCommandTitle,
            }
          : undefined,
    };
  }

  private iconPathForItem(
    item: LibraryItem
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

  public async deleteTable(item: LibraryItem): Promise<void> {
    await this.model.deleteTable(item);
    this.refresh();
  }

  public watch(): Disposable {
    // ignore, fires for all changes...
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return new Disposable(() => {});
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
}

export default LibraryDataProvider;
