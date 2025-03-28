// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CancellationTokenSource,
  Uri,
  env,
  l10n,
  window,
  workspace,
} from "vscode";

import { ChildProcessWithoutNullStreams, spawn } from "child_process";
import { resolve } from "path";

import { LogLineTypeEnum, RunResult } from "..";
import {
  getGlobalStorageUri,
  getSecretStorage,
} from "../../components/ExtensionContext";
import { updateStatusBarItem } from "../../components/StatusBarItem";
import { Session } from "../session";
import { extractOutputHtmlFileName } from "../util";
import { LineParser } from "./LineParser";
import {
  ERROR_END_TAG,
  ERROR_START_TAG,
  WORK_DIR_END_TAG,
  WORK_DIR_START_TAG,
} from "./const";
import { scriptContent } from "./script";
import { Config, ITCProtocol, LineCodes } from "./types";
import { decodeEntities, escapePowershellString } from "./util";

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

const SECRET_STORAGE_NAMESPACE = "ITC_SECRET_STORAGE";

let sessionInstance: ITCSession;

export class ITCSession extends Session {
  private _config: Config;
  private _shellProcess: ChildProcessWithoutNullStreams;
  private _html5FileName: string;
  private _runResolve: ((value?) => void) | undefined;
  private _runReject: ((reason?) => void) | undefined;
  private _workDirectory: string;
  private _password: string;
  private _secretStorage;
  private _passwordKey: string;
  private _pollingForLogResults: boolean;
  private _logLineType = 0;
  private _passwordInputCancellationTokenSource:
    | CancellationTokenSource
    | undefined;
  private _errorParser: LineParser;
  private _workDirectoryParser: LineParser;

  constructor() {
    super();
    this._password = "";
    this._secretStorage = getSecretStorage(SECRET_STORAGE_NAMESPACE);
    this._pollingForLogResults = false;
    this._errorParser = new LineParser(ERROR_START_TAG, ERROR_END_TAG, true);
    this._workDirectoryParser = new LineParser(
      WORK_DIR_START_TAG,
      WORK_DIR_END_TAG,
      false,
    );
  }

  public set config(value: Config) {
    this._config = value;
    this._passwordKey = `${value.host}${value.protocol}${value.username}`;
  }

  /**
   * Initialization logic that should be performed prior to execution.
   * @returns void promise.
   */
  protected establishConnection = async (): Promise<void> => {
    const { host, port, protocol, username, interopLibraryFolderPath } =
      this._config;
    const setupPromise = new Promise<void>((resolve, reject) => {
      this._runResolve = resolve;
      this._runReject = reject;
    });

    if (this._shellProcess && !this._shellProcess.killed) {
      this._runResolve();
      return; // manually terminate to avoid executing the code below
    }

    this._shellProcess = spawn(
      "chcp 65001 >NUL & powershell.exe -NonInteractive -NoProfile -Command -",
      {
        shell: true,
        env: process.env,
      },
    );
    this._shellProcess.stdout.on("data", this.onShellStdOut);
    this._shellProcess.stderr.on("data", this.onShellStdErr);
    this._shellProcess.stdin.write(scriptContent + "\n", this.onWriteComplete);
    this._shellProcess.stdin.write(
      `$runner = New-Object -TypeName SASRunner -ArgumentList "${escapePowershellString(interopLibraryFolderPath || "")}"\n`,
      this.onWriteComplete,
    );

    /*
     * There are cases where the higher level run command will invoke setup multiple times.
     * Avoid re-initializing the session when this happens. In a first run scenario a work dir
     * will not exist. The work dir should only be deleted when close is invoked.
     */
    if (!this._workDirectory) {
      this._shellProcess.stdin.write(`$profileHost = "${host}"\n`);
      this._shellProcess.stdin.write(`$port = ${port}\n`);
      this._shellProcess.stdin.write(`$protocol = ${protocol}\n`);
      this._shellProcess.stdin.write(
        `$username = "${escapePowershellString(username)}"\n`,
      );
      const password = await this.fetchPassword();
      this._shellProcess.stdin.write(
        `$password = "${escapePowershellString(password)}"\n`,
      );
      this._shellProcess.stdin.write(
        `$serverName = "${
          protocol === ITCProtocol.COM ? "ITC Local" : "ITC IOM Bridge"
        }"\n`,
      );
      this._shellProcess.stdin.write(`$displayLang = "${env.language}"\n`);
      this._shellProcess.stdin.write(
        `$runner.Setup($profileHost,$username,$password,$port,$protocol,$serverName,$displayLang)\n`,
        this.onWriteComplete,
      );
      this._workDirectoryParser.reset();
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

    return setupPromise;
  };

  private storePassword = async () =>
    await this._secretStorage.store(this._passwordKey, this._password);

  private clearPassword = async () => {
    await this._secretStorage.store(this._passwordKey, "");
    this._password = "";
  };

  private fetchPassword = async (): Promise<string> => {
    if (this._config.protocol === ITCProtocol.COM) {
      return "";
    }

    const storedPassword = await this._secretStorage.get(this._passwordKey);
    if (storedPassword) {
      this._password = storedPassword;
      return storedPassword;
    }

    const source = new CancellationTokenSource();
    this._passwordInputCancellationTokenSource = source;
    this._password =
      (await window.showInputBox(
        {
          ignoreFocusOut: true,
          password: true,
          prompt: l10n.t("Enter your password for this connection."),
          title: l10n.t("Enter your password"),
        },
        this._passwordInputCancellationTokenSource.token,
      )) || "";

    return this._password;
  };

  /**
   * Executes the given input code.
   * @param code A string of SAS code to execute.
   * @param onLog A callback handler responsible for marshalling log lines back to the higher level extension API.
   * @returns A promise that eventually resolves to contain the given {@link RunResult} for the input code execution.
   */
  protected _run = async (
    code: string,
    skipPageHeaders?: boolean,
  ): Promise<RunResult> => {
    const runPromise = new Promise<RunResult>((resolve, reject) => {
      this._runResolve = resolve;
      this._runReject = reject;
    });

    //write ODS output to work so that the session cleans up after itself
    const codeWithODSPath = code.replace(
      /\bods html5\(id=vscode\)([^;]*;)/i,
      `ods html5(id=vscode) path="${this._workDirectory}" $1`,
    );

    //write an end mnemonic so that the handler knows when execution has finished
    const codeWithEnd = `${codeWithODSPath}\n%put ${LineCodes.RunEndCode};`;
    const codeWithEscapeNewLine = codeWithEnd.replace(
      /\n/g,
      "\n'@+[environment]::NewLine+@'\n",
    );
    const codeToRun = `$code=\n@'\n${codeWithEscapeNewLine}\n'@\n`;

    this._html5FileName = "";
    this._shellProcess.stdin.write(codeToRun);
    this._pollingForLogResults = true;
    this._shellProcess.stdin.write(`$runner.Run($code)\n`, async (error) => {
      if (error) {
        this._runReject(error);
      }

      await this.fetchLog(skipPageHeaders);
    });

    return runPromise;
  };

  public execute = async (code: string): Promise<RunResult> => {
    const runPromise = new Promise<RunResult>((resolve, reject) => {
      this._runResolve = resolve;
      this._runReject = reject;
    });

    this._html5FileName = "";
    this._pollingForLogResults = true;
    const codeToExecute = `${code}\nWrite-Host "${LineCodes.RunEndCode}"\n`;
    this._shellProcess.stdin.write(codeToExecute, async (error) => {
      if (error) {
        this._runReject(error);
      }
    });

    return runPromise;
  };

  /**
   * Cleans up resources for the given SAS session.
   * @returns void promise.
   */
  protected _close = async (): Promise<void> => {
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
      this.clearPassword();
      resolve();
      updateStatusBarItem(false);
    });
  };

  /**
   * Cancels a running SAS program
   */
  public cancel = async () => {
    this._pollingForLogResults = false;
    this._shellProcess.stdin.write("$runner.Cancel()\n", async (error) => {
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
    const optionsVariable = `@("${sasOptions.join(`","`)}")`;
    return optionsVariable;
  };

  /**
   * Flushes the SAS log in chunks of [chunkSize] length,
   * writing each chunk to stdout.
   */
  private fetchLog = async (skipPageHeaders?: boolean): Promise<void> => {
    const pollingInterval = setInterval(() => {
      if (!this._pollingForLogResults) {
        clearInterval(pollingInterval);
      }
      const skipPageHeadersValue = skipPageHeaders ? "$true" : "$false";
      this._shellProcess.stdin.write(
        `
  do {
    $chunkSize = 32768
    $count = $runner.FlushLogLines($chunkSize, ${skipPageHeadersValue})
  } while ($count -gt 0)\n
    `,
        this.onWriteComplete,
      );
    }, 2 * 1000);
  };

  /**
   * Handles stderr output from the powershell child process.
   * @param chunk a buffer of stderr output from the child process.
   */
  private onShellStdErr = (chunk: Buffer): void => {
    const msg = chunk.toString();

    const errorMessage = this._errorParser.processLine(msg);
    if (!errorMessage) {
      return;
    }

    this._runReject(
      new Error(this.fetchHumanReadableErrorMessage(errorMessage)),
    );

    // If we encountered an error in setup, we need to go through everything again
    const fatalErrors = [
      /Setup error/,
      /powershell\.exe/,
      /LoadingInterop error/,
    ];
    if (fatalErrors.find((regex) => regex.test(errorMessage))) {
      // If we can't even run the shell script (i.e. powershell.exe not found),
      // we'll also need to dismiss the password prompt
      this._passwordInputCancellationTokenSource &&
        this._passwordInputCancellationTokenSource.cancel();

      this.clearPassword();

      this._shellProcess.kill();
      this._workDirectory = undefined;
    }
  };

  private fetchWorkDirectory = (line: string): string | undefined => {
    const foundWorkDirectory = this._workDirectoryParser.processLine(line);
    // We don't want to output any of the captured lines
    if (this._workDirectoryParser.isCapturingLine()) {
      return;
    }

    return foundWorkDirectory || "";
  };

  private fetchHumanReadableErrorMessage = (msg: string): string => {
    const atLineIndex = msg.indexOf("At line");
    const errorMessage = atLineIndex ? msg.slice(0, atLineIndex) : msg;

    // Dump error to console
    console.warn("shellProcess stderr: " + errorMessage);

    if (/powershell\.exe/.test(msg)) {
      return l10n.t("This platform does not support this connection type.");
    }

    if (/LoadingInterop error/.test(msg)) {
      return l10n.t("Unable to load required libraries.");
    }

    // Do we have SAS messages?
    const sasMessages = errorMessage
      .replace(/\n|\t/gm, "")
      .match(/<SASMessage severity="[A-Za-z]*">([^<]*)<\/SASMessage>/g);
    if (sasMessages && sasMessages.length) {
      return decodeEntities(
        sasMessages
          .map((sasMessage) =>
            sasMessage
              .replace(/<SASMessage severity="[A-Za-z]*">/, "")
              .replace(/<\/SASMessage>/, ""),
          )
          .join("  "),
      );
    }

    // Do we have a description?
    const descriptions = errorMessage
      .replace(/\n|\t/gm, "")
      .match(/<description>([^<]*)<\/description>/g);
    if (descriptions && descriptions.length) {
      return decodeEntities(
        descriptions
          .map((sasMessage) =>
            sasMessage
              .replace(/<description>/, "")
              .replace(/<\/description>/, ""),
          )
          .join("  "),
      );
    }

    // If we have neither of those, lets just point the user to the console
    return l10n.t(
      "There was an error executing the SAS Program. See [console log](command:workbench.action.toggleDevTools) for more details.",
    );
  };

  /**
   * Handles stdout output from the powershell child process.
   * @param data a buffer of stdout output from the child process.
   */
  private onShellStdOut = (data: Buffer): void => {
    const output = data.toString();
    const outputLines = output.split(/\n|\r\n/);

    outputLines.forEach((line: string) => {
      if (!line) {
        return;
      }

      if (!this.processLineCodes(line)) {
        if (!this._workDirectory) {
          const foundWorkDirectory = this.fetchWorkDirectory(line);
          if (foundWorkDirectory === undefined) {
            return;
          }

          if (foundWorkDirectory) {
            this._workDirectory = foundWorkDirectory.trim();
            this._runResolve();
            updateStatusBarItem(true);
            return;
          }
        }

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

    if (line.includes(LineCodes.SessionCreatedCode)) {
      this.storePassword();
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
      this._pollingForLogResults = false;
      return this._runResolve({});
    }

    const globalStorageUri = getGlobalStorageUri();
    try {
      await workspace.fs.readDirectory(globalStorageUri);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      await workspace.fs.createDirectory(globalStorageUri);
    }

    this._pollingForLogResults = false;
    const outputFileUri = Uri.joinPath(
      globalStorageUri,
      `${this._html5FileName}.htm`,
    );
    const directorySeparator =
      this._workDirectory.lastIndexOf("/") !== -1 ? "/" : "\\";
    const filePath =
      this._config.protocol === ITCProtocol.COM
        ? resolve(this._workDirectory, this._html5FileName + ".htm")
        : `${this._workDirectory}${directorySeparator}${this._html5FileName}.htm`;
    this._shellProcess.stdin.write(
      `$filePath = "${filePath}"
$outputFile = "${outputFileUri.fsPath}"
$runner.FetchResultsFile($filePath, $outputFile)\n`,
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
    this._runResolve(runResult);
  };
}

/**
 * Creates a new SAS 9 Session.
 * @param c Instance denoting configuration parameters for this connection profile.
 * @returns  created COM session.
 */
export const getSession = (
  c: Partial<Config>,
  protocol: ITCProtocol,
): Session => {
  const defaults = {
    host: "localhost",
    port: 0,
    username: "",
    protocol,
  };

  if (!sessionInstance) {
    sessionInstance = new ITCSession();
  }
  sessionInstance.config = { ...defaults, ...c };
  return sessionInstance;
};
