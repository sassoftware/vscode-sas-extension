// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

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
  cells: string[];
}

export interface TableData {
  rows: TableRow[];
  count: number;
}
