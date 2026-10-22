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

import { randomUUID } from "crypto";

import { profileConfig } from "../../commands/profile";
import DataViewer from "../../panels/DataViewer";
import TablePropertiesViewer from "../../panels/TablePropertiesViewer";
import { WebViewManager } from "../../panels/WebviewManager";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { treeViewSelections } from "../utils/treeViewSelections";
import { BrowserDownloadChunkBuffer } from "./BrowserFileDownloadTarget/BrowserDownloadChunkBuffer";
import { BrowserFileDownloadTarget } from "./BrowserFileDownloadTarget/BrowserFileDownloadTarget";
import { MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES } from "./BrowserFileDownloadTarget/constants";
import { HostAttachmentDownloadTarget } from "./HostAttachmentDownloadTarget";
import LibraryAdapterFactory from "./LibraryAdapterFactory";
import LibraryDataProvider from "./LibraryDataProvider";
import LibraryModel from "./LibraryModel";
import { NodeFileDownloadTarget } from "./NodeFileDownloadTarget";
import PaginatedResultSet from "./PaginatedResultSet";
import { Messages } from "./const";
import { LibraryAdapter, LibraryItem, TableColumn, TableData } from "./types";

class LibraryNavigator implements SubscriptionProvider {
  private libraryDataProvider: LibraryDataProvider;
  private extensionUri: Uri;
  private webviewManager: WebViewManager;
  private browserFileDownloadTarget: BrowserFileDownloadTarget;
  private hostAttachmentDownloadTarget: HostAttachmentDownloadTarget;
  private nodeFileDownloadTarget: NodeFileDownloadTarget;
  private browserFileExportInProgress = false;

  constructor(context: ExtensionContext) {
    this.extensionUri = context.extensionUri;
    this.libraryDataProvider = new LibraryDataProvider(
      new LibraryModel(this.libraryAdapterForConnectionType()),
      context.extensionUri,
    );
    this.webviewManager = new WebViewManager();
    this.browserFileDownloadTarget = new BrowserFileDownloadTarget();
    this.hostAttachmentDownloadTarget = new HostAttachmentDownloadTarget();
    this.nodeFileDownloadTarget = new NodeFileDownloadTarget();
  }

  public getSubscriptions(): Disposable[] {
    return [
      ...this.libraryDataProvider.getSubscriptions(),
      this.browserFileDownloadTarget,
      this.hostAttachmentDownloadTarget,
      commands.registerCommand(
        "SAS.downloadTableRemoteWorkspace",
        async (item: LibraryItem) => {
          if (env.uiKind === UIKind.Web) {
            try {
              this.libraryDataProvider.assertTableExportSupported();
            } catch (error) {
              await window.showErrorMessage(
                error instanceof Error ? error.message : String(error),
              );
              return;
            }
            if (!workspace.workspaceFolders?.length) {
              await window.showErrorMessage(
                l10n.t(
                  "Remote Workspace table download requires an open workspace.",
                ),
              );
              return;
            }
          }
          await commands.executeCommand("SAS.downloadTable", item);
        },
      ),
      commands.registerCommand(
        "SAS.downloadTableToComputer",
        async (item: LibraryItem) => {
          try {
            await this.runSingleBrowserFileExport(() =>
              this.downloadTableToComputer(item),
            );
          } catch (error) {
            await window.showErrorMessage(
              error instanceof Error ? error.message : String(error),
            );
          }
        },
      ),
      commands.registerCommand(
        "SAS.viewTable",
        async (
          item: LibraryItem,
          paginator: PaginatedResultSet<{ data: TableData; error?: Error }>,
          fetchColumns: () => TableColumn[],
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
          if (env.uiKind === UIKind.Web) {
            try {
              this.libraryDataProvider.assertTableExportSupported();
            } catch (error) {
              await window.showErrorMessage(
                error instanceof Error ? error.message : String(error),
              );
              return;
            }
          }
          try {
            const fileName =
              `${item.library}.${item.name}.csv`.toLocaleLowerCase();
            const uri = await window.showSaveDialog({
              defaultUri: this.defaultDownloadUri(fileName),
            });
            if (!uri) {
              return;
            }

            await this.nodeFileDownloadTarget.write(uri, (writeChunk) =>
              this.libraryDataProvider.writeTableContents(item, writeChunk),
            );
          } catch (error) {
            await window.showErrorMessage(
              error instanceof Error ? error.message : String(error),
            );
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

  public refreshOpenTableViewers(): void {
    Object.values(this.webviewManager.panels).forEach((panel) => {
      if (
        panel instanceof DataViewer ||
        panel instanceof TablePropertiesViewer
      ) {
        panel.refreshData();
      }
    });
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
          () => this.libraryDataProvider.getTableInfo(item),
          () => this.libraryDataProvider.fetchColumns(item),
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

  private async runSingleBrowserFileExport(
    exportTable: () => Promise<void>,
  ): Promise<void> {
    if (this.browserFileExportInProgress) {
      await window.showInformationMessage(
        l10n.t(
          "A browser file export is already in progress. Wait for it to finish before starting another.",
        ),
      );
      return;
    }

    this.browserFileExportInProgress = true;
    try {
      await exportTable();
    } finally {
      this.browserFileExportInProgress = false;
    }
  }

  private async downloadTableToComputer(item: LibraryItem): Promise<void> {
    const defaultFileName =
      `${item.library}.${item.name}.csv`.toLocaleLowerCase();

    if (env.uiKind !== UIKind.Web) {
      throw new Error(
        l10n.t(
          "This Computer table download is only supported in VS Code for the Web.",
        ),
      );
    }
    this.libraryDataProvider.assertTableExportSupported();

    const choice = await this.browserFileDownloadTarget.chooseLocalFile(
      defaultFileName,
      `${item.library}.${item.name}`,
    );
    if (choice.kind === "cancelled") {
      return;
    }
    if (choice.kind === "unsupported") {
      await this.hostAttachmentDownloadTarget.download(
        defaultFileName,
        (signal) => this.libraryDataProvider.createTableExport(item, signal),
      );
      return;
    }
    const destination = choice;

    const transferId = randomUUID();
    const controller = new AbortController();
    const panelClosed = this.browserFileDownloadTarget.onDidClose(() =>
      controller.abort(new Error(l10n.t("The download panel was closed."))),
    );
    let opened = false;
    let finished = false;
    try {
      await this.browserFileDownloadTarget.setStatus(
        l10n.t("Preparing the CSV export..."),
      );
      await this.browserFileDownloadTarget.open(
        destination.token,
        transferId,
        destination.fileName,
      );
      opened = true;
      await this.browserFileDownloadTarget.setStatus(
        l10n.t("Streaming the CSV to your computer..."),
      );
      const chunkBuffer = new BrowserDownloadChunkBuffer(
        MAX_BROWSER_DOWNLOAD_CHUNK_SIZE_BYTES,
        async (chunk, signal) => {
          await this.browserFileDownloadTarget.waitUntilVisible(signal);
          await this.browserFileDownloadTarget.write(transferId, chunk, signal);
        },
      );
      const completed = await this.libraryDataProvider.writeTableContents(
        item,
        (chunk, signal) => chunkBuffer.write(chunk, signal),
        controller.signal,
      );
      if (completed) {
        await chunkBuffer.flush(controller.signal);
      }
      await this.browserFileDownloadTarget.finish(transferId, completed);
      finished = true;
      if (!completed) {
        await this.browserFileDownloadTarget.setStatus(
          l10n.t("Download canceled."),
        );
        return;
      }
      await this.browserFileDownloadTarget.setStatus(
        l10n.t("Download complete. You can close this tab."),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (opened && !finished) {
        try {
          await this.browserFileDownloadTarget.finish(transferId, false);
          finished = true;
        } catch {
          // Closing the panel also closes the browser writer.
        }
      }
      if (!controller.signal.aborted) {
        await this.browserFileDownloadTarget.setStatus(
          l10n.t("Export failed: {message}", { message }),
        );
        throw error;
      }
    } finally {
      panelClosed.dispose();
      if (opened && !finished) {
        try {
          await this.browserFileDownloadTarget.finish(transferId, false);
        } catch {
          // The panel may have been closed while the export was running.
        }
      }
      try {
        await this.browserFileDownloadTarget.discardDestination(
          destination.token,
        );
      } catch {
        // The panel was already disposed.
      }
    }
  }

  private defaultDownloadUri(fileName: string): Uri {
    if (
      (env.remoteName !== undefined || env.uiKind === UIKind.Web) &&
      workspace.workspaceFolders &&
      workspace.workspaceFolders.length > 0
    ) {
      return Uri.joinPath(workspace.workspaceFolders[0].uri, fileName);
    }
    return Uri.file(fileName);
  }

  private libraryAdapterForConnectionType(): LibraryAdapter | undefined {
    const activeProfile = profileConfig.getProfileByName(
      profileConfig.getActiveProfile(),
    );

    if (!activeProfile) {
      return;
    }

    return new LibraryAdapterFactory().create(
      activeProfile.connectionType,
      () => this.libraryDataProvider.refresh(),
    );
  }
}

export default LibraryNavigator;
