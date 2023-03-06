import { LogLine, RunResult, Session } from "..";

let config: Config;
const logs: LogLine[] = [];

interface Config {
  sasPath: string;
  sasOptions: string[];
}

async function setup() {
  console.log(config);
  throw new Error("not implemented");
}

async function run(
  code: string,
  onLog?: (logs: LogLine[]) => void
): Promise<RunResult> {
  if (code.length > 0) {
    const line: LogLine = {
      line: code,
      type: "normal",
    };
    logs.push(line);
    onLog([line]);
  }
  return;
}

async function close() {
  return;
}

export function getSession(c: Config): Session {
  config = c;
  return {
    setup,
    run,
    close,
  };
}
