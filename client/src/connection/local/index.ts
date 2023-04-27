import { LogLine, RunResult, Session } from "..";
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";

let config: Config;
let logLines: LogLine[] = [];
let tmpDir: string;
let workDirectory: string;
let tmpProgramName: string;
const programName = "program";
let logFileName: string;
let listFileName: string;
let odsHtmlFileName = "";

interface Config {
  sasPath: string;
  sasOptions: string[];
}

const close = (): void | Promise<void> => {
  logLines = [];

  // Delete the temporary files
  fs.unlinkSync(programName);
  fs.unlinkSync(logFileName);
  fs.unlinkSync(odsHtmlFileName);
  fs.unlinkSync(listFileName);
  fs.unlinkSync(workDirectory);
};

const sessionId = (): string | undefined => {
  throw new Error("Method not implemented");
};

const setup = (): Promise<void> => {
  tmpDir = process.env.TEMP || os.tmpdir();
  workDirectory = `${tmpDir}/${process.pid}`;
  tmpProgramName = "program";
  logFileName = `${workDirectory}/${tmpProgramName}.log`;
  listFileName = `${workDirectory}/${tmpProgramName}.lst`;
  return;
};

const run = (
  code: string,
  onLog?: (logs: LogLine[]) => void
): Promise<RunResult> => {
  const programOpts = [
    `${programName}`,
    "-batch",
    "-terminal",
    "-nosyntaxcheck",
    "-pagesize MAX",
    "-nosplash",
    `-work ${workDirectory}`,
    `-log ${logFileName}`,
    `-print ${listFileName}`,
  ];

  //add user opts to default opts
  programOpts.push(...config.sasOptions);

  //launch sas executable
  const childProcess = spawn(`${config.sasPath} ${programOpts}`);

  childProcess.stdout.on("data", (chunk) => {
    logLines.push({ type: "normal", line: chunk });
    onLog(logLines);
  });

  childProcess.stderr.on("data", (err: Error) => {
    logLines.push({ type: "error", line: err.message });
    onLog(logLines);
  });

  childProcess.on("close", (code) => {
    if (code === 0) {
      // SAS process completed successfully
      let odsHtmlFileContents: string;
      const logFileContents = fs.readFileSync(logFileName, "utf8");
      const lines = logFileContents.split(/\r?\n/);

      for (const line of lines) {
        logLines.push({
          line: line,
          type: line.startsWith("ERROR:") ? "error" : "normal",
        });

        onLog(logLines);

        const filename =
          line.match(/NOTE: .+ HTML5.* Body .+: (.+)\.htm/)?.[1] ?? "";

        if (filename) {
          odsHtmlFileName = `${workDirectory}/${filename}.htm`;
          odsHtmlFileContents = fs.readFileSync(odsHtmlFileName, {
            encoding: "utf8",
            flag: "r",
          });
          break;
        }
      }

      const runResult: RunResult = {
        html5: odsHtmlFileContents,
        title: "Results",
      };

      return runResult;
    } else {
      throw new Error("Execution failed. See log.");
    }
  });

  return;
};

export const getSession = (c: Config): Session => {
  config = c;
  return {
    setup,
    run,
    close,
    sessionId,
  };
};
