// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { SortModelItem } from "ag-grid-community";

import { Column, TableInfo } from "../../connection/rest/api/compute";

/**
 * table column enriched with the SAS format category (date, datetime, time, curr, num,
 * char, ...) reported by the connected SAS instance. Empty when it could not be determined.
 */
export interface TableColumn extends Column {
  formatCategory?: string;
}

export interface TableColumnCollection {
  count?: number;
  items: TableColumn[];
}

export const LibraryType = "library";
export const TableType = "table";
export type LibraryItemType = "library" | "table";
export interface LibraryItem {
  uid: string;
  id: string;
  name: string;
  type: LibraryItemType;
  library?: string;
  readOnly: boolean;
}

export interface TableRow {
  cells?: string[];
  columns?: string[];
}

export interface TableData {
  rows: TableRow[];
  count: number;
}

export interface TableQuery {
  filterValue: string;
}

export interface LibraryAdapter {
  connect(): Promise<void>;
  deleteTable(item: LibraryItem): Promise<void>;
  getColumns(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<TableColumnCollection>;
  getLibraries(
    start: number,
    limit: number,
  ): Promise<{
    items: LibraryItem[];
    count: number;
  }>;
  getRows(
    item: LibraryItem,
    start: number,
    limit: number,
    sortModel: SortModelItem[],
    query: TableQuery | undefined,
  ): Promise<TableData>;
  getRowsAsCSV(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<TableData>;
  getTableRowCount(
    item: LibraryItem,
  ): Promise<{ rowCount: number; maxNumberOfRowsToRead: number }>;
  getTables(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<{
    items: LibraryItem[];
    count: number;
  }>;
  getTableInfo?(item: LibraryItem): Promise<TableInfo>;
  setup(): Promise<void>;
}
