// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, workspace } from "vscode";

import { ChildProcessWithoutNullStreams, spawn } from "child_process";

import { BaseConfig, LogLineTypeEnum, RunResult } from "..";
import {
  getGlobalStorageUri
} from "../../components/ExtensionContext";
import { updateStatusBarItem } from "../../components/StatusBarItem";
import { extractOutputHtmlFileName, wrapCodeWithOutputHtml } from "../../components/utils/sasCode";
import { Session } from "../session";
// import { scriptContent } from "./script";
import { LineCodes } from "./types";

const LogLineTypes: LogLineTypeEnum[] = [
  "normal",
  "hilighted",
  "source",
  "title",
  "byline",
  "footnote",
  "error",
  "warning",
  "note",
  "message",
];

let sessionInstance: SASPYSession;

/**
 * Configuration parameters for this connection provider
 */
export interface Config extends BaseConfig {
  cfgname: string;
  pythonpath: string;
}

export class SASPYSession extends Session {
  private _config: Config;
  private _shellProcess: ChildProcessWithoutNullStreams;
  private _html5FileName: string;
  private _runResolve: ((value?) => void) | undefined;
  private _runReject: ((reason?) => void) | undefined;
  private _workDirectory: string;
  private _pollingForLogResults: boolean;
  private _logLineType = 0;
    
  public set config(value: Config) {
    this._config = value;
  }

  /**
   * Initialization logic that should be performed prior to execution.
   * @returns void promise.
   */
  protected establishConnection = async (): Promise<void> => {
    const setupPromise = new Promise<void>((resolve, reject) => {
      this._runResolve = resolve;
      this._runReject = reject;
    });

    if (this._shellProcess && !this._shellProcess.killed) {
      this._runResolve();
      return; // manually terminate to avoid executing the code below
    }

    this._shellProcess = spawn(
      `${this._config.pythonpath}`,
      ["-i", "-q", "-X utf8"],
      {
        //shell: true,
        // env: process.env,
        env: {
            ...process.env,
            //PATH: process.env.PATH + require('path').delimiter + __dirname,
            PYTHONIOENCODING: "utf-8"
        }
      },
    );
    this._shellProcess.stdout.on("data", this.onShellStdOut);
    this._shellProcess.stderr.on("data", this.onShellStdErr);
    const saspyWorkDir = `
%let workDir = %sysfunc(pathname(work));
%put &=workDir;
%let rc = %sysfunc(dlgcdir("&workDir"));
run;
`;
      const saspyWorkDirWithODS = wrapCodeWithOutputHtml(saspyWorkDir);
      const saspyHtmlStyle = saspyWorkDirWithODS.match(/style=([^ ]+) /)?.[1] ?? "Illuminate";

      const cfgname = this._config.cfgname?.length > 0 ? this._config.cfgname : "";
      const scriptContent = `
import saspy

_cfgname = "${cfgname}"

if(not _cfgname):
    try:
        sas
        if sas is None:
            sas = saspy.SASsession(cfgname=_cfgname, results='HTML')
        elif not sas.SASpid:
            sas = saspy.SASsession(cfgname=_cfgname, results='HTML')
    except NameError:
        sas = saspy.SASsession(cfgname=_cfgname, results='HTML')
else:
    try:
        sas
        if sas is None:
            sas = saspy.SASsession(results='HTML')
        elif not sas.SASpid:
            sas = saspy.SASsession(results='HTML')
    except NameError:
        sas = saspy.SASsession(results='HTML')


try:
    sas
except NameError:
    raise Exception("Setup error")

sas.HTML_Style = '${saspyHtmlStyle}'

vscode_saspy_code = r"""
${saspyWorkDir}
"""

ll=sas.submit(vscode_saspy_code)

`;

      this._shellProcess.stdin.write(scriptContent + "\n", this.onWriteComplete);
    // this._shellProcess.stdin.write(
    //   "$runner = New-Object -TypeName SASRunner\n",
    //   this.onWriteComplete,
    // );

    /*
     * There are cases where the higher level run command will invoke setup multiple times.
     * Avoid re-initializing the session when this happens. In a first run scenario a work dir
     * will not exist. The work dir should only be deleted when close is invoked.
     */
    if (!this._workDirectory) {

        this._shellProcess.stdin.write(`sas\n`);

      if (this._config.sasOptions?.length > 0) {
        const sasOptsInput = `$sasOpts=${this.formatSASOptions(
          this._config.sasOptions,
        )}\n`;
        this._shellProcess.stdin.write(sasOptsInput, this.onWriteComplete);
        this._shellProcess.stdin.write(
          `sas.submit($sasOpts)\n`,
          this.onWriteComplete,
        );
      }
    }

    // free objects in the scripting env
    process.on("exit", async () => {
      close();
    });

    return setupPromise;
  };

  /**
   * Executes the given input code.
   * @param code A string of SAS code to execute.
   * @param onLog A callback handler responsible for marshalling log lines back to the higher level extension API.
   * @returns A promise that eventually resolves to contain the given {@link RunResult} for the input code execution.
   */
  public run = async (code: string): Promise<RunResult> => {
    const runPromise = new Promise<RunResult>((resolve, reject) => {
      this._runResolve = resolve;
      this._runReject = reject;
    });

    //write ODS output to work so that the session cleans up after itself
    const codeWithODSPath = code.replace(
      /\bods html5\(id=vscode\)([^;]*;)/i,
      `ods html5(id=vscode) path="${this._workDirectory}"$1`,
    );
    const codeWithODSPath2 = codeWithODSPath.replace(
      /\bods _all_ close;/i,
      ``,
    );

    //write an end mnemonic so that the handler knows when execution has finished
    const codeWithEnd = `${codeWithODSPath2}\n%put ${LineCodes.RunEndCode};`;
    const codeToRun = `codeToRun=r"""
${codeWithEnd}
"""
`;

    // console.log("codeToRun = " + codeToRun);

    this._html5FileName = "";
    this._shellProcess.stdin.write(codeToRun);
    this._pollingForLogResults = true;
      await this._shellProcess.stdin.write(`ll=sas.submit(codeToRun, results='HTML')\n`, async (error) => {
      if (error) {
        this._runReject(error);
      }

      await this.fetchLog();
    });

    return runPromise;
  };

  /**
   * Cleans up resources for the given SAS session.
   * @returns void promise.
   */
  public close = async (): Promise<void> => {
    return new Promise((resolve) => {
      if (this._shellProcess) {
        this._shellProcess.stdin.write(
          "sas.endsas()\nquit()\n",
          this.onWriteComplete,
        );
        this._shellProcess.kill();
        this._shellProcess = undefined;

        this._workDirectory = undefined;
        this._runReject = undefined;
        this._runResolve = undefined;
      }
      resolve();
      updateStatusBarItem(false);
    });
  };

  /**
   * Cancels a running SAS program
   */
  public cancel = async () => {
    this._pollingForLogResults = false;
      this._shellProcess.stdin.write("print(r'abc')\n", async (error) => {
      if (error) {
        this._runReject(error);
      }

      await this.fetchLog();
    });
  };

  /**
   * Formats the SAS Options provided in the profile into a format
   * that the shell process can understand.
   * @param sasOptions SAS Options array from the connection profile.
   * @returns a string  denoting powershell syntax for an array literal.
   */
  private formatSASOptions = (sasOptions: string[]): string => {
    const optionsVariable = `r"""\n${sasOptions.join(`","`)}\n"""`;
    return optionsVariable;
  };

  /**
   * Flushes the SAS log in chunks of [chunkSize] length,
   * writing each chunk to stdout.
   */
  private fetchLog = async (): Promise<void> => {
    this._shellProcess.stdin.write(`print(ll['LOG'])\n`,this.onWriteComplete,);
  };

  /**
   * Handles stderr output from the powershell child process.
   * @param chunk a buffer of stderr output from the child process.
   */
  private onShellStdErr = (chunk: Buffer): void => {
    const msg = chunk.toString('utf8');
    console.warn("shellProcess stderr: " + msg);
    if (/[^.> ]/.test(msg)) {
      this._runReject(
        new Error(
          "There was an error executing the SAS Program.\nSee console log for more details.",
        ),
      );
    }
    // If we encountered an error in setup, we need to go through everything again
    if (/^We failed in getConnection|Setup error|spawn .+ ENOENT: Error/i.test(msg)) {
      this._shellProcess.kill();
      this._workDirectory = undefined;
    }
  };

  /**
   * Handles stdout output from the powershell child process.
   * @param data a buffer of stdout output from the child process.
   */
  private onShellStdOut = (data: Buffer): void => {
    const output = data.toString().trimEnd();
    const outputLines = output.split(/\n|\r\n/);

    outputLines.forEach((line: string) => {
      if (!line) {
        return;
      }

      // if (!this._workDirectory && line.startsWith("WORKDIR=")) {
      //   const parts = line.split("WORKDIR=");
      //   this._workDirectory = parts[1].trim();
      //   this._runResolve();
      //   updateStatusBarItem(true);
      //   return;
      // }
      if (!this._workDirectory && /^WORK Path +=/.test(line)) {
        const parts = line.split(/WORK Path +=/);
        this._workDirectory = parts[1].trim();
        this._runResolve();
        updateStatusBarItem(true);
        return;
      }
      if (!this.processLineCodes(line)) {
        this._html5FileName = extractOutputHtmlFileName(
          line,
          this._html5FileName,
        );

        if (this._workDirectory) {
          this._onExecutionLogFn?.([{ type: this.getLogLineType(), line }]);
        } else {
          this._onSessionLogFn?.([{ type: this.getLogLineType(), line }]);
        }
      }
    });
  };

  private processLineCodes(line: string): boolean {
    if (line.endsWith(LineCodes.RunEndCode)) {
      // run completed
      this.fetchResults();
      return true;
    }

    if (line.includes(LineCodes.ResultsFetchedCode)) {
      this.displayResults();
      return true;
    }

    if (line.includes(LineCodes.RunCancelledCode)) {
      this._runResolve({});
      return true;
    }

    if (line.includes(LineCodes.LogLineType)) {
      const start =
        line.indexOf(LineCodes.LogLineType) + LineCodes.LogLineType.length + 1;
      this._logLineType = parseInt(line.slice(start, start + 1));
      return true;
    }

    return false;
  }

  private getLogLineType(): LogLineTypeEnum {
    const result = LogLineTypes[this._logLineType];
    this._logLineType = 0;
    return result;
  }

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
  private fetchResults = async () => {
    if (!this._html5FileName) {
      return this._runResolve({});
    }

    const globalStorageUri = getGlobalStorageUri();
    try {
      await workspace.fs.readDirectory(globalStorageUri);
    } catch (e) {
      await workspace.fs.createDirectory(globalStorageUri);
    }

    this._pollingForLogResults = false;
    const outputFileUri = Uri.joinPath(
      globalStorageUri,
      `${this._html5FileName}.htm`,
    );
    // const directorySeparator =
    //   this._workDirectory.lastIndexOf("/") !== -1 ? "/" : "\\";
    // const filePath =
    //   this._config.protocol === ITCProtocol.COM
    //     ? resolve(this._workDirectory, this._html5FileName + ".htm")
    //     : `${this._workDirectory}${directorySeparator}${this._html5FileName}.htm`;
    await this._shellProcess.stdin.write(
      `
with open(r"${outputFileUri.fsPath}", 'w', encoding='utf8') as f1:
    f1.write(ll['LST'])

print(r"""
${LineCodes.ResultsFetchedCode}
"""
)

`,
      this.onWriteComplete,
    );
  };

  private displayResults = async () => {
    const globalStorageUri = getGlobalStorageUri();
    const outputFileUri = Uri.joinPath(
      globalStorageUri,
      `${this._html5FileName}.htm`,
    );
    const file = await workspace.fs.readFile(outputFileUri);

    const htmlResults = (file || "").toString();
    if (file) {
      workspace.fs.delete(outputFileUri);
    }

    const runResult: RunResult = {};
    if (htmlResults.search('<*id="IDX*.+">') !== -1) {
      runResult.html5 = htmlResults;
      runResult.title = "Result";
    }
    this._runResolve?.(runResult);
  };
}

/**
 * Creates a new SAS 9 Session.
 * @param c Instance denoting configuration parameters for this connection profile.
 * @returns  created COM session.
 */
export const getSession = (
  c: Partial<Config>,
): Session => {
  const defaults = {
    cfgname: "",
    pythonpath: "python",
  };

  if (!sessionInstance) {
    sessionInstance = new SASPYSession();
  }
  sessionInstance.config = { ...defaults, ...c };
  return sessionInstance;
};
