import { LogLine, RunResult, Session } from "..";
import * as fs from "fs";
import path = require("path");
import { scriptContent } from "./script";
import { ChildProcessWithoutNullStreams, spawn } from "child_process";

const endCode = "--vscode-sas-extension-submit-end--";

let config: Config;
let shellProcess: ChildProcessWithoutNullStreams;
let onLogFn: (logs: LogLine[]) => void
let html5FileName: string;
let runResolve: ((value?) => void) | undefined;
let runReject: ((reason?) => void) | undefined;
let workDirectory: string;

export interface Config {
  sasOptions: string[];
}

const setup = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    runResolve = resolve;
    runReject = reject;

    if (shellProcess && !shellProcess.killed) {
      resolve();
      return;
    }

    shellProcess = spawn("powershell.exe /nologo -Command -", { shell: true, env: process.env });
    shellProcess.stdout.on("data", onShellStdOut);
    shellProcess.stderr.on("data", onShellStdErr);
    shellProcess.stdin.write(scriptContent + "\n", onWriteComplete);
    shellProcess.stdin.write("$runner = New-Object -TypeName SASRunner\n", onWriteComplete);

    if(!workDirectory){
      shellProcess.stdin.write("$runner.Setup()\n", onWriteComplete);
      shellProcess.stdin.write("$runner.ResolveSystemVars()\n", onWriteComplete);            
     
    }
  
    // need to free objects in the scripting env
    process.on("exit", async() => {
      await close();
    });
  });
};

const onShellStdErr = (chunk: Buffer):void => {
  const msg = chunk.toString();
  console.warn("shellProcess stderr: " + msg);
  runReject(new Error("There was an error executing the SAS Program.\nSee console log for more details."));

};

const onWriteComplete = (err: Error): void => {
  if(err){
   runReject?.(err);
  }
}
const onShellStdOut = (data: Buffer): void => {
  const output = data.toString().trimEnd();
  const outputLines = output.split(/\n|\r\n/);
  if (onLogFn) {
    outputLines.forEach((line:string) => {
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
  } else{
    outputLines.forEach((line) => {
      if(line.startsWith("WORKDIR=")){
        const parts = line.split("WORKDIR=");
        workDirectory = parts[1].trim();
        runResolve();
        return;
      }
    })
  } 
};

const fetchLog = async(): Promise<void> => {
  shellProcess.stdin.write(`
do {
  $chunkSize = 32768
  $log = $runner.FlushLog($chunkSize)
  Write-Host $log
} while ($log.Length -gt 0)\n
  `,onWriteComplete);
};

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

    shellProcess.stdin.write(`$code=@"\n${codeWithEnd}\n"@\n`);
    shellProcess.stdin.write(`$runner.Run($code)\n`, async (error) => {
      if (error) {
        runReject(error);
      }
      
      await fetchLog();
      
    });
  });
};

const close = async (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (shellProcess) {
      shellProcess.stdin.write("$runner.Close()\n", onWriteComplete);
      shellProcess.kill();
      shellProcess = undefined;
      workDirectory = undefined;
      runReject = undefined;
      runResolve = undefined;
      onLogFn = undefined;
    }
  });
};

const sessionId = (): string => {
  throw new Error("Not Implemented");
};

const fetchResults = () => {
  const htmlResults = fs.readFileSync(path.resolve(workDirectory, html5FileName+".htm"), {encoding:"utf-8"});
  const runResult:RunResult = {html5: htmlResults, title: "Results"};
  runResolve(runResult);
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




