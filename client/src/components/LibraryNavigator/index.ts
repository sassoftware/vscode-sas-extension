// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ConfigurationChangeEvent,
  Disposable,
  ExtensionContext,
  Uri,
  commands,
  window,
  workspace,
} from "vscode";

import { createWriteStream } from "fs";

import { profileConfig } from "../../commands/profile";
import { Column } from "../../connection/rest/api/compute";
import DataViewer from "../../panels/DataViewer";
import { WebViewManager } from "../../panels/WebviewManager";
import { SubscriptionProvider } from "../SubscriptionProvider";
import LibraryAdapterFactory from "./LibraryAdapterFactory";
import LibraryDataProvider from "./LibraryDataProvider";
import LibraryModel from "./LibraryModel";
import PaginatedResultSet from "./PaginatedResultSet";
import { LibraryAdapter, LibraryItem, TableData } from "./types";

class LibraryNavigator implements SubscriptionProvider {
  private libraryDataProvider: LibraryDataProvider;
  private extensionUri: Uri;
  private webviewManager: WebViewManager;

  constructor(context: ExtensionContext) {
    this.extensionUri = context.extensionUri;
    this.libraryDataProvider = new LibraryDataProvider(
      new LibraryModel(this.libraryAdapterForConnectionType()),
      context.extensionUri,
    );
    this.webviewManager = new WebViewManager();
  }

  public getSubscriptions(): Disposable[] {
    return [
      ...this.libraryDataProvider.getSubscriptions(),
      commands.registerCommand(
        "SAS.viewTable",
        async (
          item: LibraryItem,
          paginator: PaginatedResultSet<TableData>,
          fetchColumns: () => Column[],
        ) => {
          this.webviewManager.render(
            new DataViewer(
              this.extensionUri,
              item.uid,
              paginator,
              fetchColumns,
            ),
            item.uid,
          );
        },
      ),
      commands.registerCommand("SAS.refreshLibraries", () => this.refresh()),
      commands.registerCommand("SAS.deleteTable", async (item: LibraryItem) => {
        try {
          await this.libraryDataProvider.deleteTable(item);
        } catch (error) {
          window.showErrorMessage(error.message);
        }
      }),
      commands.registerCommand(
        "SAS.downloadTable",
        async (item: LibraryItem) => {
          const uri = await window.showSaveDialog({
            defaultUri: Uri.file(
              `${item.library}.${item.name}.csv`.toLocaleLowerCase(),
            ),
          });

          if (!uri) {
            return;
          }

          const stream = createWriteStream(uri.fsPath);
          await this.libraryDataProvider.writeTableContentsToStream(
            stream,
            item,
          );
        },
      ),
      commands.registerCommand("SAS.collapseAllLibraries", () => {
        commands.executeCommand(
          "workbench.actions.treeView.librarydataprovider.collapseAll",
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
    this.libraryDataProvider.useAdapter(this.libraryAdapterForConnectionType());
  }

  private libraryAdapterForConnectionType(): LibraryAdapter {
    const activeProfile = profileConfig.getProfileByName(
      profileConfig.getActiveProfile(),
    );

    return new LibraryAdapterFactory().create(activeProfile.connectionType);
  }
}

export default LibraryNavigator;
