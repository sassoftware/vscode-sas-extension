// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { SortModelItem } from "ag-grid-community";
import { ChildProcessWithoutNullStreams } from "child_process";

import { onRunError } from "../../commands/run";
import {
  LibraryAdapter,
  LibraryItem,
  TableColumn,
  TableColumnCollection,
  TableData,
  TableQuery,
  TableRow,
} from "../../components/LibraryNavigator/types";
import { baseFormatName } from "../../panels/columnIconClassifier";
import { FormatCategoryCache } from "../formatCategory";
import { TableInfo } from "../rest/api/compute";
import { executeRawCode, runCode } from "./CodeRunner";
import type { Config } from "./types";
import { sanitizePowershellString } from "./util";

const formatCategoryStartTag = "<FormatCategories>";
const formatCategoryEndTag = "</FormatCategories>";

class ItcLibraryAdapter implements LibraryAdapter {
  protected hasEstablishedConnection: boolean = false;
  protected shellProcess: ChildProcessWithoutNullStreams | undefined;
  protected pollingForLogResults: boolean = false;
  protected log: string[] = [];
  protected endTag: string = "";
  protected outputFinished: boolean = false;
  protected config: Config | undefined;
  protected formatCategories: FormatCategoryCache = new FormatCategoryCache(
    (formatNames) => this.fetchFormatCategories(formatNames),
  );

  public constructor(private readonly onConnect?: () => void) {}

  public async connect(): Promise<void> {
    this.hasEstablishedConnection = true;
    this.formatCategories.clear();
    if (this.onConnect) {
      this.onConnect();
    }
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

  public async getColumns(item: LibraryItem): Promise<TableColumnCollection> {
    const code = `
      $runner.GetColumns("${item.library}", "${item.name}")
    `;
    const output = await executeRawCode(code);
    const rawColumns: TableColumn[] = JSON.parse(output);
    const categories = await this.formatCategories.resolve(
      rawColumns.map((column) => column.format),
    );
    const columns = rawColumns.map((column: TableColumn) => ({
      ...column,
      formatCategory: categories.get(baseFormatName(column.format)) ?? "",
    }));
    return {
      items: columns,
      count: -1,
    };
  }

  // SAS 9 categories are read from fmtinfo, which is
  // the same source the Compute service uses.
  protected async fetchFormatCategories(
    formatNames: string[],
  ): Promise<Record<string, string>> {
    const nameList = formatNames
      .map((name) => `'${name.replace(/'/g, "''")}'`)
      .join(",");
    const code = `
      data _null_;
        length _fmtName_ $32 _fmtCategory_ $32 _fmtLine_ $70;
        put "${formatCategoryStartTag}";
        do _fmtName_ = ${nameList};
          _fmtCategory_ = fmtinfo(strip(_fmtName_), 'CAT');
          _fmtLine_ = cats('[', _fmtName_, '=', _fmtCategory_, ']');
          put _fmtLine_;
        end;
        put "${formatCategoryEndTag}";
      run;
    `;

    const output = await this.runCode(
      code,
      formatCategoryStartTag,
      formatCategoryEndTag,
    );

    // The log lines are concatenated without separators, so each entry is bracketed.
    const entryPattern = /\[([^[\]=]*)=([^[\]]*)\]/g;
    const requested = new Set(formatNames);
    const categories: Record<string, string> = {};
    let entry: RegExpExecArray | null;
    while ((entry = entryPattern.exec(output)) !== null) {
      const [, name, category] = entry;
      if (requested.has(name)) {
        categories[name] = category;
      }
    }
    return categories;
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
    query: TableQuery | undefined,
  ): Promise<TableData> {
    const { rows: rawRowValues, count } = await this.getDatasetInformation(
      item,
      start,
      limit,
      sortModel,
      query,
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
              (await this.getColumns(item)).items.flatMap((column) =>
                column.name ? [column.name] : [],
              ),
            ),
          }
        : {};

    const { rows } = await this.getRows(item, start, limit, [], undefined);

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
    query: TableQuery | undefined,
  ): Promise<{ rows: Array<string[]>; count: number }> {
    const sortString = sortModel
      .map((col) => `${col.colId} ${col.sort}`)
      .join(",");
    const escapedQuery = sanitizePowershellString(query);
    const code = `
      $runner.GetDatasetRecords("${item.library}","${item.name}", ${start}, ${limit}, "${sortString}", '${escapedQuery}')
    `;
    const output = await executeRawCode(code);
    try {
      if (output.includes("<ITCError>")) {
        return { rows: [], count: 0 };
      }
      return JSON.parse(output);
    } catch (e) {
      console.warn("Failed to load table data with error", e);
      console.warn("Raw output", output);
      return { rows: [], count: 0 };
    }
  }

  public async getTableInfo(item: LibraryItem): Promise<TableInfo> {
    const basicInfo: TableInfo = {
      bookmarkLength: 0, // Not available in vtable
      columnCount: 0,
      compressionRoutine: "",
      creationTimeStamp: "",
      encoding: "",
      engine: "",
      extendedType: "",
      label: "",
      libref: item.library,
      logicalRecordCount: 0,
      modifiedTimeStamp: "",
      name: item.name,
      physicalRecordCount: 0,
      recordLength: 0,
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
        encoding: tableInfo.encoding || basicInfo.encoding,
        engine: tableInfo.engine || basicInfo.engine,
        extendedType: tableInfo.extendedType || basicInfo.extendedType,
        label: tableInfo.label || basicInfo.label,
        libref: tableInfo.libref || basicInfo.libref,
        logicalRecordCount: tableInfo.rowCount || basicInfo.logicalRecordCount,
        modifiedTimeStamp:
          tableInfo.modifiedTimeStamp || basicInfo.modifiedTimeStamp,
        name: tableInfo.name || basicInfo.name,
        physicalRecordCount:
          tableInfo.rowCount || basicInfo.physicalRecordCount,
        recordLength: tableInfo.recordLength || basicInfo.recordLength,
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
