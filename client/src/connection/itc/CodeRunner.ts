import { ChildProcessWithoutNullStreams } from "child_process";
import { ChildProcessWithoutNullStreams } from "child_process";
import { v4 } from "uuid";

import { profileConfig } from "../../commands/profile";
import {
  LibraryAdapter,
  LibraryItem,
  TableData,
} from "../../components/LibraryNavigator/types";
import { ConnectionType } from "../../components/profile";
import { ColumnCollection, TableInfo } from "../rest/api/compute";
import CodeRunner from "./CodeRunner";
import PasswordStore from "./PasswordStore";
import { Config, ITCProtocol } from "./types";
import { defaultSessionConfig, runSetup, spawnPowershellProcess } from "./util";

class CodeRunner {
  protected pollingForLogResults: boolean = false;
  protected log: string[] = [];
  protected endTag: string = "";
  protected outputFinished: boolean = false;
  protected shellProcess: ChildProcessWithoutNullStreams;
  protected resultInterval;

  public constructor(
    protected readonly processId: string,
    protected readonly onCodeExecutionFinished: (processId: string) => void,
  ) {
  }

  public async runCode(
    code: string,
    startTag: string,
    endTag: string,
    config: Config,
    password: string
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
          const logText = this.log.join("");
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
    console.log(data.toString());
    const line = data.toString();
    this.log.push(line);
    if (this.endTag && line.includes(this.endTag)) {
      this.outputFinished = true;
      this.shellProcess.kill();
      this.onCodeExecutionFinished(this.processId);
    }
  };
}

export default CodeRunner;
