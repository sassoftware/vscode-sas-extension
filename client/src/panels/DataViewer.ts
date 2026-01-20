// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, l10n, window } from "vscode";

import type { ColumnState, SortModelItem } from "ag-grid-community";

import PaginatedResultSet from "../components/LibraryNavigator/PaginatedResultSet";
import { TableData, TableQuery } from "../components/LibraryNavigator/types";
import { Column } from "../connection/rest/api/compute";
import { WebView } from "./WebviewManager";

export type ViewProperties = {
  columnState?: ColumnState[];
  query?: TableQuery;
};

class DataViewer extends WebView {
  protected viewProperties: ViewProperties = {};
  public constructor(
    extensionUri: Uri,
    uid: string,
    protected readonly paginator: PaginatedResultSet<{
      data: TableData;
      error?: Error;
    }>,
    protected readonly fetchColumns: () => Column[],
    protected readonly loadColumnProperties: (columnName: string) => void,
  ) {
    super(extensionUri, uid);
  }

  public l10nMessages() {
    return {
      "Ascending (add to sorting)": l10n.t("Ascending (add to sorting)"),
      "Descending (add to sorting)": l10n.t("Descending (add to sorting)"),
      "Enter expression": l10n.t("Enter expression"),
      "No data matches the current filters.": l10n.t(
        "No data matches the current filters.",
      ),
      "Remove all sorting": l10n.t("Remove all sorting"),
      "Remove sorting": l10n.t("Remove sorting"),
      "Row number": l10n.t("Row number"),
      "Sorted, Ascending": l10n.t("Sorted, Ascending"),
      "Sorted, Descending": l10n.t("Sorted, Descending"),
      Ascending: l10n.t("Ascending"),
      Character: l10n.t("Character"),
      Clear: l10n.t("Clear"),
      Currency: l10n.t("Currency"),
      Date: l10n.t("Date"),
      Datetime: l10n.t("Datetime"),
      Descending: l10n.t("Descending"),
      Numeric: l10n.t("Numeric"),
      Options: l10n.t("Options"),
      Properties: l10n.t("Properties"),
      Search: l10n.t("Search"),
      Sort: l10n.t("Sort"),
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

  public async processMessage(
    event: Event & {
      key: string;
      command: string;
      data?: {
        start?: number;
        end?: number;
        sortModel?: SortModelItem[];
        columnName?: string;
        viewProperties?: Partial<ViewProperties>;
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
      case "request:loadColumns":
        this.panel.webview.postMessage({
          key: event.key,
          command: "response:loadColumns",
          data: {
            columns: await this.fetchColumns(),
            viewProperties: this.viewProperties,
          },
        });
        break;
      case "request:loadColumnProperties":
        if (event.data.columnName) {
          this.loadColumnProperties(event.data.columnName);
        }
        break;
      case "request:storeViewProperties":
        if (event.data.viewProperties) {
          this.viewProperties = {
            ...this.viewProperties,
            ...event.data.viewProperties,
          };
        }
        break;
      default:
        break;
    }
  }
}

export default DataViewer;
