// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  LibraryAdapter,
  LibraryItem,
  TableData,
} from "../../components/LibraryNavigator/types";
import { ColumnCollection, TableInfo } from "../rest/api/compute";

// NOTE: THIS NEEDS TO BE REMOVED
/* eslint-disable @typescript-eslint/no-unused-vars */
class ItcLibraryAdapter implements LibraryAdapter {
  public async connect(): Promise<void> {
    return;
  }
  public async setup(): Promise<void> {
    return;
  }
  deleteTable(item: LibraryItem): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getColumns(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<ColumnCollection> {
    throw new Error("Method not implemented.");
  }
  public async getLibraries(
    start: number,
    limit: number,
  ): Promise<{ items: LibraryItem[]; count: number }> {
    return {
      items: [
        {
          uid: "asdfasdfasdf",
          id: "asdfasdfasdf",
          name: "Potato",
          type: "library",
          readOnly: true,
        },
      ],
      count: 1,
    };
  }
  getRows(item: LibraryItem, start: number, limit: number): Promise<TableData> {
    throw new Error("Method not implemented.");
  }
  getRowsAsCSV(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<TableData> {
    throw new Error("Method not implemented.");
  }
  getTable(item: LibraryItem): Promise<TableInfo> {
    throw new Error("Method not implemented.");
  }
  public async getTables(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<{ items: LibraryItem[]; count: number }> {
    return { items: [], count: 0 };
  }
}

export default ItcLibraryAdapter;
