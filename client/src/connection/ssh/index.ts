// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

import {
  AgentAuthMethod,
  AuthHandlerMiddleware,
  AuthenticationType,
  Client,
  ClientChannel,
  ConnectConfig,
  KeyboardInteractiveAuthMethod,
  NextAuthHandler,
  PasswordAuthMethod,
  PublicKeyAuthMethod,
} from "ssh2";

import { BaseConfig, RunResult } from "..";
import { updateStatusBarItem } from "../../components/StatusBarItem";
import { Session } from "../session";
import { extractOutputHtmlFileName } from "../util";
import { AuthHandler } from "./auth";
import {
  CONNECT_READY_TIMEOUT,
  KEEPALIVE_INTERVAL,
  KEEPALIVE_UNANSWERED_THRESHOLD,
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
    sessionInstance = new SSHSession(c, new Client());
  }
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
  private _authHandler: AuthHandler;
  private _workDirectory: string;
  private _authsLeft: AuthenticationType[];

  constructor(c?: Config, client?: Client) {
    super();
    this._config = c;
    this._conn = client;
    this._sessionReady = false;
    this._authHandler = new AuthHandler();
    this._authsLeft = [];
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

      const authHandlerFn = this.handleSSHAuthentication();
      const cfg: ConnectConfig = {
        host: this._config.host,
        port: this._config.port,
        username: this._config.username,
        readyTimeout: CONNECT_READY_TIMEOUT,
        keepaliveInterval: KEEPALIVE_INTERVAL,
        keepaliveCountMax: KEEPALIVE_UNANSWERED_THRESHOLD,
        authHandler: (methodsLeft, partialSuccess, callback) => (
          authHandlerFn(methodsLeft, partialSuccess, callback), undefined
        ),
      };

      if (!this._conn) {
        this._conn = new Client();
      }

      this._conn
        .on("close", this.onConnectionClose)
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
      this.disposeResources();
      return;
    }
    this._stream.write("endsas;\n");
    this._stream.close();
  };

  private onConnectionClose = () => {
    if (!this._sessionReady) {
      this._reject?.(new Error(l10n.t("Could not connect to the SAS server.")));
    }

    this.disposeResources();
  };

  private disposeResources = () => {
    this._stream = undefined;
    this._resolve = undefined;
    this._reject = undefined;
    this._html5FileName = "";
    this._workDirectory = undefined;
    this.clearAuthState();
    sessionInstance = undefined;
    this._authsLeft = [];
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
        })
          .on("close", (code) => {
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
          })
          .on("error", (err) => {
            console.log(err);
          });
      },
    );
  };

  private onStreamClose = (): void => {
    this._conn.end();
    updateStatusBarItem(false);
  };

  private resolveSystemVars = (): void => {
    const code = `%let wd = %sysfunc(pathname(work));
  %let rc = %sysfunc(dlgcdir("&wd"));
  data _null_; length x $ 4096;
    file STDERR;
    x = resolve('&wd');  put '${WORK_DIR_START_TAG}' x '${WORK_DIR_END_TAG}';
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
      if (!line) {
        return;
      }
      const trimmedLine = line.trimEnd();
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
    this._sessionReady = false;
    this._authsLeft = [];
  };

  private handleSSHAuthentication = (): AuthHandlerMiddleware => {
    //The ssh2 library supports sending false to stop the authentication process
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const END_AUTH = false as unknown as AuthenticationType;
    return async (
      authsLeft: AuthenticationType[],
      partialSuccess: boolean, //used in scenarios which require multiple auth methods to denote partial success
      nextAuth: NextAuthHandler,
    ) => {
      if (!authsLeft) {
        return nextAuth({ type: "none", username: this._config.username }); //sending none will prompt the server to send supported auth methods
      } else {
        if (authsLeft.length === 0) {
          return nextAuth(END_AUTH);
        }

        if (this._authsLeft.length === 0 || partialSuccess) {
          this._authsLeft = authsLeft;
        }

        const authMethod = this._authsLeft.shift();

        try {
          let authPayload:
            | PublicKeyAuthMethod
            | AgentAuthMethod
            | PasswordAuthMethod
            | KeyboardInteractiveAuthMethod;

          switch (authMethod) {
            case "publickey": {
              //user set a keyfile path in profile config
              if (this._config.privateKeyFilePath) {
                authPayload = await this._authHandler.privateKeyAuth(
                  this._config.privateKeyFilePath,
                  this._config.username,
                );
              } else if (process.env.SSH_AUTH_SOCK) {
                authPayload = this._authHandler.sshAgentAuth(
                  this._config.username,
                );
              }
              break;
            }
            case "password": {
              authPayload = await this._authHandler.passwordAuth(
                this._config.username,
              );
              break;
            }
            case "keyboard-interactive": {
              authPayload = await this._authHandler.keyboardInteractiveAuth(
                this._config.username,
              );
              break;
            }
            default:
              nextAuth(authMethod);
          }
          return nextAuth(authPayload);
        } catch (e) {
          this._reject?.(e);
          return nextAuth(END_AUTH);
        }
      }
    };
  };
}
