// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  commands,
  Disposable,
  ExtensionContext,
  TreeView,
  Uri,
  window,
} from "vscode";
import DataTable from "../../panels/DataTable";
import DragAndDropController from "../DragAndDropController";
import { SubscriptionProvider } from "../SubscriptionProvider";
import LibraryDataProvider from "./LibraryDataProvider";
import LibraryModel from "./LibraryModel";
import { LibraryItem, TableData } from "./types";

class LibraryNavigator implements SubscriptionProvider {
  private libraryDataProvider: LibraryDataProvider;
  private treeView: TreeView<LibraryItem>;
  private extensionUri: Uri;

  constructor(context: ExtensionContext) {
    this.extensionUri = context.extensionUri;
    const dragAndDropController = new DragAndDropController<LibraryItem>(
      context,
      "application/vnd.code.tree.sas-library-navigator",
      (item: LibraryItem | undefined) => (item.library ? item.uid : undefined)
    );
    this.libraryDataProvider = new LibraryDataProvider(
      new LibraryModel(),
      context.extensionUri
    );
    this.treeView = window.createTreeView("sas-library-navigator", {
      treeDataProvider: this.libraryDataProvider,
      dragAndDropController,
    });
  }

  public getSubscriptions(): Disposable[] {
    return [
      this.treeView,
      commands.registerCommand(
        "SAS.viewTable",
        async (
          item: LibraryItem,
          viewDataCallback: () => Promise<TableData>
        ) => {
          DataTable.render(
            this.extensionUri,
            item.uid,
            await viewDataCallback()
          );
        }
      ),
      commands.registerCommand("SAS.refreshLibraries", () => this.refresh()),
      commands.registerCommand("SAS.deleteTable", async (item: LibraryItem) => {
        try {
          await this.libraryDataProvider.deleteTable(item);
        } catch (error) {
          window.showErrorMessage(error.message);
        }
      }),
      commands.registerCommand("SAS.collapseAllLibraries", () => {
        commands.executeCommand(
          "workbench.actions.treeView.sas-library-navigator.collapseAll"
        );
      }),
    ];
  }

  public async refresh(): Promise<void> {
    this.libraryDataProvider.refresh();
  }
}

export default LibraryNavigator;
