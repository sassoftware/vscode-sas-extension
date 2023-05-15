import { LogLine, RunResult, Session } from "..";
import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

let config: Config;
let logLines: LogLine[] = [];
let tmpDir: string;
let workDirectory: string;
let tmpProgramName: string;
let programFullName: string;
let logFileName: string;
let listFileName: string;
let odsHtmlFileName = "";

export interface Config {
  sasPath: string;
  sasOptions: string[];
}

const close = (): void | Promise<void> => {
  logLines = [];

  // Delete the temporary files
  try {
    fs.unlinkSync(programFullName);
    fs.unlinkSync(logFileName);
    fs.unlinkSync(odsHtmlFileName);
    fs.unlinkSync(listFileName);
    fs.rmdirSync(workDirectory);
  } catch (error) {
    return Promise.reject(error);
  }
  return Promise.resolve();
};

const sessionId = (): string | undefined => {
  throw new Error("Method not implemented");
};

const setup = (): Promise<void> => {
  tmpDir = process.env.TEMP || os.tmpdir();
  workDirectory = path.join(tmpDir, `${process.pid}`);
  tmpProgramName = "program";
  logFileName = path.join(workDirectory, `${tmpProgramName}.log`);
  listFileName = path.join(workDirectory, `${tmpProgramName}.lst`);
  programFullName = path.join(workDirectory, `${tmpProgramName}.sas`);
  return Promise.resolve();
};

const run = async (
  code: string,
  onLog?: (logs: LogLine[]) => void
): Promise<RunResult> => {
  const codeWithODSPath = code.replace(
    "ods html5;",
    `ods html5 path="${workDirectory}";`
  );

  const programOpts = [
    `-sysin "${programFullName}"`,
    "-batch",
    "-terminal",
    "-nosyntaxcheck",
    "-pagesize MAX",
    "-nosplash",
    "-nologo",
    `-work "${workDirectory}"`,
    `-log "${logFileName}"`,
    `-print "${listFileName}"`,
  ];

  fs.mkdirSync(workDirectory, { recursive: true });
  fs.writeFileSync(programFullName, codeWithODSPath);

  //add user opts to default opts
  programOpts.push(...config.sasOptions);
  const programOptsStr = programOpts.join(" ");

  //launch sas executable

  const childProcess = spawn(`${config.sasPath} ${programOptsStr}`, {
    shell: true,
    cwd: workDirectory,
  });

  childProcess.stdout.on("data", (chunk) => {
    logLines.push({ type: "normal", line: chunk });
    onLog(logLines);
    throw new Error("failed");
  });

  childProcess.stderr.on("data", (err: Error) => {
    logLines.push({ type: "error", line: err.message });
    onLog(logLines);
    throw new Error("failed");
  });

  const rc = await new Promise((resolve, reject) => {
    childProcess.on("exit", resolve);
    childProcess.on("error", reject);
  });

  let runResult: RunResult;
  if (rc === 0) {
    // SAS process completed successfully
    let odsHtmlFileContents: string;
    const logFileContents = fs.readFileSync(logFileName, "utf8");
    const lines = logFileContents.split(/\r?\n/);

    for (const line of lines) {
      const logline: LogLine = {
        line: line,
        type: line.startsWith("ERROR:") ? "error" : "normal",
      };
      logLines.push(logline);

      onLog([logline]);

      const filename =
        line.match(/NOTE: .+ HTML5.* Body .+: (.+)\.htm/)?.[1] ?? "";

      if (filename) {
        odsHtmlFileName = `${workDirectory}/${filename}.htm`;
        odsHtmlFileContents = fs.readFileSync(odsHtmlFileName, {
          encoding: "utf8",
          flag: "r",
        });
      }
    }

    runResult = {
      html5: odsHtmlFileContents,
      title: "Results",
    };
  } else {
    throw new Error("Execution failed. See log.");
  }

  return runResult;
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
