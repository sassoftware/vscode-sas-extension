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

import { profileConfig } from "../../commands/profile";
import { getSession } from "../../connection";
import { onDidChangeSession } from "../../connection/session";
import DataViewer from "../../panels/DataViewer";
import TablePropertiesViewer from "../../panels/TablePropertiesViewer";
import { WebViewManager } from "../../panels/WebviewManager";
import { SubscriptionProvider } from "../SubscriptionProvider";
import {
  type ActiveProfileSnapshot,
  hasActiveProfileChanged,
} from "../profile";
import { treeViewSelections } from "../utils/treeViewSelections";
import { BrowserFileDownloadTarget } from "./BrowserFileDownloadTarget/BrowserFileDownloadTarget";
import { BrowserFileTableDownloadTarget } from "./BrowserFileTableDownloadTarget";
import { FileSystemTableDownloadTarget } from "./FileSystemTableDownloadTarget";
import { HostAttachmentDownloadTarget } from "./HostAttachmentDownloadTarget";
import LibraryAdapterFactory from "./LibraryAdapterFactory";
import LibraryDataProvider from "./LibraryDataProvider";
import LibraryModel from "./LibraryModel";
import PaginatedResultSet from "./PaginatedResultSet";
import { Messages } from "./const";
import {
  LibraryAdapter,
  LibraryItem,
  TableColumn,
  TableData,
  TableType,
} from "./types";

class LibraryNavigator implements SubscriptionProvider {
  private libraryDataProvider: LibraryDataProvider;
  private extensionUri: Uri;
  private webviewManager: WebViewManager;
  private browserFileDownloadTarget: BrowserFileDownloadTarget;
  private hostAttachmentDownloadTarget: HostAttachmentDownloadTarget;
  private browserFileExportInProgress = false;
  private previousActiveProfile: ActiveProfileSnapshot;

  constructor(context: ExtensionContext) {
    this.extensionUri = context.extensionUri;
    this.libraryDataProvider = new LibraryDataProvider(
      new LibraryModel(this.libraryAdapterForConnectionType()),
      context.extensionUri,
    );
    this.webviewManager = new WebViewManager();
    this.browserFileDownloadTarget = new BrowserFileDownloadTarget(
      this.extensionUri,
      this.webviewManager,
    );
    this.hostAttachmentDownloadTarget = new HostAttachmentDownloadTarget();
    this.previousActiveProfile = profileConfig.getActiveProfileSnapshot();
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
      onDidChangeSession(() => {
        Object.values(this.webviewManager.panels).forEach((viewer) => {
          if (viewer instanceof DataViewer) {
            viewer.invalidateColumns();
          }
        });
      }),
      commands.registerCommand(
        "SAS.viewTable",
        async (
          item: LibraryItem,
          paginator: PaginatedResultSet<{ data: TableData; error?: Error }>,
          fetchColumns: () => TableColumn[],
        ) => {
          const attributes = await getSession().contextAttributes?.();
          const allowDownload =
            attributes?.allowDownload?.toLowerCase() !== "false";
          this.webviewManager.render(
            new DataViewer(
              this.extensionUri,
              item.uid,
              paginator,
              fetchColumns,
              (columnName: string) => {
                this.displayTableProperties(item, true, columnName);
              },
              allowDownload,
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
        ).filter((item) => item.type === TableType && !item.readOnly);

        if (selectedItems.length === 0) {
          return;
        }

        const result = await window.showWarningMessage(
          l10n.t(
            selectedItems.length > 1
              ? Messages.TablesDeletionWarning
              : Messages.TableDeletionWarning,
          ),
          { modal: true },
          "Delete",
        );

        if (result !== "Delete") {
          return;
        }

        this.closeTableViewers(selectedItems);

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
            if (await this.redirectLocalComputerDestination(uri)) {
              return;
            }

            await new FileSystemTableDownloadTarget(uri).download(
              fileName,
              (signal) =>
                this.libraryDataProvider.createTableExport(item, signal),
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
        if (!event.affectsConfiguration("SAS.connectionProfiles")) {
          return;
        }

        const currentActiveProfile = profileConfig.getActiveProfileSnapshot();
        const activeProfileChanged = hasActiveProfileChanged(
          this.previousActiveProfile,
          currentActiveProfile,
        );
        this.previousActiveProfile = currentActiveProfile;

        if (activeProfileChanged) {
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

  private closeTableViewers(items: LibraryItem[]): void {
    for (const item of items) {
      [item.uid, `properties-${item.uid}`].forEach((key) =>
        this.webviewManager.panels[key]?.dispose(),
      );
    }
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

  private async redirectLocalComputerDestination(destination: Uri) {
    const isRemoteWorkspace =
      env.remoteName !== undefined ||
      workspace.workspaceFolders?.some(
        (folder) => folder.uri.scheme !== "file",
      ) === true;
    if (
      env.uiKind !== UIKind.Web ||
      destination.scheme !== "file" ||
      !isRemoteWorkspace
    ) {
      return false;
    }

    await window.showInformationMessage(
      l10n.t(
        'To download this table locally, cancel this dialog and choose "This Device" from the Download menu.',
      ),
    );
    return true;
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
          "This Device table download is only supported in VS Code for the Web.",
        ),
      );
    }
    this.libraryDataProvider.assertTableExportSupported();

    if (
      workspace
        .getConfiguration("SAS.tableDownload")
        .get("hostAttachment.force", false)
    ) {
      await this.hostAttachmentDownloadTarget.download(
        defaultFileName,
        (signal) => this.libraryDataProvider.createTableExport(item, signal),
      );
      return;
    }

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

    await new BrowserFileTableDownloadTarget(
      this.browserFileDownloadTarget,
      destination,
    ).download(defaultFileName, (signal) =>
      this.libraryDataProvider.createTableExport(item, signal),
    );
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
