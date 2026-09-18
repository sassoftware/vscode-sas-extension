// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Wires the file-backed table sources into VS Code:
//   - dispatches an explorer URI to the right source by extension
//   - opens a `DataViewer` panel with the resulting paginator + columns
//   - registers as a `SubscriptionProvider` so the activation entry can
//     pull our subscriptions alongside the other navigators
//
// Triggers (registered in `package.json`):
//   - command: `SAS.openTableFile` — explorer context menu + command palette
import {
  Disposable,
  ExtensionContext,
  ProgressLocation,
  Uri,
  commands,
  l10n,
  window,
  workspace,
} from "vscode";

import * as path from "path";

import DataViewer from "../../panels/DataViewer";
import { WebViewManager } from "../../panels/WebviewManager";
import PaginatedResultSet from "../LibraryNavigator/PaginatedResultSet";
import { TableData } from "../LibraryNavigator/types";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { csvSource } from "./csvSource";
import { localSas7bdatSource } from "./localSas7bdatSource";
import { xlsxSource } from "./xlsxSource";

/** Extensions we recognise. Exported so the package.json consistency
 *  test can verify the explorer-context menu glob keeps in lockstep. */
export const SUPPORTED = new Set([".csv", ".tsv", ".xlsx", ".sas7bdat"]);

/** Commands the dispatcher registers. Exported for the same reason as
 *  SUPPORTED — the package.json consistency test asserts every
 *  `SAS.*` command declared in `contributes.commands` shows up here. */
export const REGISTERED_COMMANDS: readonly string[] = ["SAS.openTableFile"];

/**
 * Which table viewer to open for a local file.
 *
 * Honors the `sas.betterTables.tableViewer` setting — but only when the user
 * has *explicitly* configured it. Absent setting → classic ag-grid, so nobody
 * is forced onto a viewer they never asked for (the mssql-style "better" viewer
 * ships as a separate feature). Returns "better" only when the user set it.
 */
function configuredViewerKind(): "better" | "classic" {
  const inspected = workspace
    .getConfiguration("sas.betterTables")
    .inspect<"better" | "classic">("tableViewer");
  const explicit =
    inspected?.globalValue ??
    inspected?.workspaceValue ??
    inspected?.workspaceFolderValue;
  return explicit === "better" ? "better" : "classic";
}

class FileTableViewer implements SubscriptionProvider {
  private readonly webviewManager = new WebViewManager();

  public constructor(private readonly context: ExtensionContext) {}

  public getSubscriptions(): Disposable[] {
    return [
      commands.registerCommand("SAS.openTableFile", (uri?: Uri) =>
        this.openFromCommand(uri),
      ),
    ];
  }

  /** Public entry point — used by the command and the custom editor. */
  public async open(uri: Uri): Promise<void> {
    const ext = path.extname(uri.fsPath).toLowerCase();
    if (!SUPPORTED.has(ext)) {
      void window.showErrorMessage(
        l10n.t("This file type is not supported by the table viewer: {ext}", {
          ext,
        }),
      );
      return;
    }

    try {
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: l10n.t("Opening {name}", { name: path.basename(uri.fsPath) }),
        },
        async () => {
          if (ext === ".sas7bdat") {
            this.openLocalSas7bdat(uri);
          } else if (ext === ".xlsx") {
            await this.openXlsx(uri);
          } else {
            await this.openCsv(uri);
          }
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      void window.showErrorMessage(
        l10n.t("Failed to open table: {msg}", { msg }),
      );
    }
  }

  private async openCsv(uri: Uri): Promise<void> {
    const source = await csvSource(uri.fsPath, `file:${uri.fsPath}`);
    this.openFromInMemory(source);
  }

  private async openXlsx(uri: Uri): Promise<void> {
    const source = await xlsxSource(uri.fsPath, `file:${uri.fsPath}`);
    if (!source) {
      return;
    } // user cancelled the sheet picker
    this.openFromInMemory(source);
  }

  /** Open a `.sas7bdat` locally (no SAS server). On files the local reader
   *  can't decode yet we show the specific reason rather than a generic
   *  failure. */
  private openLocalSas7bdat(uri: Uri): void {
    const source = localSas7bdatSource(uri.fsPath, `file:${uri.fsPath}`);
    this.openFromInMemory(source);
  }

  private openFromInMemory(source: {
    title: string;
    uid: string;
    columns: import("../../connection/rest/api/compute").Column[];
    rowCount: number;
    getRows: import("./types").FileTableSource["getRows"];
  }): void {
    const paginator = new PaginatedResultSet<{
      data: TableData;
      error?: Error;
    }>(async (start, end, sortModel, query) => {
      try {
        return { data: await source.getRows(start, end, sortModel, query) };
      } catch (e) {
        return {
          error: e instanceof Error ? e : new Error(String(e)),
          data: { rows: [], count: 0 },
        };
      }
    });

    // This branch bundles only the classic ag-grid viewer, so a "better"
    // request can't be satisfied here — surface it rather than silently
    // ignoring the user's configured choice. (The combined build routes this
    // same decision through DataViewerFactory, which can open the better
    // viewer.) The default remains classic.
    if (configuredViewerKind() === "better") {
      void window.showInformationMessage(
        l10n.t(
          "The \"better\" table viewer is not bundled in this build; opening the classic viewer instead.",
        ),
      );
    }

    this.webviewManager.render(
      new DataViewer(
        this.context.extensionUri,
        source.uid,
        paginator,
        () => source.columns,
        // No column-properties surface for in-memory file sources —
        // there is no SAS dictionary view to show.
        undefined,
      ),
      source.uid,
    );
  }

  /** Resolve a URI to open from a command invocation. The explorer
   *  context menu passes the URI directly; the command palette form
   *  prompts the user for a file. */
  private async openFromCommand(uri?: Uri): Promise<void> {
    let target = uri;
    if (!target) {
      const picked = await window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        filters: {
          [l10n.t("Tables")]: ["csv", "tsv", "xlsx", "sas7bdat"],
        },
        defaultUri: workspace.workspaceFolders?.[0].uri,
      });
      if (!picked || picked.length === 0) {
        return;
      }
      target = picked[0];
    }
    await this.open(target);
  }
}

export default FileTableViewer;
