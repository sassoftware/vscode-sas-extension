// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

import type { SortModelItem } from "ag-grid-community";
import { ChildProcessWithoutNullStreams } from "child_process";

import { onRunError } from "../../commands/run";
import {
  LibraryAdapter,
  LibraryItem,
  TableData,
  TableRow,
} from "../../components/LibraryNavigator/types";
import { ColumnCollection, TableInfo } from "../rest/api/compute";
import { getColumnIconType } from "../util";
import { executeRawCode, runCode } from "./CodeRunner";
import { Config } from "./types";

class ItcLibraryAdapter implements LibraryAdapter {
  protected hasEstablishedConnection: boolean = false;
  protected shellProcess: ChildProcessWithoutNullStreams;
  protected pollingForLogResults: boolean = false;
  protected log: string[] = [];
  protected endTag: string = "";
  protected outputFinished: boolean = false;
  protected config: Config;

  public async connect(): Promise<void> {
    this.hasEstablishedConnection = true;
  }

  public async setup(): Promise<void> {
    if (this.hasEstablishedConnection) {
      return;
    }

    await this.connect();
  }

  public async deleteTable(item: LibraryItem): Promise<void> {
    const code = `
      proc datasets library=${item.library} nolist nodetails; delete ${item.name}; run;
    `;

    await this.runCode(code);
  }

  public async getColumns(item: LibraryItem): Promise<ColumnCollection> {
    const code = `
      $runner.GetColumns("${item.library}", "${item.name}")
    `;
    const output = await executeRawCode(code);
    const rawColumns = JSON.parse(output);
    const columns = rawColumns.map((column) => ({
      ...column,
      type: getColumnIconType(column),
    }));
    return {
      items: columns,
      count: -1,
    };
  }
  public async getLibraries(): Promise<{
    items: LibraryItem[];
    count: number;
  }> {
    const code = `
      $runner.GetLibraries()
    `;

    const output = await executeRawCode(code);
    const rawLibraries = JSON.parse(output).libraries;

    const libraries = rawLibraries.map((row: string[]) => {
      const [libName, readOnlyValue] = row;
      return {
        type: "library",
        uid: libName,
        id: libName,
        name: libName,
        readOnly: readOnlyValue === "yes",
      };
    });

    return {
      items: libraries,
      count: -1,
    };
  }

  public async getRows(
    item: LibraryItem,
    start: number,
    limit: number,
    sortModel: SortModelItem[],
  ): Promise<TableData> {
    const { rows: rawRowValues, count } = await this.getDatasetInformation(
      item,
      start,
      limit,
      sortModel,
    );

    const rows = rawRowValues.map((line, idx: number): TableRow => {
      const rowData = [`${start + idx + 1}`].concat(line);
      return { cells: rowData };
    });

    return {
      rows,
      count,
    };
  }

  public async getRowsAsCSV(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<TableData> {
    // We only need the columns for the first page of results
    const columns =
      start === 0
        ? {
            columns: ["INDEX"].concat(
              (await this.getColumns(item)).items.map((column) => column.name),
            ),
          }
        : {};

    const { rows } = await this.getRows(item, start, limit, []);

    rows.unshift(columns);
    // Fetching csv doesn't rely on count. Instead, we get the count
    // upfront via getTableRowCount
    return { rows, count: -1 };
  }

  public async getTableRowCount(
    item: LibraryItem,
  ): Promise<{ rowCount: number; maxNumberOfRowsToRead: number }> {
    const code = `
      proc sql;
        SELECT COUNT(1) into: COUNT FROM  ${item.library}.${item.name};
      quit;
      %put <Count>&COUNT</Count>;
    `;

    const output = await this.runCode(code, "<Count>", "</Count>");
    const rowCount = parseInt(output.replace(/[^0-9]/g, ""), 10);

    return { rowCount, maxNumberOfRowsToRead: 100 };
  }

  public async getTables(item: LibraryItem): Promise<{
    items: LibraryItem[];
    count: number;
  }> {
    const code = `
      $runner.GetTables("${item.name}")
    `;

    const output = await executeRawCode(code);
    const rawTables = JSON.parse(output).tables;
    const tables = rawTables.map((table: string): LibraryItem => {
      return {
        type: "table",
        uid: `${item.name!}.${table}`,
        id: table,
        name: table,
        library: item.name,
        readOnly: item.readOnly,
      };
    });

    return { items: tables, count: -1 };
  }

  protected async getDatasetInformation(
    item: LibraryItem,
    start: number,
    limit: number,
    sortModel: SortModelItem[],
  ): Promise<{ rows: Array<string[]>; count: number }> {
    const sortString = sortModel
      .map((col) => `${col.colId} ${col.sort}`)
      .join(",");
    const code = `
      $runner.GetDatasetRecords("${item.library}","${item.name}", ${start}, ${limit}, "${sortString}")
    `;
    const output = await executeRawCode(code);
    try {
      return JSON.parse(output);
    } catch (e) {
      console.warn("Failed to load table data with error", e);
      console.warn("Raw output", output);
      throw new Error(
        l10n.t(
          "An error was encountered when loading table data. This usually happens when a table is too large or the data couldn't be processed. See console for more details.",
        ),
      );
    }
  }

  public async getTableInfo(item: LibraryItem): Promise<TableInfo> {
    const basicInfo: TableInfo = {
      bookmarkLength: 0, // Not available in vtable
      columnCount: 0,
      compressionRoutine: "",
      creationTimeStamp: "",
      encoding: "", // Not available in vtable
      engine: "", // Not available in sashelp.vtable for SAS 9.4
      extendedType: "",
      label: "",
      libref: item.library,
      logicalRecordCount: 0,
      modifiedTimeStamp: "",
      name: item.name,
      physicalRecordCount: 0,
      recordLength: 0, // Not available in vtable
      rowCount: 0,
      type: "DATA",
    };

    try {
      // Use the PowerShell GetTableInfo function which queries sashelp.vtable
      const code = `
        $runner.GetTableInfo("${item.library}", "${item.name}")
      `;
      const output = await executeRawCode(code);
      const tableInfo = JSON.parse(output);

      return {
        ...basicInfo,
        columnCount: tableInfo.columnCount || basicInfo.columnCount,
        compressionRoutine:
          tableInfo.compressionRoutine || basicInfo.compressionRoutine,
        creationTimeStamp:
          tableInfo.creationTimeStamp || basicInfo.creationTimeStamp,
        extendedType: tableInfo.extendedType || basicInfo.extendedType,
        label: tableInfo.label || basicInfo.label,
        libref: tableInfo.libref || basicInfo.libref,
        logicalRecordCount: tableInfo.rowCount || basicInfo.logicalRecordCount,
        modifiedTimeStamp:
          tableInfo.modifiedTimeStamp || basicInfo.modifiedTimeStamp,
        name: tableInfo.name || basicInfo.name,
        physicalRecordCount:
          tableInfo.rowCount || basicInfo.physicalRecordCount,
        rowCount: tableInfo.rowCount || basicInfo.rowCount,
        type: tableInfo.type || basicInfo.type,
      };
    } catch (error) {
      console.warn("Failed to get table info:", error);
      // If anything fails, return basic info
      return basicInfo;
    }
  }

  protected async executionHandler(
    callback: () => Promise<string>,
  ): Promise<string> {
    try {
      return await callback();
    } catch (e) {
      onRunError(e);
      return "";
    }
  }

  protected async runCode(
    code: string,
    startTag: string = "",
    endTag: string = "",
  ): Promise<string> {
    return this.executionHandler(() => runCode(code, startTag, endTag));
  }

  protected async executeRawCode(code: string): Promise<string> {
    return this.executionHandler(() => executeRawCode(code));
  }
}

export default ItcLibraryAdapter;
