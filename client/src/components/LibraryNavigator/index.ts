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

import { randomBytes, timingSafeEqual } from "crypto";
import { createWriteStream } from "fs";
import { createServer } from "http";

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
          const defaultUri =
            workspace.workspaceFolders && workspace.workspaceFolders.length > 0
              ? Uri.joinPath(workspace.workspaceFolders[0].uri, defaultFileName)
              : Uri.file(defaultFileName);

          const uri = await window.showSaveDialog({
            defaultUri,
          });

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

          try {
            // In web/virtual file systems (e.g. vscode-local:// from code-server's "Show Local"),
            // stream directly to the browser download pipeline.
            const selectedName = uri.path.split("/").pop() || defaultFileName;
            await this.streamTableToBrowserDownload(item, selectedName);
          } catch (error) {
            window.showErrorMessage(
              l10n.t("Failed to download table: {error}", {
                error: String(error?.message || error || "Unknown error").slice(
                  0,
                  200,
                ),
              }),
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

  private async streamTableToBrowserDownload(
    item: LibraryItem,
    fileName: string,
  ): Promise<void> {
    const token = randomBytes(24).toString("hex");
    // Preserve Unicode while removing only dangerous characters
    const asciiFileName =
      fileName
        .trim()
        // eslint-disable-next-line no-control-regex
        .replace(/[\x00-\x1f"\r\n]/g, "") // Remove control chars + quotes
        .replace(/\.\.+/g, ".") // Collapse multiple dots (path traversal)
        .replace(/^\.+/, "") // Remove leading dots
        .slice(0, 250) || "table.csv";
    const encodedFileName = encodeURIComponent(fileName || "table.csv");

    await new Promise<void>((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;
      let streamTimeoutId: NodeJS.Timeout | undefined;
      let tokenConsumed = false;
      let requestLock = false;
      let settled = false;

      const settleResolve = () => {
        if (settled) {
          return;
        }
        settled = true;
        server.removeListener("error", errorHandler);
        resolve();
      };

      const settleReject = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        if (streamTimeoutId) {
          clearTimeout(streamTimeoutId);
          streamTimeoutId = undefined;
        }
        server.removeListener("error", errorHandler);
        server.close(() => {});
        reject(error);
      };

      const isValidToken = (candidate: string | null): boolean => {
        if (!candidate || candidate.length !== token.length) {
          return false;
        }
        return timingSafeEqual(Buffer.from(candidate), Buffer.from(token));
      };

      const server = createServer((request, response) => {
        if (request.method !== "GET") {
          response.statusCode = 405;
          response.setHeader("Allow", "GET");
          response.end();
          return;
        }

        if (tokenConsumed || requestLock) {
          response.statusCode = 410;
          response.end();
          return;
        }

        const requestUrl = request.url
          ? new URL(request.url, "http://127.0.0.1")
          : undefined;

        if (
          !requestUrl ||
          requestUrl.pathname !== "/sas-table-download" ||
          !isValidToken(requestUrl.searchParams.get("token"))
        ) {
          response.statusCode = 404;
          response.end();
          return;
        }

        requestLock = true;
        tokenConsumed = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        server.close();

        response.setHeader("Content-Type", "text/csv; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Pragma", "no-cache");
        response.setHeader("X-Content-Type-Options", "nosniff");
        response.setHeader(
          "Content-Disposition",
          `attachment; filename="${asciiFileName}"; filename*=UTF-8''${encodedFileName}`,
        );

        // Set streaming timeout to prevent indefinite hangs on large tables
        streamTimeoutId = setTimeout(() => {
          response.destroy();
          server.close();
          settleReject(
            new Error(l10n.t("Download streaming timeout exceeded.")),
          );
        }, 300_000); // 5 minutes

        this.libraryDataProvider
          .writeTableContentsToStream(response, item)
          .then(() => {
            if (streamTimeoutId) {
              clearTimeout(streamTimeoutId);
              streamTimeoutId = undefined;
            }
            if (!response.writableEnded) {
              response.end();
            }
            settleResolve();
          })
          .catch((error) => {
            if (streamTimeoutId) {
              clearTimeout(streamTimeoutId);
              streamTimeoutId = undefined;
            }
            if (!response.headersSent) {
              response.statusCode = 500;
              response.setHeader("Content-Type", "text/plain");
              response.end("Download failed");
            } else {
              // Headers already sent - destroy connection to signal error to browser
              response.destroy();
            }
            settleReject(error);
          });
      });

      const errorHandler = (error: Error) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        settleReject(error);
      };

      server.on("error", errorHandler);

      server.listen(0, "127.0.0.1", async () => {
        try {
          const address = server.address();
          if (!address || typeof address === "string") {
            throw new Error(l10n.t("Unable to start download server."));
          }

          // asExternalUri only transforms scheme+host+port — the proxy strips
          // path and query. Resolve just the base, then append path+token.
          const baseLocalUri = Uri.parse(`http://127.0.0.1:${address.port}`);
          const externalBase = await env.asExternalUri(baseLocalUri);
          const externalUri = Uri.parse(
            `${externalBase.toString(true).replace(/\/+$/, "")}/sas-table-download?token=${token}`,
          );
          const opened = await env.openExternal(externalUri);

          if (!opened) {
            throw new Error(l10n.t("Failed to open browser download URL."));
          }

          // Timeout guards against the browser never making the request.
          // Once the request arrives and streaming begins, settleResolve()
          // is called from the request handler instead.
          // Increased to 90s for slow networks and corporate proxies
          timeoutId = setTimeout(() => {
            server.close();
            settleReject(
              new Error(
                l10n.t(
                  "Timed out waiting for the browser to start the download.",
                ),
              ),
            );
          }, 90_000);
        } catch (error) {
          server.close();
          settleReject(error);
        }
      });
    });
  }
}

export default LibraryNavigator;
