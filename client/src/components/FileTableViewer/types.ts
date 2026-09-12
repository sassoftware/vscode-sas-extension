// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Shared shape for any file-backed table source. The DataViewer panel
// already speaks to a `PaginatedResultSet` and an async column fetch;
// this module just produces those two callbacks from a parsed file.
import type { SortModelItem } from "ag-grid-community";

import type { Column } from "../../connection/rest/api/compute";
import type { TableData, TableQuery } from "../LibraryNavigator/types";

export interface FileTableSource {
  /** Display title for the panel — usually the file's basename. */
  title: string;
  /** Stable id used as the webview-panel uid. */
  uid: string;
  /** SAS-shaped column descriptors. */
  columns: Column[];
  /** Total row count in the underlying dataset. */
  rowCount: number;
  /** Returns rows for the inclusive range [start, end].
   *
   *  Each `TableRow.cells` array MUST start with a placeholder index
   *  cell — the panel strips index 0 before forwarding to the webview.
   *  We provide an empty string. */
  getRows(
    start: number,
    end: number,
    sort: SortModelItem[],
    query: TableQuery | undefined,
  ): Promise<TableData>;
}
