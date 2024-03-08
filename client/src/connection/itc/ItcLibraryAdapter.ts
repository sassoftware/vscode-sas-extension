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

  public async getColumns(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<ColumnCollection> {
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
      count: columns.length,
    };
  }

  public async getLibraries(
    start: number,
    limit: number,
  ): Promise<{
    items: LibraryItem[];
    count: number;
    containsAllResults?: boolean;
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
      count: libraries.length,
      containsAllResults: true,
    };
  }

  public async getRows(
    item: LibraryItem,
    start: number,
    limit: number,
  ): Promise<TableData> {
    const code = `
      options nonotes nosource;
      %put <TABLEDATA>;
      data _null_;
        set ${item.library}.${item.name};
        if ${start + 1} <= _N_ <= ${limit + 1} then put _all_;
      run;
      %put </TABLEDATA>;
    `;

    const output = await this.runCode(code, "<TABLEDATA>", "</TABLEDATA>");
    const lines = output.replace(/\n|\t/gm, "").split(/_N_=\d+/);

    const rows = lines
      .filter((line) => line.trim())
      .map((line): TableRow => {
        const keyValues = line.split(/([a-zA-Z_]+=)/g);
        const rowData = [];
        keyValues.forEach((value, index) => {
          if (
            /.*=$/.test(value) &&
            keyValues[index + 1] &&
            value !== "_ERROR_="
          ) {
            rowData.push(keyValues[index + 1].trim());
          }
        });

        return { cells: rowData };
      });

    return {
      rows: rows,
      // @TOOD Should this be total count?
      count: rows.length,
    };
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
  ): Promise<{
    items: LibraryItem[];
    count: number;
    containsAllResults?: boolean;
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
        id: `${item.name!}.${table}`,
        name: table,
        library: item.name,
        readOnly: item.readOnly,
      };
    });

    return { items: tables, count: tables.length, containsAllResults: true };
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

export default ItcLibraryAdapter;
