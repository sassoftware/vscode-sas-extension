// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { commands, ExtensionContext, TreeView, window } from "vscode";
import DataTable from "../../panels/DataTable";
import { featureEnabled } from "../../util/feature";
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
    this.libraryDataProvider = new LibraryDataProvider(
      new LibraryModel(),
      context.extensionUri
    );
    this.treeView = window.createTreeView("sas-library-navigator", {
      treeDataProvider: this.libraryDataProvider,
      dragAndDropController,
    });

    context.subscriptions.push(this.treeView);

    commands.registerCommand(
      "SAS.viewTable",
      async (item: LibraryItem, viewDataCallback: () => Promise<TableData>) => {
        if (!featureEnabled("dataViewer")) {
          return;
        }

        DataTable.render(
          context.extensionUri,
          item.uid,
          await viewDataCallback()
        );
      }
    );

    commands.registerCommand("SAS.refreshLibraries", () => this.refresh());

    commands.registerCommand("SAS.deleteTable", async (item: LibraryItem) => {
      try {
        await this.libraryDataProvider.deleteTable(item);
      } catch (error) {
        window.showErrorMessage(error.message);
      }
    });
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
