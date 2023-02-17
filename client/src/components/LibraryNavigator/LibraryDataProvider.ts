// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  Disposable,
  Event,
  EventEmitter,
  FileChangeEvent,
  ProviderResult,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";

class LibraryDataProvider implements TreeDataProvider<any> {
  private _onDidChangeTreeData: EventEmitter<any | undefined>;

  onDidChangeFile: Event<FileChangeEvent[]>;

  get onDidChangeTreeData(): Event<any> {
    return this._onDidChangeTreeData.event;
  }

  constructor() {
    this._onDidChangeTreeData = new EventEmitter<any | undefined>();
  }

  public getTreeItem(item: any): TreeItem | Promise<TreeItem> {
    return {
      iconPath: ThemeIcon.File,
      id: "1234",
      label: "Test",
      collapsibleState: TreeItemCollapsibleState.Collapsed,
      command: {
        command: "SAS.viewLibrary",
        arguments: [item],
        title: "View SAS Library",
      },
    };
  }

  public getChildren(item?: any): ProviderResult<any[]> {
    return ["1234"];
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
