// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ConfigurationChangeEvent,
  Disposable,
  ExtensionContext,
  UIKind,
  Uri,
  commands,
  env,
  l10n,
  window,
  workspace,
} from "vscode";

import { createWriteStream } from "fs";

import { profileConfig } from "../../commands/profile";
import { Column } from "../../connection/rest/api/compute";
import DataViewer from "../../panels/DataViewer";
import TablePropertiesViewer from "../../panels/TablePropertiesViewer";
import { WebViewManager } from "../../panels/WebviewManager";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { treeViewSelections } from "../utils/treeViewSelections";
import LibraryAdapterFactory from "./LibraryAdapterFactory";
import LibraryDataProvider from "./LibraryDataProvider";
import LibraryModel from "./LibraryModel";
import PaginatedResultSet from "./PaginatedResultSet";
import { streamTableToBrowserDownload } from "./browserDownload";
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
              (columnName: string) => {
                this.displayTableProperties(item, true, columnName);
              },
            ),
            item.uid,
          );
        },
      ),
      commands.registerCommand("SAS.refreshLibraries", () => this.refresh()),
      commands.registerCommand("SAS.deleteTable", async (item: LibraryItem) => {
        const selectedItems = treeViewSelections(
          this.libraryDataProvider.treeView,
          item,
        );

        if (selectedItems.length === 0) {
          return;
        }

        const result = await window.showWarningMessage(
          l10n.t(Messages.TablesDeletionWarning),
          { modal: true },
          "Delete",
        );

        if (result !== "Delete") {
          return;
        }

        try {
          await this.libraryDataProvider.deleteTables(selectedItems);
        } catch (error) {
          window.showErrorMessage(error.message);
        }
      }),
      commands.registerCommand(
        "SAS.downloadTable",
        async (item: LibraryItem) => {
          const defaultFileName =
            `${item.library}.${item.name}.csv`.toLocaleLowerCase();

          // In web-enabled vscode distros, the native save dialog cannot write to the user's local
          // file system, so skip it and stream directly to the browser.
          // In this mode, the file will be downloaded to the browser's default download location.
          if (env.uiKind === UIKind.Web) {
            try {
              await streamTableToBrowserDownload(
                item,
                defaultFileName,
                this.libraryDataProvider,
              );
            } catch (error) {
              window.showErrorMessage(
                l10n.t("Failed to download table: {error}", {
                  error: String(
                    error?.message || error || "Unknown error",
                  ).slice(0, 200),
                }),
              );
            }
            return;
          }

          // Desktop mode: let the user pick a save location.
          const defaultUri =
            workspace.workspaceFolders && workspace.workspaceFolders.length > 0
              ? Uri.joinPath(workspace.workspaceFolders[0].uri, defaultFileName)
              : Uri.file(defaultFileName);

          const uri = await window.showSaveDialog({ defaultUri });
          if (!uri) {
            return;
          }

          if (uri.scheme === "file") {
            try {
              await this.libraryDataProvider.writeTableContentsToStream(
                createWriteStream(uri.fsPath),
                item,
              );
            } catch (error) {
              window.showErrorMessage(
                l10n.t("Failed to download table: {error}", {
                  error: String(
                    error?.message || error || "Unknown error",
                  ).slice(0, 200),
                }),
              );
            }
            return;
          }
        },
      ),
      commands.registerCommand(
        "SAS.showTableProperties",
        async (item: LibraryItem) => {
          await this.displayTableProperties(item);
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

  private async displayTableProperties(
    item: LibraryItem,
    showPropertiesTab: boolean = false,
    focusedColumn?: string,
  ) {
    try {
      const tableInfo = await this.libraryDataProvider.getTableInfo(item);
      const columns = await this.libraryDataProvider.fetchColumns(item);

      this.webviewManager.render(
        new TablePropertiesViewer(
          this.extensionUri,
          item.uid,
          tableInfo,
          columns,
          showPropertiesTab,
          focusedColumn,
        ),
        `properties-${item.uid}`,
        true,
      );
    } catch (error) {
      window.showErrorMessage(
        `Failed to load table properties: ${error.message}`,
      );
    }
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
