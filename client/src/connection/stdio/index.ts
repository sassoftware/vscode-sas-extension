// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

import { ChildProcess, spawn } from "child_process";
import { readFile } from "fs";
import { join } from "path";

import { BaseConfig, RunResult } from "..";
import { updateStatusBarItem } from "../../components/StatusBarItem";
import { Session } from "../session";
import { extractOutputHtmlFileName } from "../util";
import { WORK_DIR_END_TAG, WORK_DIR_START_TAG } from "./const";
import { LineCodes } from "./types";

let sessionInstance: StdioSession;

export interface Config extends BaseConfig {
  saspath: string;
}

export function getSession(c: Config): Session {
  if (!sessionInstance) {
    sessionInstance = new StdioSession(c);
  }
  return sessionInstance;
}

export class StdioSession extends Session {
  private _process: ChildProcess | undefined;
  private _config: Config;
  private _resolve: ((value?) => void) | undefined;
  private _reject: ((reason?) => void) | undefined;
  private _html5FileName = "";
  private _sessionReady: boolean;
  private _workDirectory: string;

  constructor(c?: Config) {
    super();
    this._config = c;
    this._sessionReady = false;
  }

  public sessionId? = (): string => {
    throw new Error(l10n.t("Method not implemented."));
  };

  set config(newValue: Config) {
    this._config = newValue;
  }

  protected establishConnection = (): Promise<void> => {
    return new Promise((pResolve, pReject) => {
      this._resolve = pResolve;
      this._reject = pReject;

      if (this._process) {
        this._resolve?.({});
        return;
      }

      try {
        // Build SAS options
        const resolvedSasOpts: string[] = [
          "-nodms",
          "-noterminal",
          "-nosyntaxcheck",
        ];

        if (this._config.sasOptions?.length > 0) {
          resolvedSasOpts.push(...this._config.sasOptions);
        }

        // Set Java options for headless mode
        const env = {
          ...process.env,
          _JAVA_OPTIONS: "-Djava.awt.headless=true",
        };

        // Spawn the SAS process with stdio pipes
        this._process = spawn(this._config.saspath, resolvedSasOpts, {
          stdio: ["pipe", "pipe", "pipe"],
          env,
        });

        // Handle process errors
        this._process.on("error", this.onProcessError);
        this._process.on("close", this.onProcessClose);

        // Attach stdout/stderr handlers
        this._process.stdout?.on("data", this.onStdoutData);
        this._process.stderr?.on("data", this.onStderrData);
      } catch (err) {
        this._reject?.(err);
      }
    });
  };

  protected _run = (code: string): Promise<RunResult> => {
    this._html5FileName = "";

    // Parse code to extract HTML5 filename if present
    const codeLines = code.split(/\n|\r\n/);
    for (const line of codeLines) {
      this._html5FileName = extractOutputHtmlFileName(
        line,
        this._html5FileName,
      );
    }

    return new Promise((_resolve, _reject) => {
      this._resolve = _resolve;
      this._reject = _reject;

      if (!this._process?.stdin) {
        this._reject?.(new Error(l10n.t("SAS process is not running.")));
        return;
      }

      this._process.stdin.write(`${code}\n`);
      this._process.stdin.write(`%put ${LineCodes.RunEndCode};\n`);
    });
  };

  protected _close = (): void | Promise<void> => {
    if (!this._process) {
      this.disposeResources();
      return;
    }

    if (this._process.stdin) {
      this._process.stdin.write("endsas;\n");
      this._process.stdin.end();
    }

    // Give SAS a moment to shut down gracefully
    setTimeout(() => {
      if (this._process && !this._process.killed) {
        this._process.kill();
      }
    }, 1000);
  };

  private onProcessClose = () => {
    if (!this._sessionReady) {
      this._reject?.(new Error(l10n.t("Could not start the SAS process.")));
    }

    this.disposeResources();
  };

  private disposeResources = () => {
    if (this._process) {
      this._process.removeAllListeners();
      this._process.stdout?.removeAllListeners();
      this._process.stderr?.removeAllListeners();
      this._process = undefined;
    }
    this._resolve = undefined;
    this._reject = undefined;
    this._html5FileName = "";
    this._workDirectory = undefined;
    sessionInstance = undefined;
    updateStatusBarItem(false);
  };

  private onProcessError = (err: Error) => {
    this._reject?.(err);
  };

  private getResult = (): void => {
    const runResult: RunResult = {};

    // No HTML output is a valid completion state
    if (!this._html5FileName || !this._workDirectory) {
      this._resolve?.(runResult);
      return;
    }

    // Read the HTML file using Node.js fs
    const filePath = join(this._workDirectory, `${this._html5FileName}.htm`);

    readFile(filePath, "utf8", (err: Error, fileContents: string) => {
      if (err) {
        this._resolve?.(runResult);
        return;
      }

      //Make sure that the html has a valid body
      //TODO #185: should this be refactored into a shared location?
      if (fileContents.search('<*id="IDX*.+">') !== -1) {
        runResult.html5 = fileContents;
        runResult.title = l10n.t("Result");
      }
      this._resolve?.(runResult);
    });
  };

  private resolveSystemVars = (): void => {
    const code = `%let wd = %sysfunc(pathname(work));
  %let rc = %sysfunc(dlgcdir("&wd"));
  data _null_; length x $ 4096;
    file STDERR;
    x = resolve('&wd');  put '${WORK_DIR_START_TAG}' x '${WORK_DIR_END_TAG}';
  run;

  `;
    if (this._process?.stdin) {
      this._process.stdin.write(code);
    }
  };

  private onStdoutData = (data: Buffer): void => {
    const output = data.toString().trimEnd();

    // Match SSH semantics: detect prompt from raw chunk
    if (!this._sessionReady && output.endsWith("?")) {
      this._sessionReady = true;
      this._resolve?.();
      this.resolveSystemVars();
      updateStatusBarItem(true);
      return;
    }

    const outputLines = output.split(/\n|\r\n/);
    outputLines.forEach((line) => {
      if (!line) {
        return;
      }
      const trimmedLine = line.trimEnd();
      if (trimmedLine.includes(LineCodes.RunEndCode)) {
        this.getResult();
      }
      if (!(trimmedLine.endsWith("?") || trimmedLine.endsWith(">"))) {
        this._onExecutionLogFn?.([{ type: "normal", line }]);
      }
    });
  };

  private onStderrData = (data: Buffer): void => {
    const output = data.toString().trimEnd();

    // Detect run completion from STDERR as well (stdio writes %put here)
    if (output.includes(LineCodes.RunEndCode)) {
      this.getResult();
    }

    if (this._sessionReady && !this._workDirectory) {
      const match = output.match(
        `${WORK_DIR_START_TAG}(/[\\s\\S]*?)${WORK_DIR_END_TAG}`,
      );
      if (match && match.length > 1) {
        this._workDirectory = match[1].trimEnd().replace(/(\r\n|\n|\r)/gm, "");
      }
    }

    const outputLines = output.split(/\n|\r\n/);
    outputLines.forEach((line) => {
      if (line) {
        this._onSessionLogFn?.([{ type: "normal", line }]);
      }
    });
  };
}
