// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { Client, ClientChannel, ConnectConfig } from "ssh2";
import { RunResult, Session, LogLine } from "..";

const endCode = "--vscode-sas-extension-submit-end--";
const sasLaunchTimeout = 10000;
let sessionInstance: SSHSession;

export interface Config {
  host: string;
  username: string;
  saspath: string;
  sasOptions: string[];
  port: number;
}

export function getSession(c: Config): Session {
  if (!process.env.SSH_AUTH_SOCK) {
    throw new Error("SSH_AUTH_SOCK not set. Check Environment Variables.");
  }

  if (!sessionInstance) {
    sessionInstance = new SSHSession();
  }
  sessionInstance.config = c;
  return sessionInstance;
}

export class SSHSession implements Session {
  private conn: Client;
  private stream: ClientChannel | undefined;
  private _config: Config;
  private resolve: ((value?) => void) | undefined;
  private reject: ((reason?) => void) | undefined;
  private onLog: ((logs: LogLine[]) => void) | undefined;
  private logs: string[] = [];
  private html5FileName = "";
  private timer: NodeJS.Timeout;

  constructor(c?: Config) {
    this._config = c;
    this.conn = new Client();
  }

  set config(newValue: Config) {
    this._config = newValue;
  }

  public setup = (): Promise<void> => {
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
      };

      this.conn
        .on("ready", () => {
          this.conn.shell(this.onShell);
        })
        .on("error", this.onConnectionError);

      this.setTimer();
      this.conn.connect(cfg);
    });
  };

  public run = (
    code: string,
    onLog?: (logs: LogLine[]) => void
  ): Promise<RunResult> => {
    this.onLog = onLog;
    this.html5FileName = "";
    if (this.logs.length) {
      this.onLog?.(this.logs.map((line) => ({ type: "normal", line })));
      this.logs = [];
    }

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
        new Error("Failed to connect to Session. Check profile settings.")
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
          fileContents += data.toString().trimEnd();
        }).on("close", (code) => {
          const rc: number = code;

          if (rc === 0) {
            //Make sure that the html has a valid body
            //TODO #185: should this be refactored into a shared location?
            if (fileContents.search('<*id="IDX*.+">') !== -1) {
              runResult.html5 = fileContents;
              runResult.title = "Result";
            }
          }
          this.resolve?.(runResult);
        });
      }
    );
  };

  private onStreamClose = (): void => {
    this.onLog = undefined;
    this.stream = undefined;
    this.resolve = undefined;
    this.reject = undefined;
    this.logs = [];
    this.html5FileName = "";
    this.timer = undefined;
    this.conn.end();
  };

  private onStreamData = (data: Buffer): void => {
    const output = data.toString().trimEnd();
    const outputLines = output.split(/\n|\r\n/);
    if (this.onLog) {
      outputLines.forEach((line) => {
        if (!line) {
          return;
        }
        if (line.endsWith(endCode)) {
          // run completed
          this.getResult();
        }
        if (!(line.endsWith("?") || line.endsWith(">"))) {
          this.html5FileName =
            line.match(/NOTE: .+ HTML5.* Body .+: (.+)\.htm/)?.[1] ??
            this.html5FileName;
          this.onLog?.([{ type: "normal", line }]);
        }
      });
    } else {
      this.logs.push(output);
      if (output.endsWith("?")) {
        this.clearTimer();
        this.resolve?.();
      }
    }
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

    const resolvedEnv: string[] = ['_JAVA_OPTIONS="-Djava.awt.headless=true"'];
    const execArgs: string = resolvedEnv.join(" ");

    const resolvedSasOpts: string[] = ["-nodms", "-terminal", "-nosyntaxcheck"];

    if (this._config.sasOptions) {
      resolvedSasOpts.push(...this._config.sasOptions);
    }
    const execSasOpts: string = resolvedSasOpts.join(" ");

    this.stream.write(`${execArgs} ${this._config.saspath} ${execSasOpts} \n`);
  };
}
