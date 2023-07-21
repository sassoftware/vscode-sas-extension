// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import { BaseConfig, RunResult } from "..";
import { scriptContent } from "./script";
import { Session } from "../session";

const endCode = "--vscode-sas-extension-submit-end--";
let sessionInstance: COMSession;

/**
 * Configuration parameters for this connection provider
 */
export interface Config extends BaseConfig {
  host: string;
}

export class COMSession extends Session {
  private _config: Config;
  private _shellProcess: ChildProcessWithoutNullStreams;
  private _html5FileName: string;
  private _runResolve: ((value?) => void) | undefined;
  private _runReject: ((reason?) => void) | undefined;
  private _workDirectory: string;

  constructor() {
    super();
  }

  public set config(value: Config) {
    this._config = value;
  }

  /**
   * Initialization logic that should be performed prior to execution.
   * @returns void promise.
   */
  public setup = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      this._runResolve = resolve;
      this._runReject = reject;

      if (this._shellProcess && !this._shellProcess.killed) {
        resolve();
        return; //manually terminate to avoid executing the code below
      }

      this._shellProcess = spawn("powershell.exe /nologo -Command -", {
        shell: true,
        env: process.env,
      });
      this._shellProcess.stdout.on("data", this.onShellStdOut);
      this._shellProcess.stderr.on("data", this.onShellStdErr);
      this._shellProcess.stdin.write(
        scriptContent + "\n",
        this.onWriteComplete,
      );
      this._shellProcess.stdin.write(
        "$runner = New-Object -TypeName SASRunner\n",
        this.onWriteComplete,
      );

      /*
    There are cases where the higher level run command will invoke setup multiple times.
    Avoid re-initializing the session when this happens. In a first run scenario a work dir
    will not exist. The work dir should only be deleted when close is invoked.
    */
      if (!this._workDirectory) {
        this._shellProcess.stdin.write(
          `$profileHost = "${this._config.host}"\n`,
        );
        this._shellProcess.stdin.write(
          "$runner.Setup($profileHost)\n",
          this.onWriteComplete,
        );
        this._shellProcess.stdin.write(
          "$runner.ResolveSystemVars()\n",
          this.onWriteComplete,
        );

        if (this._config.sasOptions?.length > 0) {
          const sasOptsInput = `$sasOpts=${this.formatSASOptions(
            this._config.sasOptions,
          )}\n`;
          this._shellProcess.stdin.write(sasOptsInput, this.onWriteComplete);
          this._shellProcess.stdin.write(
            `$runner.SetOptions($sasOpts)\n`,
            this.onWriteComplete,
          );
        }
      }

      // free objects in the scripting env
      process.on("exit", async () => {
        close();
      });
    });
  };

  /**
   * Executes the given input code.
   * @param code A string of SAS code to execute.
   * @param onLog A callback handler responsible for marshalling log lines back to the higher level extension API.
   * @returns A promise that eventually resolves to contain the given {@link RunResult} for the input code execution.
   */
  public run = async (code: string): Promise<RunResult> => {
    return new Promise((resolve, reject) => {
      this._runResolve = resolve;
      this._runReject = reject;

      //write ODS output to work so that the session cleans up after itself
      const codeWithODSPath = code.replace(
        "ods html5;",
        `ods html5 path="${this._workDirectory}";`,
      );

      //write an end mnemonic so that the handler knows when execution has finished
      const codeWithEnd = `${codeWithODSPath}\n%put ${endCode};`;
      const codeToRun = `$code=@"\n${codeWithEnd}\n"@\n`;

      this._shellProcess.stdin.write(codeToRun);
      this._shellProcess.stdin.write(`$runner.Run($code)\n`, async (error) => {
        if (error) {
          this._runReject(error);
        }

        await this.fetchLog();
      });
    });
  };

  /**
   * Cleans up resources for the given local SAS session.
   * @returns void promise.
   */
  public close = async (): Promise<void> => {
    return new Promise((resolve) => {
      if (this._shellProcess) {
        this._shellProcess.stdin.write(
          "$runner.Close()\n",
          this.onWriteComplete,
        );
        this._shellProcess.kill();
        this._shellProcess = undefined;

        this._workDirectory = undefined;
        this._runReject = undefined;
        this._runResolve = undefined;
      }
      resolve();
    });
  };

  /**
   * Formats the SAS Options provided in the profile into a format
   * that the shell process can understand.
   * @param sasOptions SAS Options array from the connection profile.
   * @returns a string  denoting powershell syntax for an array literal.
   */
  private formatSASOptions = (sasOptions: string[]): string => {
    const optionsVariable = `@("${sasOptions.join(`","`)}")`;
    return optionsVariable;
  };

  /**
   * Flushes the SAS log in chunks of [chunkSize] length,
   * writing each chunk to stdout.
   */
  private fetchLog = async (): Promise<void> => {
    this._shellProcess.stdin.write(
      `
do {
  $chunkSize = 32768
  $log = $runner.FlushLog($chunkSize)
  Write-Host $log
} while ($log.Length -gt 0)\n
  `,
      this.onWriteComplete,
    );
  };

  /**
   * Handles stderr output from the powershell child process.
   * @param chunk a buffer of stderr output from the child process.
   */
  private onShellStdErr = (chunk: Buffer): void => {
    const msg = chunk.toString();
    console.warn("shellProcess stderr: " + msg);
    this._runReject(
      new Error(
        "There was an error executing the SAS Program.\nSee console log for more details.",
      ),
    );
  };

  /**
   * Handles stdout output from the powershell child process.
   * @param data a buffer of stdout output from the child process.
   */
  private onShellStdOut = (data: Buffer): void => {
    const output = data.toString().trimEnd();
    const outputLines = output.split(/\n|\r\n/);
    if (this._onLogFn) {
      outputLines.forEach((line: string) => {
        if (!line) {
          return;
        }
        if (line.startsWith("WORKDIR=")) {
          const parts = line.split("WORKDIR=");
          this._workDirectory = parts[1].trim();
          this._runResolve();
          return;
        }
        if (line.endsWith(endCode)) {
          // run completed
          this.fetchResults();
        } else {
          this._html5FileName =
            line.match(/NOTE: .+ HTML5.* Body .+: (.+)\.htm/)?.[1] ??
            this._html5FileName;
          this._onLogFn?.([{ type: "normal", line }]);
        }
      });
    }
  };

  /**
   * Generic call for use on stdin write completion.
   * @param err The error encountered on the write attempt. Undefined if no error occurred.
   */
  private onWriteComplete = (err: Error): void => {
    if (err) {
      this._runReject?.(err);
    }
  };

  /**
   * Not implemented.
   */
  public sessionId = (): string => {
    throw new Error("Not Implemented");
  };

  /**
   * Fetches the ODS output results for the latest html results file.
   */
  private fetchResults = () => {
    const htmlResults = readFileSync(
      resolve(this._workDirectory, this._html5FileName + ".htm"),
      { encoding: "utf-8" },
    );
    const runResult: RunResult = { html5: htmlResults, title: "Results" };
    this._runResolve(runResult);
  };
}

/**
 * Creates a new SAS 9 Local Session.
 * @param c Instance denoting configuration parameters for this connection profile.
 * @returns  created COM session.
 */
export const getSession = (c: Config): Session => {
  if (!sessionInstance) {
    sessionInstance = new COMSession();
  }
  sessionInstance.config = c;
  return sessionInstance;
};
