// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ChildProcessWithoutNullStreams } from "child_process";
import { v4 } from "uuid";

import { profileConfig } from "../../commands/profile";
import {
  LibraryAdapter,
  LibraryItem,
  TableData,
  TableRow,
} from "../../components/LibraryNavigator/types";
import { ConnectionType } from "../../components/profile";
import { Column, ColumnCollection, TableInfo } from "../rest/api/compute";
import CodeRunner from "./CodeRunner";
import PasswordStore from "./PasswordStore";
import { Config, ITCProtocol } from "./types";
import { defaultSessionConfig, runSetup, spawnPowershellProcess } from "./util";

class ItcLibraryAdapter implements LibraryAdapter {
  protected hasEstablishedConnection: boolean = false;
  protected shellProcess: ChildProcessWithoutNullStreams;
  protected passwordStore: PasswordStore = new PasswordStore();
  protected pollingForLogResults: boolean = false;
  protected log: string[] = [];
  protected endTag: string = "";
  protected outputFinished: boolean = false;
  protected codeRunners: Record<string, CodeRunner> = {};
  protected config: Config;

  public async connect(): Promise<void> {
    this.hasEstablishedConnection = true;

    const activeProfile = profileConfig.getProfileByName(
      profileConfig.getActiveProfile(),
    );
    const protocol =
      activeProfile.connectionType === ConnectionType.COM
        ? ITCProtocol.COM
        : ITCProtocol.IOMBridge;
    const config = {
      ...defaultSessionConfig(protocol),
      ...activeProfile,
    };
    this.passwordStore.updatePasswordKey(
      `${config.host}${config.protocol}${config.username}`,
    );
    this.config = config;

    await this.passwordStore.fetchPassword();
  }

  public async setup(): Promise<void> {
    if (this.hasEstablishedConnection) {
      return;
    }

    await this.connect();
  }

  deleteTable(item: LibraryItem): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async getColumns(item: LibraryItem): Promise<ColumnCollection> {
    const sql = `
      proc sql;
        select catx(',',name, type, varnum) as column into: OUTPUT separated by '~'
        from sashelp.vcolumn
        where libname='${item.library}' and memname='${item.name}'
        order by varnum;
      quit;
      %put <COLOUTPUT>; %put &OUTPUT; %put </COLOUTPUT>;
    `;

    const columnLines = processQueryRows(
      await this.runCode(sql, "<COLOUTPUT>", "</COLOUTPUT>"),
    );
    const columns = columnLines.map((lineText): Column => {
      const [name, type, index] = lineText.split(",");

      return {
        name,
        type,
        index: parseInt(index, 10),
      };
    });

    return {
      items: columns,
      count: -1,
    };
  }

  public async getLibraries(): Promise<{
    items: LibraryItem[];
    count: number;
  }> {
    const sql = `
      proc sql;
        select catx(',', libname, readonly) as libname_target into: OUTPUT separated by '~'
        from sashelp.vlibnam order by libname asc;
      quit;
      %put <LIBOUTPUT>; %put &OUTPUT; %put </LIBOUTPUT>;
    `;

    const libNames = processQueryRows(
      await this.runCode(sql, "<LIBOUTPUT>", "</LIBOUTPUT>"),
    );
    libNames.sort();
    const libraries = libNames.map((lineText): LibraryItem => {
      const [libName, readOnlyValue] = lineText.split(",");

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

  private async getDatasetInformation(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<{ rows: string[]; count: number }> {
    const tempTable = `${item.name}${hms()}`;
    const code = `
      options nonotes nosource nodate nonumber;
      %put <TABLEDATA>;
      proc sql;
        SELECT COUNT(1) into: COUNT FROM  ${item.library}.${item.name};
      quit;
      %put <Count>&COUNT</Count>;
      data work.${tempTable};
        set ${item.library}.${item.name};
        if ${start + 1} <= _N_ <= ${start + limit} then output;
      run;

      filename out temp;
      proc json out=out; export work.${tempTable}; run;

      data _null_; infile out; input; put _infile_; %put </TABLEDATA>; run;
      proc datasets library=work nolist nodetails; delete ${tempTable}; run;
    `;

    let output = await this.runCode(code, "<TABLEDATA>", "</TABLEDATA>");

    // Extract result count
    const countRegex = /<Count>(.*)<\/Count>/;
    const countMatches = output.match(countRegex);
    const count = parseInt(countMatches[1].replace(/\s|\n/gm, ""), 10);
    output = output.replace(countRegex, "");

    const rows = output.replace(/\n|\t/gm, "");
    const tableData = JSON.parse(rows);

    return { rows: tableData[`SASTableData+${tempTable}`], count };
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
      const rowData = [`${start + idx + 1}`].concat(Object.values(line));
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
            columns: (await this.getColumns(item)).items.map(
              (column) => column.name,
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
      options nonotes nosource nodate nonumber;
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
    const sql = `
      proc sql;
        select memname into: OUTPUT separated by '~'
        from sashelp.vtable
        where libname='${item.name!}'
        order by memname asc;
      quit;
      %put <TABLEOUTPUT>; %put &OUTPUT; %put </TABLEOUTPUT>;
    `;

    const tableNames = processQueryRows(
      await this.runCode(sql, "<TABLEOUTPUT>", "</TABLEOUTPUT>"),
    );
    tableNames.sort();
    const tables = tableNames.map((lineText): LibraryItem => {
      const [table] = lineText.split(",");

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

  protected async runCode(
    code: string,
    startTag: string,
    endTag: string,
  ): Promise<string> {
    const processId = v4();
    this.codeRunners[processId] = new CodeRunner(
      processId,
      (processId: string) => delete this.codeRunners[processId],
    );

    return await this.codeRunners[processId].runCode(
      code,
      startTag,
      endTag,
      this.config,
      this.passwordStore.fetchInMemoryPassword(),
    );
  }
}

const processQueryRows = (response: string): string[] => {
  const items = response
    .trim()
    .replace(/\n|\t/gm, "")
    .split("~")
    .filter((value, index, array) => array.indexOf(value) === index);

  return items;
};

const hms = () => {
  const date = new Date();
  return `${date.getHours()}${date.getMinutes()}${date.getSeconds()}`;
};

export default ItcLibraryAdapter;
