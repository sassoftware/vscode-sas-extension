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
import LibraryDataProvider from "./LibraryDataProvider";
import LibraryDragAndDropController from "./LibraryDragAndDropController";
import LibraryModel from "./LibraryModel";
import { LibraryItem, TableData } from "./types";
import renderTableView from "./utils";

class LibraryNavigator {
  private libraryDataProvider: LibraryDataProvider;
  private treeView: TreeView<LibraryItem>;

  constructor(context: ExtensionContext) {
    const dragAndDropController = new LibraryDragAndDropController(
      "application/vnd.code.tree.sas-library-navigator"
    );
    this.libraryDataProvider = new LibraryDataProvider(new LibraryModel());
    this.treeView = window.createTreeView("sas-library-navigator", {
      treeDataProvider: this.libraryDataProvider,
      dragAndDropController,
    });

    context.subscriptions.push(this.treeView);
    context.subscriptions.push(
      languages.registerDocumentDropEditProvider(
        dragAndDropController.selector(),
        dragAndDropController
      )
    );

    commands.registerCommand(
      "SAS.viewTable",
      async (item: LibraryItem, viewDataCallback: () => Promise<TableData>) => {
        const panel = window.createWebviewPanel(
          // Panel view type
          "showGallery",
          // Panel title
          item.name,
          // The editor column the panel should be displayed in
          ViewColumn.One,
          // Extra panel configurations
          {
            // Enable JavaScript in the webview
            enableScripts: true,
          }
        );

        renderTableView(
          panel.webview,
          await viewDataCallback(),
          context.extensionUri
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
