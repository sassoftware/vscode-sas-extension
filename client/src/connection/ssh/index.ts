// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

import { Client, ClientChannel, ConnectConfig } from "ssh2";

import { BaseConfig, RunResult } from "..";
import { updateStatusBarItem } from "../../components/StatusBarItem";
import {
  ProfilePromptType,
  createInputTextBox,
} from "../../components/profile";
import { Session } from "../session";
import { extractOutputHtmlFileName } from "../util";

const endCode = "--vscode-sas-extension-submit-end--";
const sasLaunchTimeout = 10000;
let sessionInstance: SSHSession;

export interface Config extends BaseConfig {
  host: string;
  username: string;
  saspath: string;
  port: number;
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

export class SSHSession extends Session {
  private conn: Client;
  private stream: ClientChannel | undefined;
  private _config: Config;
  private resolve: ((value?) => void) | undefined;
  private reject: ((reason?) => void) | undefined;
  private html5FileName = "";
  private timer: NodeJS.Timeout;

  constructor(c?: Config) {
    super();
    this._config = c;
    this.conn = new Client();
  }

  public sessionId? = (): string => {
    throw new Error(l10n.t("Method not implemented."));
  };

  set config(newValue: Config) {
    this._config = newValue;
  }

  protected establishConnection = (): Promise<void> => {
    return new Promise((pResolve, pReject) => {
      this.resolve = pResolve;
      this.reject = pReject;

      if (this.stream) {
        this.resolve?.({});
        return;
      }

      const cfg: ConnectConfig = {
        host: this._config.host,
        port: this._config.port,
        username: this._config.username,
        readyTimeout: sasLaunchTimeout,
        agent: process.env.SSH_AUTH_SOCK || undefined,
        tryKeyboard: true, // Let library know that passwords are on offer
        password: "", // Setting this to not-undefined, "password" is added to the list of authsAllowed in the client
      };

      // If the server explicitly requests keyboard-interactive password, prompt user for password
      this.conn.on(
        "keyboard-interactive",
        (name, instructions, lang, prompts, finish) => {
          if (
            prompts.length === 1 &&
            prompts[0].prompt.toLowerCase().includes("password")
          ) {
            createInputTextBox(ProfilePromptType.SSHPassword, "", true).then(
              (password) => {
                finish([password]);
              },
            );
          } else {
            finish([]);
          }
        },
      );

      // If all other authentication methods fail, re-try the connection after prompting user for a password
      this.conn.on("error", (err) => {
        if (err.level === "client-authentication") {
          // All authentication variants failed. Try with a user-provided password
          createInputTextBox(ProfilePromptType.SSHPassword, "", true).then(
            (password) => {
              if (password != undefined) {
                cfg.password = password;
                // Note that this is the same connection object, so it still has this on("error") handler,
                //  which will ask for password again.
                //  User hitting cancel/escape after zero or more password attempts is how we exit this loop
                this.conn.connect(cfg);
              } else {
                // User cancels the input - go back to usual error path
                this.onConnectionError(err);
              }
            },
          );
        } else {
          // Any non-authentication error, go back to usual error path
          this.onConnectionError(err);
        }
      });

      this.conn.on("ready", () => {
        this.conn.shell(this.onShell);
      });

      this.setTimer();
      this.conn.connect(cfg);
    });
  };

  public run = (code: string): Promise<RunResult> => {
    this.html5FileName = "";

    return new Promise((_resolve, _reject) => {
      this.resolve = _resolve;
      this.reject = _reject;

      this.stream?.write(`${code}\n`);
      this.stream?.write(`%put ${endCode};\n`);
    });
  };

  public close = (): void | Promise<void> => {
    if (!this.stream) {
      return;
    }
    this.stream.write("endsas;\n");
    this.stream.close();
  };

  private onConnectionError = (err: Error) => {
    this.clearTimer();
    this.reject?.(err);
  };

  private setTimer = (): void => {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.reject?.(
        new Error(
          l10n.t("Failed to connect to Session. Check profile settings."),
        ),
      );
      this.timer = undefined;
      this.close();
    }, sasLaunchTimeout);
  };

  private clearTimer = (): void => {
    this.timer && clearTimeout(this.timer);
    this.timer = undefined;
  };

  private getResult = (): void => {
    const runResult: RunResult = {};
    if (!this.html5FileName) {
      this.resolve?.(runResult);
      return;
    }
    let fileContents = "";
    this.conn.exec(
      `cat ${this.html5FileName}.htm`,
      (err: Error, s: ClientChannel) => {
        if (err) {
          this.reject?.(err);
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
          this.resolve?.(runResult);
        });
      },
    );
  };

  private onStreamClose = (): void => {
    this.stream = undefined;
    this.resolve = undefined;
    this.reject = undefined;
    this.html5FileName = "";
    this.timer = undefined;
    this.conn.end();
    updateStatusBarItem(false);
  };

  private onStreamData = (data: Buffer): void => {
    const output = data.toString().trimEnd();

    if (this.timer && output.endsWith("?")) {
      this.clearTimer();
      this.resolve?.();
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
        this.html5FileName = extractOutputHtmlFileName(
          line,
          this.html5FileName,
        );
        this._onExecutionLogFn?.([{ type: "normal", line }]);
      }
    });
  };

  private onShell = (err: Error, s: ClientChannel): void => {
    if (err) {
      this.reject?.(err);
      return;
    }
    this.stream = s;
    if (!this.stream) {
      this.reject?.(err);
      return;
    }

    this.stream.on("close", this.onStreamClose);
    this.stream.on("data", this.onStreamData);

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

    this.stream.write(`${execArgs} ${this._config.saspath} ${execSasOpts} \n`);
  };
}
