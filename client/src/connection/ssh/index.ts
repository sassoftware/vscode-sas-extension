// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n, window } from "vscode";
import { CancellationTokenSource } from "vscode-languageclient";

import { readFileSync } from "fs";
import {
  AuthHandlerMiddleware,
  AuthenticationType,
  Client,
  ClientChannel,
  ConnectConfig,
  NextAuthHandler,
  utils,
} from "ssh2";

import { BaseConfig, RunResult } from "..";
import { getSecretStorage } from "../../components/ExtensionContext";
import { updateStatusBarItem } from "../../components/StatusBarItem";
import { Session } from "../session";
import { extractOutputHtmlFileName } from "../util";

const endCode = "--vscode-sas-extension-submit-end--";
const SECRET_STORAGE_NAMESPACE = "SSH_SECRET_STORAGE";
const sasLaunchTimeout = 600000;
let sessionInstance: SSHSession;

export interface Config extends BaseConfig {
  host: string;
  username: string;
  saspath: string;
  port: number;
  privateKeyFilePath: string;
}

export function getSession(c: Config): Session {
  if (!process.env.SSH_AUTH_SOCK) {
    throw new Error(
      l10n.t("SSH_AUTH_SOCK not set. Check Environment Variables."),
    );
  }

  if (!sessionInstance) {
    sessionInstance = new SSHSession();
  }
  sessionInstance.config = c;
  return sessionInstance;
}
type SSHSessionAuthMethod = "password" | "keyboard-interactive" | "publickey";
export class SSHSession extends Session {
  private _conn: Client;
  private _stream: ClientChannel | undefined;
  private _config: Config;
  private _resolve: ((value?) => void) | undefined;
  private _reject: ((reason?) => void) | undefined;
  private _html5FileName = "";
  private _timer: NodeJS.Timeout;
  private _authMethods: SSHSessionAuthMethod[]; //auth methods that this session can support
  private _cancellationSource: CancellationTokenSource | undefined;
  private _secretStorage;
  private _passwordKey: string;

  constructor(c?: Config) {
    super();
    this._config = c;
    this._conn = new Client();
    this._authMethods = ["publickey", "password", "keyboard-interactive"];
    this._secretStorage = getSecretStorage(SECRET_STORAGE_NAMESPACE);
  }

  public sessionId? = (): string => {
    throw new Error(l10n.t("Method not implemented."));
  };

  set config(newValue: Config) {
    this._config = newValue;
    this._passwordKey = `${newValue.host}${newValue.username}`;
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
        readyTimeout: sasLaunchTimeout,
        debug: (msg) => {
          console.log(msg);
        },
        authHandler: this.authHandler,
      };

      this._conn
        .on("ready", () => {
          this._conn.shell(this.onShell);
        })
        .on("error", this.onConnectionError);

      // this.setTimer();
      this._conn.connect(cfg);
    });
  };

  public run = (code: string): Promise<RunResult> => {
    this._html5FileName = "";

    return new Promise((_resolve, _reject) => {
      this._resolve = _resolve;
      this._reject = _reject;

      this._stream?.write(`${code}\n`);
      this._stream?.write(`%put ${endCode};\n`);
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
    this.clearTimer();
    this._reject?.(err);
  };

  private setTimer = (): void => {
    this.clearTimer();
    this._timer = setTimeout(() => {
      this._reject?.(
        new Error(
          l10n.t("Failed to connect to Session. Check profile settings."),
        ),
      );
      this._timer = undefined;
      this.close();
    }, sasLaunchTimeout);
  };

  private clearTimer = (): void => {
    this._timer && clearTimeout(this._timer);
    this._timer = undefined;
  };

  private getResult = (): void => {
    const runResult: RunResult = {};
    if (!this._html5FileName) {
      this._resolve?.(runResult);
      return;
    }
    let fileContents = "";
    this._conn.exec(
      `cat ${this._html5FileName}.htm`,
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
    this._timer = undefined;
    this._conn.end();
    updateStatusBarItem(false);
  };

  private onStreamData = (data: Buffer): void => {
    const output = data.toString().trimEnd();

    if (this._timer && output.endsWith("?")) {
      this.clearTimer();
      this._resolve?.();
      updateStatusBarItem(true);
      return;
    }

    const outputLines = output.split(/\n|\r\n/);
    outputLines.forEach((line) => {
      if (!line) {
        return;
      }
      if (line.endsWith(endCode)) {
        // run completed
        this.getResult();
      }
      if (!(line.endsWith("?") || line.endsWith(">"))) {
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

  private promptForPassphrase = async (): Promise<string> => {
    //TODO: need to think about whether these should be stored in secret storage
    // I'm leaning towrds no, but it's worth considering. Intial thought is that
    // if users want to persist a passphrase, that the ssh-agent should be used,
    // which seems to be inline with other solutions. Otherwise, the passphrase
    // should be entered each time a session is established.
    const passphrase = await window.showInputBox({
      prompt: l10n.t("Enter the passphrase for the private key."),
      password: true,
    });
    return passphrase;
  };
  private promptForPassword = async (): Promise<string> => {
    //TODO: we need to properly manage the lifecycle of the password secret
    const storedPassword = await this._secretStorage.get(this._passwordKey);
    if (storedPassword) {
      return storedPassword;
    }

    const source = new CancellationTokenSource();
    this._cancellationSource = source;
    const pw = await window.showInputBox(
      {
        ignoreFocusOut: true,
        password: true,
        prompt: l10n.t("Enter your password for this connection."),
        title: l10n.t("Password Required"),
      },
      this._cancellationSource.token,
    );
    return pw;
  };

  private authHandler: AuthHandlerMiddleware = (
    authsLeft: AuthenticationType[],
    _partialSuccess: boolean,
    cb: NextAuthHandler,
  ) => {
    if (!authsLeft) {
      cb("none"); //sending none will usually prompt the server to send supported auth methods
      return;
    }

    if (this._authMethods.length === 0) {
      //if we're out of auth methods to try, then reject with an error
      this._reject?.(
        new Error(l10n.t("Could not authenticate to the SSH server.")),
      );

      //returning false will stop the auth process
      return false;
    }

    //otherwise, fetch the next auth method to try
    const authMethod = this._authMethods.shift();

    //make sure the auth method is supported by the server
    if (authsLeft.includes(authMethod)) {
      switch (authMethod) {
        //TODO: this is ugly and needs to be broken up into smaller functions
        // one function per type of auth method would be a good start
        case "publickey": {
          //user set a keyfile path in profile config
          //check for passphrase, prompt if necessary
          //and then attempt to auth
          if (this._config.privateKeyFilePath) {
            const keyContents = readFileSync(this._config.privateKeyFilePath);
            const parsedKeyResult = utils.parseKey(keyContents);
            // key is encrypted, prompt for passphrase
            if (
              parsedKeyResult instanceof Error &&
              parsedKeyResult.message ===
                "Encrypted OpenSSH private key detected, but no passphrase given"
            ) {
              this.promptForPassphrase().then((passphrase) => {
                //parse the keyfile using the passphrase
                const parsedKeyContentsResult = utils.parseKey(
                  keyContents,
                  passphrase,
                );

                //TODO: refactor typechecking into one place, maybe a utility function
                if (!(parsedKeyContentsResult instanceof Error)) {
                  cb({
                    type: "publickey",
                    key: parsedKeyContentsResult,
                    passphrase: passphrase,
                    username: this._config.username,
                  });
                }
              });
            } else {
              //TODO: refactor typechecking into one place, maybe a utility function
              if (!(parsedKeyResult instanceof Error)) {
                cb({
                  type: "publickey",
                  key: parsedKeyResult,
                  username: this._config.username,
                });
              }
            }
          } else if (process.env.SSH_AUTH_SOCK) {
            //attempt to auth using ssh-agent
            cb({
              type: "agent",
              agent: process.env.SSH_AUTH_SOCK,
              username: this._config.username,
            });
          }
          break;
        }
        case "password": {
          this.promptForPassword().then((pw) => {
            cb({
              type: "password",
              password: pw,
              username: this._config.username,
            });
          });
          break;
        }

        case "keyboard-interactive": {
          cb({
            type: "keyboard-interactive",
            username: this._config.username,
            prompt: (_name, _instructions, _instructionsLang, prompts, cb) => {
              if (prompts.length === 1 && prompts[0].prompt === "Password:") {
                this.promptForPassword().then((pw) => {
                  cb([pw]);
                });
              } else {
                cb([]);
              }
            },
          });
          break;
        }
        default:
          //TODO: not sure if cb with "none" is the right thing to do here
          cb("none");
      }
    } else {
      console.warn(`Server does not support ${authMethod} auth method.`);
      cb("none");
    }
  };
}
