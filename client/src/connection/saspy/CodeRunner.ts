// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { commands } from "vscode";

import { SASPYSession } from ".";
import { LogLine, getSession } from "..";
import { useRunStore } from "../../store";

let wait: Promise<string> | undefined;

export async function runCode(
  code: string,
  startTag: string = "",
  endTag: string = "",
): Promise<string> {
  const task = () => _runCode(code, startTag, endTag);

  wait = wait ? wait.then(task) : task();
  return wait;
}

async function _runCode(
  code: string,
  startTag: string = "",
  endTag: string = "",
): Promise<string> {
  // If we're already executing code, lets wait for it
  // to finish up.
  let unsubscribe;
  if (useRunStore.getState().isExecutingCode) {
    await new Promise((resolve) => {
      unsubscribe = useRunStore.subscribe(
        (state) => state.isExecutingCode,
        (isExecutingCode) => !isExecutingCode && resolve(true),
      );
    });
  }

  const { setIsExecutingCode } = useRunStore.getState();
  setIsExecutingCode(true, false);
  commands.executeCommand("setContext", "SAS.running", true);
  const session = getSession();

  let logText = "";
  const onExecutionLogFn = session.onExecutionLogFn;
  const outputLines = [];

  const addLine = (logLines: LogLine[]) =>
    outputLines.push(...logLines.map(({ line }) => line));

  try {
    await session.setup(true);

    // Lets capture output to use it on
    session.onExecutionLogFn = addLine;

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    await (session as SASPYSession).run(code)

    const logOutput = outputLines.filter((line) => line.trim()).join("");

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
    unsubscribe && unsubscribe();
    // Lets update our session to write to the log
    session.onExecutionLogFn = onExecutionLogFn;

    setIsExecutingCode(false);
    commands.executeCommand("setContext", "SAS.running", false);
  }

  return logText;
}
