// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, l10n, window } from "vscode";

import type { SortModelItem } from "ag-grid-community";

import PaginatedResultSet from "../components/LibraryNavigator/PaginatedResultSet";
import {
  TableColumn,
  TableData,
  TableQuery,
} from "../components/LibraryNavigator/types";
import { WebView } from "./WebviewManager";

class DataViewer extends WebView {
  public constructor(
    extensionUri: Uri,
    uid: string,
    protected readonly paginator: PaginatedResultSet<{
      data: TableData;
      error?: Error;
    }>,
    protected readonly fetchColumns: () => TableColumn[],
    protected readonly loadColumnProperties: (columnName: string) => void,
  ) {
    super(extensionUri, uid);
  }

  public l10nMessages() {
    return {
      "All columns are hidden.": l10n.t("All columns are hidden."),
      "Ascending (add to sorting)": l10n.t("Ascending (add to sorting)"),
      "Column order controls": l10n.t("Column order controls"),
      "Column visibility controls": l10n.t("Column visibility controls"),
      "Descending (add to sorting)": l10n.t("Descending (add to sorting)"),
      "Displayed columns": l10n.t("Displayed columns"),
      "Displayed columns ({count}):": l10n.t("Displayed columns ({count}):"),
      "Enter expression": l10n.t("Enter expression"),
      "Hidden columns": l10n.t("Hidden columns"),
      "Hidden columns ({count}):": l10n.t("Hidden columns ({count}):"),
      "Manage Columns": l10n.t("Manage Columns"),
      "Move to the bottom": l10n.t("Move to the bottom"),
      "Move to the top": l10n.t("Move to the top"),
      "No data matches the current filters.": l10n.t(
        "No data matches the current filters.",
      ),
      "No items are available.": l10n.t("No items are available."),
      "Not pinned": l10n.t("Not pinned"),
      "Pinned to the left": l10n.t("Pinned to the left"),
      "Pinned to the right": l10n.t("Pinned to the right"),
      "Remove all sorting": l10n.t("Remove all sorting"),
      "Remove sorting": l10n.t("Remove sorting"),
      "Resize column panels": l10n.t("Resize column panels"),
      "Retry loading table": l10n.t("Retry loading table"),
      "Row number": l10n.t("Row number"),
      "Sorted, Ascending": l10n.t("Sorted, Ascending"),
      "Sorted, Descending": l10n.t("Sorted, Descending"),
      Add: l10n.t("Add"),
      "Add all": l10n.t("Add all"),
      Ascending: l10n.t("Ascending"),
      Cancel: l10n.t("Cancel"),
      Character: l10n.t("Character"),
      Clear: l10n.t("Clear"),
      Close: l10n.t("Close"),
      Currency: l10n.t("Currency"),
      Date: l10n.t("Date"),
      Datetime: l10n.t("Datetime"),
      Descending: l10n.t("Descending"),
      Filter: l10n.t("Filter"),
      Numeric: l10n.t("Numeric"),
      OK: l10n.t("OK"),
      Options: l10n.t("Options"),
      Pin: l10n.t("Pin"),
      Properties: l10n.t("Properties"),
      Remove: l10n.t("Remove"),
      "Remove all": l10n.t("Remove all"),
      Search: l10n.t("Search"),
      Sort: l10n.t("Sort"),
      Undo: l10n.t("Undo"),
      "Move down": l10n.t("Move down"),
      "Move up": l10n.t("Move up"),
    };
  }

  public styles() {
    return ["DataViewer.css"];
  }

  public scripts() {
    return ["DataViewer.js"];
  }

  public body() {
    return `<div class="data-viewer-container" data-title="${this.title}"></div>`;
  }

  public invalidateColumns(): void {
    this.panel.webview.postMessage({
      command: "panel:invalidateColumns",
    });
  }

  public refreshData() {
    this.panel.webview.postMessage({
      command: "panel:refreshData",
    });
  }

  public async processMessage(
    event: Event & {
      key: string;
      command: string;
      data?: {
        start?: number;
        end?: number;
        sortModel?: SortModelItem[];
        columnName?: string;
        query: TableQuery | undefined;
      };
    },
  ): Promise<void> {
    switch (event.command) {
      case "request:loadData": {
        const { data, error } = await this.paginator.getData(
          event.data!.start!,
          event.data!.end!,
          event.data!.sortModel!,
          event.data!.query!,
        );
        this.panel.webview.postMessage({
          command: "response:loadData",
          key: event.key,
          data,
        });
        if (error) {
          await window.showErrorMessage(error.message);
        }
        break;
      }
      case "request:loadColumns": {
        try {
          const columns = await this.fetchColumns();
          this.panel.webview.postMessage({
            key: event.key,
            command: "response:loadColumns",
            data: { columns },
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.panel.webview.postMessage({
            key: event.key,
            command: "response:loadColumns",
            error: message,
          });
          void window.showErrorMessage(message);
        }
        break;
      }
      case "request:loadColumnProperties":
        if (event.data.columnName) {
          this.loadColumnProperties(event.data.columnName);
        }
        break;
      default:
        break;
    }
  }
}

export default DataViewer;
