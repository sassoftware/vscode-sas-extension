// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ConfigurationChangeEvent,
  Disposable,
  ExtensionContext,
  Uri,
  commands,
  env,
  l10n,
  window,
  workspace,
} from "vscode";

import { createWriteStream } from "fs";
import * as path from "path";

import { profileConfig } from "../../commands/profile";
import { Column } from "../../connection/rest/api/compute";
import DataViewer from "../../panels/DataViewer";
import TablePropertiesViewer from "../../panels/TablePropertiesViewer";
import { WebViewManager } from "../../panels/WebviewManager";
import { SubscriptionProvider } from "../SubscriptionProvider";
import LibraryAdapterFactory from "./LibraryAdapterFactory";
import LibraryDataProvider from "./LibraryDataProvider";
import LibraryModel from "./LibraryModel";
import PaginatedResultSet from "./PaginatedResultSet";
import { Messages } from "./const";
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
          paginator: PaginatedResultSet<{ data: TableData; error?: Error }>,
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
        const selectedItems = this.treeViewSelections(item);

        if (selectedItems.length === 0) {
          return;
        }

        try {
          if (selectedItems.length === 1) {
            await this.libraryDataProvider.deleteTable(selectedItems[0]);
          } else {
            const tableNames = selectedItems
              .map((table) => `${table.library}.${table.name}`)
              .join(", ");

            const result = await window.showWarningMessage(
              l10n.t(Messages.TablesDeletionWarning, {
                tableNames: tableNames,
              }),
              { modal: true },
              "Delete",
            );

            if (result !== "Delete") {
              return;
            }

            await this.libraryDataProvider.deleteTables(selectedItems);
          }
        } catch (error) {
          window.showErrorMessage(error.message);
        }
      }),
      commands.registerCommand(
        "SAS.downloadTable",
        async (item: LibraryItem) => {
          let dataFilePath: string = "";
          if (
            env.remoteName !== undefined &&
            workspace.workspaceFolders &&
            workspace.workspaceFolders.length > 0
          ) {
            // start from 'rootPath' workspace folder
            dataFilePath = workspace.workspaceFolders[0].uri.fsPath;
          }
          dataFilePath = path.join(
            dataFilePath,
            `${item.library}.${item.name}.csv`.toLocaleLowerCase(),
          );

          // display save file dialog
          const uri = await window.showSaveDialog({
            defaultUri: Uri.file(dataFilePath),
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
      commands.registerCommand(
        "SAS.showTableProperties",
        async (item: LibraryItem) => {
          try {
            const tableInfo = await this.libraryDataProvider.getTableInfo(item);
            const columns = await this.libraryDataProvider.fetchColumns(item);

            this.webviewManager.render(
              new TablePropertiesViewer(
                this.extensionUri,
                item.uid,
                tableInfo,
                columns,
                false, // Show properties tab
              ),
              `properties-${item.uid}`,
            );
          } catch (error) {
            window.showErrorMessage(
              `Failed to load table properties: ${error.message}`,
            );
          }
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

  private treeViewSelections(item: LibraryItem): LibraryItem[] {
    const items =
      this.libraryDataProvider.treeView.selection.length > 1 || !item
        ? this.libraryDataProvider.treeView.selection
        : [item];

    return items.filter(Boolean);
  }

  private libraryAdapterForConnectionType(): LibraryAdapter | undefined {
    const activeProfile = profileConfig.getProfileByName(
      profileConfig.getActiveProfile(),
    );

    if (!activeProfile) {
      return;
    }

    return new LibraryAdapterFactory().create(activeProfile.connectionType);
  }
}

export default LibraryNavigator;
