// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, l10n, window } from "vscode";

import type { ColumnState, SortModelItem } from "ag-grid-community";

import PaginatedResultSet from "../components/LibraryNavigator/PaginatedResultSet";
import { TableData } from "../components/LibraryNavigator/types";
import { Column } from "../connection/rest/api/compute";
import { WebView } from "./WebviewManager";

export type ViewProperties = { columnState?: ColumnState[] };

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
      Ascending: l10n.t("Ascending"),
      "Descending (add to sorting)": l10n.t("Descending (add to sorting)"),
      Descending: l10n.t("Descending"),
      Properties: l10n.t("Properties"),
      "Remove all sorting": l10n.t("Remove all sorting"),
      "Remove sorting": l10n.t("Remove sorting"),
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
    return `<div class="data-viewer"></div>`;
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
      };
    },
  ): Promise<void> {
    switch (event.command) {
      case "request:loadData": {
        const { data, error } = await this.paginator.getData(
          event.data!.start!,
          event.data!.end!,
          event.data!.sortModel!,
        );
        if (error) {
          await window.showErrorMessage(error.message);
        }
        this.panel.webview.postMessage({
          command: "response:loadData",
          key: event.key,
          data,
        });
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
