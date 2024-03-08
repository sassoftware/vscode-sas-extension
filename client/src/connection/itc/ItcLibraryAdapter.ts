// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ChildProcessWithoutNullStreams } from "child_process";

import { profileConfig } from "../../commands/profile";
import {
  LibraryAdapter,
  LibraryItem,
  TableData,
} from "../../components/LibraryNavigator/types";
import { ConnectionType } from "../../components/profile";
import { ColumnCollection, TableInfo } from "../rest/api/compute";
import PasswordStore from "./PasswordStore";
import { ITCProtocol } from "./types";
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
    const password = await this.passwordStore.fetchPassword();
    this.shellProcess = spawnPowershellProcess(
      this.onWriteComplete,
      this.onStdOutput,
      this.onStdError,
    );

    runSetup(this.shellProcess, config, password, this.onWriteComplete);
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

  protected async runCode(code: string, startTag: string, endTag: string) {
    const results = await new Promise<string>((resolve, reject) => {
      this.pollingForLogResults = true;
      this.shellProcess.stdin.write(
        `$code=\n@'\n${code}\n'@\n$runner.Run($code)\n`,
        async (error) => {
          if (error) {
            return reject(error);
          }

          const response = await this.pollUntilEnd(startTag, endTag);
          resolve(response);
        },
      );
    });

    return results;
  }

  protected async pollUntilEnd(
    startTag: string,
    endTag: string,
  ): Promise<string> {
    this.log = [];
    this.endTag = endTag;
    this.outputFinished = false;
    await this.fetchLog();

    return await new Promise<string>((resolve) => {
      if (resultInterval) {
        clearInterval(resultInterval);
      }
      resultInterval = setInterval(() => {
        if (this.outputFinished) {
          const logText = this.log.join("");
          resolve(
            logText
              .slice(logText.lastIndexOf(startTag))
              .replace(startTag, "")
              .replace(endTag, ""),
          );
          clearInterval(resultInterval);
        }
      }, 100);
    });
  }

  protected onWriteComplete = (error: Error) => {
    this.pollingForLogResults = false;
    console.log(error);
  };

  protected onStdError = (data: Buffer) => {
    console.log(data.toString());
  };

  protected onStdOutput = (data: Buffer) => {
    const line = data.toString();
    this.log.push(line);
    if (this.endTag && line.includes(this.endTag)) {
      this.outputFinished = true;
    }
  };

  private fetchLog = async (): Promise<void> => {
    const pollingInterval = setInterval(() => {
      if (!this.pollingForLogResults) {
        clearInterval(pollingInterval);
      }
      this.shellProcess.stdin.write(
        `
  do {
    $chunkSize = 32768
    $log = $runner.FlushLog($chunkSize)
    Write-Host $log
  } while ($log.Length -gt 0)\n
    `,
        this.onWriteComplete,
      );
    }, 2 * 1000);
  };
}

export default ItcLibraryAdapter;
