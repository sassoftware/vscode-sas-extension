import { commands } from "vscode";

import { ChildProcessWithoutNullStreams } from "child_process";
import { createHash } from "crypto";

import { getSession } from "..";
import { useRunStore } from "../../store";

class CodeRunner {
  protected pollingForLogResults: boolean = false;
  protected log: string[] = [];
  protected endTag: string = "";
  protected outputFinished: boolean = false;
  protected shellProcess: ChildProcessWithoutNullStreams;
  protected awaitExecutionInterval;
  protected sasSystemLine: string;
  protected executionIntervals: Record<string, ReturnType<typeof setInterval>> =
    {};

  public async runCode(
    code: string,
    startTag: string = "",
    endTag: string = "",
  ): Promise<string> {
    const key = createHash("md5")
      .update(code + startTag + endTag)
      .digest("hex");
    await new Promise((resolve) => {
      if (this.executionIntervals[key]) {
        clearInterval(this.executionIntervals[key]);
      }

      this.executionIntervals[key] = setInterval(() => {
        if (!useRunStore.getState().isExecutingCode) {
          clearInterval(this.executionIntervals[key]);
          return resolve(true);
        }
      }, 200);
    });

    const { setIsExecutingCode } = useRunStore.getState();
    setIsExecutingCode(true);
    commands.executeCommand("setContext", "SAS.running", true);

    const session = getSession();
    await session.setup(true);

    // Lets prevent anything from being appended to our log
    const onSessionLogFn = session.onSessionLogFn;
    const onExecutionLogFn = session.onExecutionLogFn;
    session.onSessionLogFn = () => {};
    session.onExecutionLogFn = () => {};

    const { logOutput } = await session.run(code);
    const logText =
      startTag && endTag
        ? logOutput
            .slice(
              logOutput.lastIndexOf(startTag),
              logOutput.lastIndexOf(endTag),
            )
            .replace(startTag, "")
            .replace(endTag, "")
        : logOutput;

    // Lets update our session to write to the log
    session.onSessionLogFn = onSessionLogFn;
    session.onExecutionLogFn = onExecutionLogFn;

    setIsExecutingCode(false);
    commands.executeCommand("setContext", "SAS.running", false);
    delete this.executionIntervals[key];

    return logText;
  }
}

export default CodeRunner;
