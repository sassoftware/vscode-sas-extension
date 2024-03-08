// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ChildProcessWithoutNullStreams } from "child_process";
import { v4 } from "uuid";

import { profileConfig } from "../../commands/profile";
import {
  LibraryAdapter,
  LibraryItem,
  TableData,
} from "../../components/LibraryNavigator/types";
import { ConnectionType } from "../../components/profile";
import { ColumnCollection, TableInfo } from "../rest/api/compute";
import CodeRunner from "./CodeRunner";
import PasswordStore from "./PasswordStore";
import { Config, ITCProtocol } from "./types";
import { defaultSessionConfig, runSetup, spawnPowershellProcess } from "./util";

// NOTE: THIS NEEDS TO BE REMOVED
/* eslint-disable @typescript-eslint/no-unused-vars */
let resultInterval = null;
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
    const sql = `
      proc sql;
        select catx(',', libname, readonly) as libname_target into: OUTPUT separated by '~'
        from sashelp.vlibnam order by libname asc;
      quit;
      %put <LIBOUTPUT>; %put &OUTPUT; %put </LIBOUTPUT>;
    `;

    const response = await this.runCode(sql, "<LIBOUTPUT>", "</LIBOUTPUT>");

    const libNames = response
      .trim()
      .replace(/\n|\t/gm, "")
      .split("~")
      .filter((value, index, array) => array.indexOf(value) === index);
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

    return { items: libraries, count: libraries.length };
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

export default ItcLibraryAdapter;
