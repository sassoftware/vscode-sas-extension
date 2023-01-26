import { Client, ConnectConfig } from "ssh2";
import { Duplex } from "stream";
import { RunResult, Session } from "..";
import { readFileSync } from "fs";

//TODO: decouple ui model from api model
import { LogLine } from "../rest/api/compute";

const conn = new Client();
const endCode = "--vscode-sas-extension-submit-end--";
let stream: Duplex | undefined;
let config: Config;
let resolve: ((value?) => void) | undefined;
let reject: ((reason?) => void) | undefined;
let onLog: ((logs: LogLine[]) => void) | undefined;
let logs: string[] = [];
let timer;
let html5FileName = "";

export interface Config {
  host: string;
  saspath: string;
  port?: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
  privateKey?: string;
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
          conn.end();
        })
        .on("data", (data: Buffer) => {
          const output = data.toString().trimEnd();
          console.log(output);
          if (onLog) {
            setTimer();
            output.split(/\n|\r\n/).forEach((line) => {
              if (!line) {
                return;
              }
              if (line === endCode) {
                // run completed
                clearTimer();
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
              // Entered SAS, hearing user input. setup done
              clearTimer();
              resolve?.();
            }
          }
        });

      stream.write(`${config.saspath} -nodms\n`);
    });
  })
  .on("error", (err) => {
    clearTimer();
    reject?.(err);
    return;
  });

function setTimer() {
  clearTimer();
  timer = setTimeout(() => {
    reject?.(new Error("Time out"));
    timer = undefined;
  }, 10000);
}

function clearTimer() {
  timer && clearTimeout(timer);
  timer = undefined;
}

function getResult() {
  if (!html5FileName) {
    resolve?.({});
    return;
  }
  let result = "";
  conn.exec(`cat ${html5FileName}.htm`, (err, s) => {
    if (err) {
      reject?.(err);
      return;
    }

    s.on("data", (data) => {
      result += data.toString().trimEnd();
    }).on("close", (code) => {
      const rc = code as number;
      const runResult: RunResult = {};
      if (rc === 0) {
        runResult.html5 = result;
        runResult.title = html5FileName;
      }
      resolve?.(runResult);
    });
  });
}

function setup(): Promise<void> {
  return new Promise((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;

    if (stream) {
      resolve();
      return;
    }
    setTimer();

    const cfg: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey: config.privateKey,
    };
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

    stream?.write(code);
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

export function getSession(c: Config): Session {
  if (c.privateKeyPath) {
    c.privateKey = readFileSync(c.privateKeyPath).toString();
  }
  config = c;
  return {
    setup,
    run,
    close,
  };
}
