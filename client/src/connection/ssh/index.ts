// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { Client, ClientChannel, ConnectConfig } from "ssh2";
import { RunResult, Session, LogLine } from "..";
import { readFileSync } from "fs";

const endCode = "--vscode-sas-extension-submit-end--";
const sasLaunchTimeout = 10000;
let sessionInstance: SSHSession;

export interface Config {
  host: string;
  username: string;
  saspath: string;
  sasOptions: string[];
  port: number;
  privateKeyPath: string;
}

export function getSession(c: Config): Session {
  if (!sessionInstance) {
    sessionInstance = new SSHSession(c);
  }
  return sessionInstance;
}

export class SSHSession implements Session {
  private conn: Client;
  private stream: ClientChannel | undefined;
  private config: Config;
  private resolve: ((value?) => void) | undefined;
  private reject: ((reason?) => void) | undefined;
  private onLog: ((logs: LogLine[]) => void) | undefined;
  private logs: string[] = [];
  private html5FileName = "";
  private timer: NodeJS.Timeout;

  constructor(c: Config) {
    this.config = c;
    this.conn = new Client();
  }

  setup = (): Promise<void> => {
    return new Promise((pResolve, pReject) => {
      this.resolve = pResolve;
      this.reject = pReject;

      if (this.stream) {
        this.resolve();
        return;
      }

      const cfg: ConnectConfig = {
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        privateKey: readFileSync(this.config.privateKeyPath),
        readyTimeout: sasLaunchTimeout,
      };

      this.conn
        .on("ready", () => {
          this.conn.shell((err, s) => {
            if (err) {
              this.reject?.(err);
              return;
            }
            this.stream = s;
            if (!this.stream) {
              this.reject?.(err);
              return;
            }

            this.stream.on("close", () => {
              this.onLog = undefined;
              this.stream = undefined;
              this.resolve = undefined;
              this.reject = undefined;
              this.logs = [];
              this.html5FileName = "";
              this.timer = undefined;
              this.conn.end();
            });
            this.stream.on("data", (data: Buffer) => {
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
            });

            const resolvedEnv: string[] = [
              '_JAVA_OPTIONS="-Djava.awt.headless=true"',
            ];
            const execArgs: string = resolvedEnv.join(" ");

            const resolvedSasOpts: string[] = [
              "-nodms",
              "-terminal",
              "-nosyntaxcheck",
            ];

            if (this.config.sasOptions) {
              resolvedSasOpts.push(...this.config.sasOptions);
            }
            const execSasOpts: string = resolvedSasOpts.join(" ");

            this.stream.write(
              `${execArgs} ${this.config.saspath} ${execSasOpts} \n`
            );
          });
        })
        .on("error", (err) => {
          this.clearTimer();
          this.reject?.(err);
          return;
        });

      this.setTimer();
      this.conn.connect(cfg);
    });
  };
  run(code: string, onLog?: (logs: LogLine[]) => void): Promise<RunResult> {
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
  }
  close(): void | Promise<void> {
    if (!this.stream) {
      return;
    }
    this.stream.write("endsas;\n");
    this.stream.end("exit\n");
  }

  setTimer() {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.reject?.(
        new Error("Failed to connect to Session. Check profile settings.")
      );
      this.timer = undefined;
      this.close();
    }, sasLaunchTimeout);
  }

  clearTimer() {
    this.timer && clearTimeout(this.timer);
    this.timer = undefined;
  }
  getResult() {
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
            //TODO: should this be refactored into a shared location?
            if (fileContents.search('<*id="IDX*.+">') !== -1) {
              runResult.html5 = fileContents;
              runResult.title = "Result";
            }
          }
          this.resolve?.(runResult);
        });
      }
    );
  }
}
