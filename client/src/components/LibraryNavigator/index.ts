// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  commands,
  ExtensionContext,
  languages,
  TreeView,
  ViewColumn,
  window,
} from "vscode";
import DataTable from "../../panels/DataTable";
import DragAndDropController from "../DragAndDropController";
import LibraryDataProvider from "./LibraryDataProvider";
import LibraryModel from "./LibraryModel";
import { LibraryItem, TableData } from "./types";

class LibraryNavigator {
  private libraryDataProvider: LibraryDataProvider;
  private treeView: TreeView<LibraryItem>;

  constructor(context: ExtensionContext) {
    const dragAndDropController = new DragAndDropController<LibraryItem>(
      context,
      "application/vnd.code.tree.sas-library-navigator",
      (item: LibraryItem | undefined) => (item.library ? item.uid : undefined)
    );
    this.libraryDataProvider = new LibraryDataProvider(new LibraryModel());
    this.treeView = window.createTreeView("sas-library-navigator", {
      treeDataProvider: this.libraryDataProvider,
      dragAndDropController,
    });

    context.subscriptions.push(this.treeView);

    commands.registerCommand(
      "SAS.viewTable",
      async (item: LibraryItem, viewDataCallback: () => Promise<TableData>) => {
        DataTable.render(
          context.extensionUri,
          item.uid,
          item.name,
          await viewDataCallback()
        );
      }
    );

    commands.registerCommand("SAS.refreshLibraries", () => this.refresh());
  }

  public async refresh(): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.libraryDataProvider.refresh();
        resolve();
      }, 3 * 1000);
    });
  }
}

export default LibraryNavigator;
