import { LogLine, RunResult, Session } from "..";
import { readFileSync } from "fs";
import { resolve } from "path";
import { scriptContent } from "./script";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";

const endCode = "--vscode-sas-extension-submit-end--";

let config: Config;
let shellProcess: ChildProcessWithoutNullStreams;
let onLogFn: (logs: LogLine[]) => void;
let html5FileName: string;
let runResolve: ((value?) => void) | undefined;
let runReject: ((reason?) => void) | undefined;
let workDirectory: string;

/**
 * Configuration parameters for this connection provider
 */
export interface Config {
  sasOptions: string[];
  host: string;
}

/**
 * Initialization logic that should be performed prior to execution.
 * @returns void promise.
 */
const setup = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    runResolve = resolve;
    runReject = reject;

    if (shellProcess && !shellProcess.killed) {
      resolve();
      return; //manually terminate to avoid executing the code below
    }

    shellProcess = spawn("powershell.exe /nologo -Command -", {
      shell: true,
      env: process.env,
    });
    shellProcess.stdout.on("data", onShellStdOut);
    shellProcess.stderr.on("data", onShellStdErr);
    shellProcess.stdin.write(scriptContent + "\n", onWriteComplete);
    shellProcess.stdin.write(
      "$runner = New-Object -TypeName SASRunner\n",
      onWriteComplete
    );

    /*
    There are cases where the higher level run command will invoke setup multiple times.
    Avoid re-initializing the session when this happens. In a first run scenario a work dir
    will not exist. The work dir should only be deleted when close is invoked.
    */
    if (!workDirectory) {
      shellProcess.stdin.write(`$profileHost = "${config.host}"\n`);
      shellProcess.stdin.write(
        "$runner.Setup($profileHost)\n",
        onWriteComplete
      );
      shellProcess.stdin.write(
        "$runner.ResolveSystemVars()\n",
        onWriteComplete
      );

      if (config.sasOptions.length > 0) {
        const sasOptsInput = `$sasOpts=${formatSASOptions(
          config.sasOptions
        )}\n`;
        shellProcess.stdin.write(sasOptsInput, onWriteComplete);
        shellProcess.stdin.write(
          `$runner.SetOptions($sasOpts)\n`,
          onWriteComplete
        );
      }
    }

    // free objects in the scripting env
    process.on("exit", async () => {
      await close();
    });
  });
};

/**
 * Formats the SAS Options provided in the profile into a format
 * that the shell process can understand.
 * @param sasOptions SAS Options array from the connection profile.
 * @returns a string  denoting powershell syntax for an array literal.
 */
const formatSASOptions = (sasOptions: string[]): string => {
  const optionsVariable = `@("${sasOptions.join(`","`)}")`;
  return optionsVariable;
};

/**
 * Handles stderr output from the powershell child process.
 * @param chunk a buffer of stderr output from the child process.
 */
const onShellStdErr = (chunk: Buffer): void => {
  const msg = chunk.toString();
  console.warn("shellProcess stderr: " + msg);
  runReject(
    new Error(
      "There was an error executing the SAS Program.\nSee console log for more details."
    )
  );
};

/**
 * Generic call for use on stdin write completion.
 * @param err The error encountered on the write attempt. Undefined if no error occurred.
 */
const onWriteComplete = (err: Error): void => {
  if (err) {
    runReject?.(err);
  }
};

/**
 * Handles stdout output from the powershell child process.
 * @param data a buffer of stdout output from the child process.
 */
const onShellStdOut = (data: Buffer): void => {
  const output = data.toString().trimEnd();
  const outputLines = output.split(/\n|\r\n/);
  if (onLogFn) {
    outputLines.forEach((line: string) => {
      if (!line) {
        return;
      }
      if (line.endsWith(endCode)) {
        // run completed
        fetchResults();
      } else {
        html5FileName =
          line.match(/NOTE: .+ HTML5.* Body .+: (.+)\.htm/)?.[1] ??
          html5FileName;
        onLogFn?.([{ type: "normal", line }]);
      }
    });
  } else {
    outputLines.forEach((line) => {
      if (line.startsWith("WORKDIR=")) {
        const parts = line.split("WORKDIR=");
        workDirectory = parts[1].trim();
        runResolve();
        return;
      }
    });
  }
};

/**
 * Flushes the SAS log in chunks of [chunkSize] length,
 * writing each chunk to stdout.
 */
const fetchLog = async (): Promise<void> => {
  shellProcess.stdin.write(
    `
do {
  $chunkSize = 32768
  $log = $runner.FlushLog($chunkSize)
  Write-Host $log
} while ($log.Length -gt 0)\n
  `,
    onWriteComplete
  );
};

/**
 * Executes the given input code.
 * @param code A string of SAS code to execute.
 * @param onLog A callback handler responsible for marshalling log lines back to the higher level extension API.
 * @returns A promise that eventually resolves to contain the given {@link RunResult} for the input code execution.
 */
const run = async (
  code: string,
  onLog?: (logs: LogLine[]) => void
): Promise<RunResult> => {
  onLogFn = onLog;
  return new Promise((resolve, reject) => {
    runResolve = resolve;
    runReject = reject;

    //write ODS output to work so that the session cleans up after itself
    const codeWithODSPath = code.replace(
      "ods html5;",
      `ods html5 path="${workDirectory}";`
    );

    //write an end mnemonic so that the handler knows when execution has finished
    const codeWithEnd = `${codeWithODSPath}\n%put ${endCode};`;
    const codeToRun = `$code=@"\n${codeWithEnd}\n"@\n`;

    shellProcess.stdin.write(codeToRun);
    shellProcess.stdin.write(`$runner.Run($code)\n`, async (error) => {
      if (error) {
        runReject(error);
      }

      await fetchLog();
    });
  });
};

/**
 * Cleans up resources for the given local SAS session.
 * @returns void promise.
 */
const close = async (): Promise<void> => {
  return new Promise((resolve) => {
    if (shellProcess) {
      shellProcess.stdin.write("$runner.Close()\n", onWriteComplete);
      shellProcess.kill();
      shellProcess = undefined;

      workDirectory = undefined;
      runReject = undefined;
      runResolve = undefined;
      onLogFn = undefined;
    }
    resolve();
  });
};

/**
 * Not implemented.
 */
const sessionId = (): string => {
  throw new Error("Not Implemented");
};

/**
 * Fetches the ODS output results for the latest html results file.
 */
const fetchResults = () => {
  const htmlResults = readFileSync(
    resolve(workDirectory, html5FileName + ".htm"),
    { encoding: "utf-8" }
  );
  const runResult: RunResult = { html5: htmlResults, title: "Results" };
  runResolve(runResult);
};

/**
 * Creates a new SAS 9 Local Session.
 * @param c Instance denoting configuration parameters for this connection profile.
 * @returns  void
 */
export const getSession = (c: Config): Session => {
  config = c;
  return {
    setup,
    run,
    close,
    sessionId,
  };
};
