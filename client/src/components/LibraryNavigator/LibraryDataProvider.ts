// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  ProgressLocation,
  ProviderResult,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  window,
} from "vscode";
import { getSession } from "../../connection";
import { DataAccessApi } from "../../connection/rest/api/compute";
import { getApiConfig } from "../../connection/rest/common";
import LibraryModel from "./LibraryModel";
import { LibraryItem } from "./types";

class LibraryDataProvider implements TreeDataProvider<LibraryItem> {
  private _onDidChangeTreeData: EventEmitter<LibraryItem | undefined>;
  private model: LibraryModel;

  onDidChangeFile: Event<FileChangeEvent[]>;

  get onDidChangeTreeData(): Event<LibraryItem> {
    return this._onDidChangeTreeData.event;
  }

  constructor(model: LibraryModel) {
    this._onDidChangeTreeData = new EventEmitter<LibraryItem | undefined>();
    this.model = model;
  }

  // public async connect(): Promise<void> {
  //   await this.model.connect();
  // }

  public getTreeItem(item: LibraryItem): TreeItem | Promise<TreeItem> {
    return {
      id: item.id,
      label: item.name,
      collapsibleState:
        item.type === "library"
          ? TreeItemCollapsibleState.Collapsed
          : TreeItemCollapsibleState.None,
      command:
        item.type === "table"
          ? {
              command: "SAS.viewTable",
              arguments: [item, () => this.model.loadViewData(item)],
              title: "View SAS Table",
            }
          : undefined,
    };
  }

  public getChildren(item?: LibraryItem): ProviderResult<LibraryItem[]> {
    return this.model.getChildren(item);
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
