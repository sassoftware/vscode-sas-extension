import { ChildProcessWithoutNullStreams } from "child_process";

import { Config } from "./types";
import { runSetup, spawnPowershellProcess } from "./util";

class CodeRunner {
  protected pollingForLogResults: boolean = false;
  protected log: string[] = [];
  protected endTag: string = "";
  protected outputFinished: boolean = false;
  protected shellProcess: ChildProcessWithoutNullStreams;
  protected resultInterval;
  protected sasSystemLine: string;

  public constructor(
    protected readonly processId: string,
    protected readonly onCodeExecutionFinished: (processId: string) => void,
  ) {}

  public async runCode(
    code: string,
    startTag: string,
    endTag: string,
    config: Config,
    password: string,
  ): Promise<string> {
    this.shellProcess = spawnPowershellProcess(
      this.onWriteComplete,
      this.onStdOutput,
      this.onStdError,
    );

    runSetup(this.shellProcess, config, password, this.onWriteComplete);

    const results = await new Promise<string>((resolve, reject) => {
      this.pollingForLogResults = true;
      this.shellProcess.stdin.write(
        `$code=\n@'\n${code}\n'@\n$runner.Run($code)\n`,
        async (error) => {
          if (error) {
            return reject(error);
          }

          const response = await this.pollUntilEnd(startTag, endTag);
          resolve(response);
        },
      );
    });

    return results;
  }

  protected async pollUntilEnd(
    startTag: string,
    endTag: string,
  ): Promise<string> {
    this.log = [];
    this.endTag = endTag;
    this.outputFinished = false;
    await this.fetchLog();

    return await new Promise<string>((resolve) => {
      if (this.resultInterval) {
        clearInterval(this.resultInterval);
      }
      this.resultInterval = setInterval(() => {
        if (this.outputFinished) {
          let logText = this.log.join("");

          // Lets filter our log text such that we don't have empty lines,
          // or lines that just include "The SAS System"
          logText = logText
            .split("\n")
            .filter((str) => str.trim() && !str.includes(this.sasSystemLine))
            .join("\n");

          resolve(
            logText
              .slice(logText.lastIndexOf(startTag))
              .replace(startTag, "")
              .replace(endTag, ""),
          );
          clearInterval(this.resultInterval);
        }
      }, 100);
    });
  }

  private fetchLog = async (): Promise<void> => {
    const pollingInterval = setInterval(() => {
      if (!this.pollingForLogResults) {
        clearInterval(pollingInterval);
      }
      this.shellProcess.stdin.write(
        `
  do {
    $chunkSize = 32768
    $log = $runner.FlushLog($chunkSize)
    Write-Host $log
  } while ($log.Length -gt 0)\n
    `,
        this.onWriteComplete,
      );
    }, 2 * 1000);
  };

  protected onWriteComplete = (error: Error) => {
    this.pollingForLogResults = false;
    console.log(error);
  };

  protected onStdError = (data: Buffer) => {
    console.log(data.toString());
  };

  protected onStdOutput = (data: Buffer) => {
    const line = data.toString();

    const sasSystemRegex = /1\s{4,}(.*)\s{4,}/;
    if (sasSystemRegex.test(line) && !this.sasSystemLine) {
      this.sasSystemLine = line.match(sasSystemRegex)[1].trim();
    }

    this.log.push(line);

    if (this.endTag && line.includes(this.endTag)) {
      this.outputFinished = true;
      this.shellProcess.kill();
      this.onCodeExecutionFinished(this.processId);
    }
  };
}

export default CodeRunner;
