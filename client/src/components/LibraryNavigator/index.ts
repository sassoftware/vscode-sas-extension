// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  commands,
  ConfigurationChangeEvent,
  Disposable,
  ExtensionContext,
  TreeView,
  Uri,
  window,
  workspace,
} from "vscode";
import { Column } from "../../connection/rest/api/compute";
import DataViewer from "../../panels/DataViewer";
import { WebViewManager } from "../../panels/WebviewManager";
import DragAndDropController from "../DragAndDropController";
import { SubscriptionProvider } from "../SubscriptionProvider";
import LibraryDataProvider from "./LibraryDataProvider";
import LibraryModel from "./LibraryModel";
import PaginatedResultSet from "./PaginatedResultSet";
import { LibraryItem, TableData } from "./types";

class LibraryNavigator implements SubscriptionProvider {
  private libraryDataProvider: LibraryDataProvider;
  private treeView: TreeView<LibraryItem>;
  private extensionUri: Uri;
  private webviewManager: WebViewManager;

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
    this.webviewManager = new WebViewManager();
  }

  public getSubscriptions(): Disposable[] {
    return [
      this.treeView,
      commands.registerCommand(
        "SAS.viewTable",
        async (
          item: LibraryItem,
          paginator: PaginatedResultSet<TableData>,
          fetchColumns: () => Column[]
        ) => {
          this.webviewManager.render(
            new DataViewer(
              this.extensionUri,
              item.uid,
              paginator,
              fetchColumns
            ),
            item.uid
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
      workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
        if (event.affectsConfiguration("SAS.connectionProfiles")) {
          this.refresh();
        }
      }),
    ];
  }

  public async refresh(): Promise<void> {
    this.libraryDataProvider.refresh();
  }
}

export default LibraryNavigator;
