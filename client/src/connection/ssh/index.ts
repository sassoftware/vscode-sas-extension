// Copyright © 2022-2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { Client, ClientChannel, ConnectConfig } from "ssh2";
import { RunResult, Session, LogLine } from "..";
import { readFileSync } from "fs";

const conn = new Client();
const endCode = "--vscode-sas-extension-submit-end--";
const sasLaunchTimeout = 10000;
let stream: ClientChannel | undefined;
let config: Config;
let resolve: ((value?) => void) | undefined;
let reject: ((reason?) => void) | undefined;
let onLog: ((logs: LogLine[]) => void) | undefined;
let logs: string[] = [];
let html5FileName = "";
let timer: NodeJS.Timeout;

export interface Config {
  host: string;
  username: string;
  saspath: string;
  sasOptions: string[];
  port: number;
  privateKeyPath: string;
}

conn
  .on("ready", () => {
    conn.shell((err, s) => {
      if (err) {
        reject?.(err);
        return;
      }
      stream = s;
      if (!stream) {
        reject?.(err);
        return;
      }

      stream
        .on("close", () => {
          onLog = undefined;
          stream = undefined;
          resolve = undefined;
          reject = undefined;
          logs = [];
          conn.end();
        })
        .on("data", (data: Buffer) => {
          const output = data.toString().trimEnd();
          const outputLines = output.split(/\n|\r\n/);
          if (onLog) {
            outputLines.forEach((line) => {
              if (!line) {
                return;
              }
              if (line.endsWith(endCode)) {
                // run completed
                getResult();
              }
              if (!(line.endsWith("?") || line.endsWith(">"))) {
                html5FileName =
                  line.match(/NOTE: .+ HTML5.* Body .+: (.+)\.htm/)?.[1] ??
                  html5FileName;
                onLog?.([{ type: "normal", line }]);
              }
            });
          } else {
            logs.push(output);
            if (output.endsWith("?")) {
              clearTimer();
              resolve?.();
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

      if (config.sasOptions) {
        resolvedSasOpts.push(...config.sasOptions);
      }
      const execSasOpts: string = resolvedSasOpts.join(" ");

      stream.write(`${execArgs} ${config.saspath} ${execSasOpts} \n`);
    });
  })
  .on("error", (err) => {
    clearTimer();
    reject?.(err);
    return;
  });

function getResult() {
  const runResult: RunResult = {};
  if (!html5FileName) {
    resolve?.(runResult);
    return;
  }
  let fileContents = "";
  conn.exec(`cat ${html5FileName}.htm`, (err: Error, s: ClientChannel) => {
    if (err) {
      reject?.(err);
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
      resolve?.(runResult);
    });
  });
}

function setup(): Promise<void> {
  return new Promise((pResolve, pReject) => {
    resolve = pResolve;
    reject = pReject;

    if (stream) {
      resolve();
      return;
    }

    const cfg: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey: readFileSync(config.privateKeyPath),
      readyTimeout: sasLaunchTimeout,
    };

    setTimer();
    conn.connect(cfg);
  });
}

function run(
  code: string,
  onLogFn?: (logs: LogLine[]) => void
): Promise<RunResult> {
  onLog = onLogFn;
  html5FileName = "";
  if (logs.length) {
    onLog?.(logs.map((line) => ({ type: "normal", line })));
    logs = [];
  }

  return new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;

    stream?.write(`${code}\n`);
    stream?.write(`%put ${endCode};\n`);
  });
}

function close() {
  if (!stream) {
    return;
  }
  stream.write("endsas;\n");
  stream.end("exit\n");
}

function setTimer() {
  clearTimer();
  timer = setTimeout(() => {
    reject?.(
      new Error("Failed to connect to Session. Check profile settings.")
    );
    timer = undefined;
    close();
  }, sasLaunchTimeout);
}

function clearTimer() {
  timer && clearTimeout(timer);
  timer = undefined;
}

export function getSession(c: Config): Session {
  config = c;
  return {
    setup,
    run,
    close,
  };
}
