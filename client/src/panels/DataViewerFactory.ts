// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Picks which table viewer to open for a given table/data source based on
// the `sas.betterTables.tableViewer` setting (`"better"` — the mssql-style
// react-data-grid viewer, the default — or `"classic"` — the upstream
// SAS extension's original ag-grid viewer). Both viewers share the same
// constructor contract, so the call sites (`LibraryNavigator`,
// `FileTableViewer`) stay unchanged apart from routing through here.
import { Uri, workspace } from "vscode";

import PaginatedResultSet from "../components/LibraryNavigator/PaginatedResultSet";
import type {
  TableColumn,
  TableData,
} from "../components/LibraryNavigator/types";
import BetterDataViewer from "./BetterDataViewer";
import DataViewer from "./DataViewer";

export type TableViewerKind = "better" | "classic";

/** The configured viewer kind, safe against unknown/legacy values. */
export function tableViewerKind(): TableViewerKind {
  const configured = workspace
    .getConfiguration("sas.betterTables")
    .get<TableViewerKind>("tableViewer", "better");
  return configured === "classic" ? "classic" : "better";
}

/** Build the viewer the user has selected for a table/data-source.
 *  The two viewers share an identical constructor contract, so whichever
 *  one is returned can be rendered by a `WebViewManager` unchanged. */
export function createDataViewer(
  extensionUri: Uri,
  uid: string,
  paginator: PaginatedResultSet<{ data: TableData; error?: Error }>,
  fetchColumns: () => TableColumn[],
  loadColumnProperties: (columnName: string) => void,
): DataViewer | BetterDataViewer {
  if (tableViewerKind() === "classic") {
    return new DataViewer(
      extensionUri,
      uid,
      paginator,
      fetchColumns,
      loadColumnProperties,
    );
  }
  return new BetterDataViewer(
    extensionUri,
    uid,
    paginator,
    fetchColumns,
    loadColumnProperties,
  );
}
