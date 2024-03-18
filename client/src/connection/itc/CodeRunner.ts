// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { commands } from "vscode";

import { ITCSession } from ".";
import { LogLine, getSession } from "..";
import { useRunStore } from "../../store";

class CodeRunner {
  protected executionInterval: ReturnType<typeof setInterval>;

  public async runCode(
    code: string,
    startTag: string = "",
    endTag: string = "",
  ): Promise<string> {
    // If we're already executing code, lets wait for it
    // to finish up.
    if (useRunStore.getState().isExecutingCode) {
      await new Promise((resolve) => {
        if (this.executionInterval) {
          clearInterval(this.executionInterval);
        }

        this.executionInterval = setInterval(() => {
          if (!useRunStore.getState().isExecutingCode) {
            clearInterval(this.executionInterval);
            return resolve(true);
          }
        }, 200);
      });
    }

    const { setIsExecutingCode } = useRunStore.getState();
    setIsExecutingCode(true);
    commands.executeCommand("setContext", "SAS.running", true);
    const session = getSession();

    let logText = "";
    const onSessionLogFn = session.onSessionLogFn;
    const onExecutionLogFn = session.onExecutionLogFn;
    const outputLines = [];

    const addLine = (logLines: LogLine[]) =>
      outputLines.push(...logLines.map(({ line }) => line));

    try {
      await session.setup(true);

      // Lets capture output to use it later
      session.onSessionLogFn = addLine;
      session.onExecutionLogFn = addLine;

      await session.run(code);

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const sasSystemLine = (session as ITCSession).sasSystemLine;
      // Lets gather our log output, excluding any string including the system
      // line (NOTE: This is necessary for large log outputs that span multiple
      // "pages")
      const logOutput = outputLines
        .filter((line) =>
          sasSystemLine
            ? line.trim() && !line.includes(sasSystemLine)
            : line.trim(),
        )
        .join("");

      logText =
        startTag && endTag
          ? logOutput
              .slice(
                logOutput.lastIndexOf(startTag),
                logOutput.lastIndexOf(endTag),
              )
              .replace(startTag, "")
              .replace(endTag, "")
          : logOutput;
    } finally {
      // Lets update our session to write to the log
      session.onSessionLogFn = onSessionLogFn;
      session.onExecutionLogFn = onExecutionLogFn;

      setIsExecutingCode(false);
      commands.executeCommand("setContext", "SAS.running", false);
    }

    return logText;
  }
}

export default CodeRunner;
