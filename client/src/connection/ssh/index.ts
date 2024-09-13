// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

import {
  AuthHandlerMiddleware,
  AuthenticationType,
  Client,
  ClientChannel,
  ConnectConfig,
  NextAuthHandler,
} from "ssh2";

import { BaseConfig, RunResult } from "..";
import { updateStatusBarItem } from "../../components/StatusBarItem";
import { LineParser } from "../LineParser";
import { Session } from "../session";
import { extractOutputHtmlFileName } from "../util";
import { AuthHandler } from "./auth";
import {
  KEEPALIVE_INTERVAL,
  KEEPALIVE_UNANSWERED_THRESHOLD,
  SAS_LAUNCH_TIMEOUT,
  SUPPORTED_AUTH_METHODS,
  WORK_DIR_END_TAG,
  WORK_DIR_START_TAG,
} from "./const";
import { LineCodes } from "./types";

let sessionInstance: SSHSession;

export interface Config extends BaseConfig {
  host: string;
  username: string;
  saspath: string;
  port: number;
  privateKeyFilePath?: string;
}

export function getSession(c: Config): Session {
  if (!sessionInstance) {
    sessionInstance = new SSHSession();
  }
  sessionInstance.config = c;
  return sessionInstance;
}
export class SSHSession extends Session {
  private _conn: Client;
  private _stream: ClientChannel | undefined;
  private _config: Config;
  private _resolve: ((value?) => void) | undefined;
  private _reject: ((reason?) => void) | undefined;
  private _html5FileName = "";
  private _sessionReady: boolean;
  private _authMethods: AuthenticationType[]; //auth methods that this session can support
  private _authHandler: AuthHandler;
  private _workDirectory: string;
  private _workDirectoryParser: LineParser;

  constructor(c?: Config) {
    super();
    this._config = c;
    this._conn = new Client();
    this._authMethods = ["publickey", "password", "keyboard-interactive"];
    this._sessionReady = false;
    this._authHandler = new AuthHandler();
    this._workDirectoryParser = new LineParser(
      WORK_DIR_START_TAG,
      WORK_DIR_END_TAG,
      false,
    );
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

      if (this._stream) {
        this._resolve?.({});
        return;
      }

      const cfg: ConnectConfig = {
        host: this._config.host,
        port: this._config.port,
        username: this._config.username,
        readyTimeout: SAS_LAUNCH_TIMEOUT,
        keepaliveInterval: KEEPALIVE_INTERVAL,
        keepaliveCountMax: KEEPALIVE_UNANSWERED_THRESHOLD,
        debug: (msg) => {
          console.log(msg);
        },
        authHandler: this.handleSSHAuthentication,
      };

      this._conn
        .on("ready", () => {
          this._conn.shell(this.onShell);
        })
        .on("error", this.onConnectionError);

      this._conn.connect(cfg);
    });
  };

  public run = (code: string): Promise<RunResult> => {
    this._html5FileName = "";

    return new Promise((_resolve, _reject) => {
      this._resolve = _resolve;
      this._reject = _reject;

      this._stream?.write(`${code}\n`);
      this._stream?.write(`%put ${LineCodes.RunEndCode};\n`);
    });
  };

  public close = (): void | Promise<void> => {
    if (!this._stream) {
      return;
    }
    this._stream.write("endsas;\n");
    this._stream.close();
  };

  private onConnectionError = (err: Error) => {
    this.clearAuthState();
    this._reject?.(err);
  };

  private getResult = (): void => {
    const runResult: RunResult = {};
    if (!this._html5FileName) {
      this._resolve?.(runResult);
      return;
    }
    let fileContents = "";
    this._conn.exec(
      `cat ${this._workDirectory}/${this._html5FileName}.htm`,
      (err: Error, s: ClientChannel) => {
        if (err) {
          this._reject?.(err);
          return;
        }

        s.on("data", (data) => {
          fileContents += data.toString();
        }).on("close", (code) => {
          const rc: number = code;

          if (rc === 0) {
            //Make sure that the html has a valid body
            //TODO #185: should this be refactored into a shared location?
            if (fileContents.search('<*id="IDX*.+">') !== -1) {
              runResult.html5 = fileContents;
              runResult.title = l10n.t("Result");
            }
          }
          this._resolve?.(runResult);
        });
      },
    );
  };

  private onStreamClose = (): void => {
    this._stream = undefined;
    this._resolve = undefined;
    this._reject = undefined;
    this._html5FileName = "";
    this.clearAuthState();
    this._workDirectory = undefined;
    this._conn.end();
    updateStatusBarItem(false);
  };

  private fetchWorkDirectory = (line: string): string => {
    let foundWorkDirectory = "";
    if (
      !line.includes(`%put ${WORK_DIR_START_TAG};`) &&
      !line.includes(`%put &workDir;`) &&
      !line.includes(`%put ${WORK_DIR_END_TAG};`)
    ) {
      foundWorkDirectory = this._workDirectoryParser.processLine(line);
    } else {
      // If the line is the put statement, we don't need to log that
      return;
    }
    // We don't want to output any of the captured lines
    if (this._workDirectoryParser.isCapturingLine()) {
      return;
    }

    return foundWorkDirectory || "";
  };
  private resolveSystemVars = (): void => {
    const code = `%let workDir = %sysfunc(pathname(work));
    %put ${WORK_DIR_START_TAG};
    %put &workDir;
    %put ${WORK_DIR_END_TAG};
    %let rc = %sysfunc(dlgcdir("&workDir"));
    run;
    `;
    this._stream.write(code);
  };
  private onStreamData = (data: Buffer): void => {
    const output = data.toString().trimEnd();

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
      const trimmedLine = line.trim();
      if (trimmedLine.endsWith(LineCodes.RunEndCode)) {
        // run completed
        this.getResult();
      }
      if (!(trimmedLine.endsWith("?") || trimmedLine.endsWith(">"))) {
        this._html5FileName = extractOutputHtmlFileName(
          line,
          this._html5FileName,
        );
        this._onExecutionLogFn?.([{ type: "normal", line }]);
      }

      if (this._sessionReady && !this._workDirectory) {
        const foundWorkDir = this.fetchWorkDirectory(line);
        if (foundWorkDir) {
          const match = foundWorkDir.match(/\/[^\s\r]+/);
          this._workDirectory = match ? match[0] : "";
        }
      }
    });
  };

  private onShell = (err: Error, s: ClientChannel): void => {
    if (err) {
      this._reject?.(err);
      return;
    }
    this._stream = s;
    if (!this._stream) {
      this._reject?.(err);
      return;
    }

    this._stream.on("close", this.onStreamClose);
    this._stream.on("data", this.onStreamData);

    const resolvedEnv: string[] = [
      "env",
      '_JAVA_OPTIONS="-Djava.awt.headless=true"',
    ];
    const execArgs: string = resolvedEnv.join(" ");

    const resolvedSasOpts: string[] = [
      "-nodms",
      "-noterminal",
      "-nosyntaxcheck",
    ];

    if (this._config.sasOptions?.length > 0) {
      resolvedSasOpts.push(...this._config.sasOptions);
    }
    const execSasOpts: string = resolvedSasOpts.join(" ");

    this._stream.write(`${execArgs} ${this._config.saspath} ${execSasOpts} \n`);
  };

  /**
   * Resets the SSH auth state.
   */
  private clearAuthState = (): void => {
    this._authMethods = undefined;
    this._sessionReady = false;
  };

  private handleSSHAuthentication: AuthHandlerMiddleware = (
    authsLeft: AuthenticationType[],
    _partialSuccess: boolean,
    cb: NextAuthHandler,
  ) => {
    if (!authsLeft) {
      cb("none"); //sending none will prompt the server to send supported auth methods
      return;
    }

    if (!this._authMethods) {
      this._authMethods = authsLeft;
    }

    if (this._authMethods.length === 0) {
      //if we're out of auth methods to try, then reject with an error
      this._reject?.(
        new Error(l10n.t("Could not authenticate to the SSH server.")),
      );

      this.clearAuthState();
      //returning false will stop the auth process
      return false;
    }

    //otherwise, fetch the next auth method to try
    const authMethod = this._authMethods.shift();

    //make sure the auth method is supported by the server
    if (SUPPORTED_AUTH_METHODS.includes(authMethod)) {
      switch (authMethod) {
        case "publickey": {
          //user set a keyfile path in profile config
          if (this._config.privateKeyFilePath) {
            this._authHandler.privateKeyAuth(
              cb,
              this._config.privateKeyFilePath,
              this._config.username,
            );
          } else if (process.env.SSH_AUTH_SOCK) {
            this._authHandler.sshAgentAuth(cb, this._config.username);
          }
          break;
        }
        case "password": {
          this._authHandler.passwordAuth(cb, this._config.username);
          break;
        }
        case "keyboard-interactive": {
          this._authHandler.keyboardInteractiveAuth(cb, this._config.username);
          break;
        }
        default:
          cb("none");
      }
    } else {
      console.warn(`Server does not support ${authMethod} auth method.`);
      cb("none");
    }
  };
}
