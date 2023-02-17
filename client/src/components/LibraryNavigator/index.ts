// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { commands, ExtensionContext, TreeView, window } from "vscode";
import LibraryDataProvider from "./LibraryDataProvider";

class LibraryNavigator {
  private libraryDataProvider: LibraryDataProvider;
  private treeView: TreeView<any>;

  constructor(context: ExtensionContext) {
    this.libraryDataProvider = new LibraryDataProvider();
    this.treeView = window.createTreeView("sas-library-navigator", {
      treeDataProvider: this.libraryDataProvider,
    });

    // this.treeView.onDidChangeVisibility(async () => {
    //   if (this.treeView.visible) {

    //   }
    // });

    context.subscriptions.push(this.treeView);

    commands.registerCommand("SAS.viewLibrary", async (item: any) => {
      console.log("SAS.viewLibrary item", { item });
    });
  }
}

export default LibraryNavigator;
