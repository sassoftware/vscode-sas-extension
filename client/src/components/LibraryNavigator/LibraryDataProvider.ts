// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  Disposable,
  Event,
  EventEmitter,
  ProviderResult,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
} from "vscode";
import LibraryModel from "./LibraryModel";
import { Icons, Messages, WorkLibraryId } from "./const";
import { LibraryItem, LibraryType, TableType } from "./types";

class LibraryDataProvider implements TreeDataProvider<LibraryItem> {
  private _onDidChangeTreeData = new EventEmitter<LibraryItem | undefined>();

  get onDidChangeTreeData(): Event<LibraryItem> {
    return this._onDidChangeTreeData.event;
  }

  constructor(
    private readonly model: LibraryModel,
    private readonly extensionUri: Uri
  ) {}

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
    this.model.reset();
    this._onDidChangeTreeData.fire(undefined);
  }
}

export default LibraryDataProvider;
