// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

import { ChildProcessWithoutNullStreams } from "child_process";

import { onRunError } from "../../commands/run";
import {
  LibraryAdapter,
  LibraryItem,
  TableData,
  TableRow,
} from "../../components/LibraryNavigator/types";
import { ColumnCollection } from "../rest/api/compute";
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
    const columns = JSON.parse(output).map((column) => ({
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
  ): Promise<TableData> {
    const { rows: rawRowValues, count } = await this.getDatasetInformation(
      item,
      start,
      limit,
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

    const { rows } = await this.getRows(item, start, limit);

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
  ): Promise<{ rows: Array<string[]>; count: number }> {
    const fullTableName = `${item.library}.${item.name}`;
    const code = `
      $runner.GetDatasetRecords("${fullTableName}", ${start}, ${limit})
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

const processQueryRows = (response: string): string[] => {
  const processedResponse = response.trim().replace(/\n|\t/gm, "");
  if (!processedResponse) {
    return [];
  }

  return processedResponse
    .split("~")
    .filter((value, index, array) => array.indexOf(value) === index);
};

export default ItcLibraryAdapter;
