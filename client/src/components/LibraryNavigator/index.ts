// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  commands,
  ExtensionContext,
  TreeView,
  ViewColumn,
  window,
} from "vscode";
import LibraryDataProvider from "./LibraryDataProvider";
import LibraryModel from "./LibraryModel";
import { LibraryItem, TableData } from "./types";
import renderTableView from "./utils";

class LibraryNavigator {
  private libraryDataProvider: LibraryDataProvider;
  private treeView: TreeView<any>;

  constructor(context: ExtensionContext) {
    this.libraryDataProvider = new LibraryDataProvider(new LibraryModel());
    this.treeView = window.createTreeView("sas-library-navigator", {
      treeDataProvider: this.libraryDataProvider,
    });

    // this.treeView.onDidChangeVisibility(async () => {
    //   if (this.treeView.visible) {
    //     this.libraryDataProvider.connect();
    //   }
    // });

    context.subscriptions.push(this.treeView);

    commands.registerCommand(
      "SAS.viewTable",
      async (item: LibraryItem, viewDataCallback: () => Promise<TableData>) => {
        console.log(item);
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
  }
}

export default LibraryNavigator;
