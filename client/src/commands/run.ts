// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  EventEmitter,
  Position,
  ProgressLocation,
  Selection,
  Uri,
  commands,
  l10n,
  window,
} from "vscode";
import type { BaseLanguageClient } from "vscode-languageclient";

import { showResult } from "../components/ResultPanel/ResultPanel";
import {
  appendExecutionLogFn,
  appendSessionLogFn,
} from "../components/logViewer";
import {
  assign_SASProgramFile,
  wrapCodeWithOutputHtml,
} from "../components/utils/sasCode";
import { isOutputHtmlEnabled } from "../components/utils/settings";
import {
  ErrorRepresentation,
  OnLogFn,
  RunResult,
  getSession,
} from "../connection";
import { useRunStore } from "../store";
import { profileConfig, switchProfile } from "./profile";

interface FoldingBlock {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

const { setIsExecutingCode } = useRunStore.getState();

function getCode(selected = false, uri?: Uri): string {
  const editor = uri
    ? window.visibleTextEditors.find(
        (editor) => editor.document.uri.toString() === uri.toString(),
      )
    : window.activeTextEditor;
  const doc = editor?.document;
  let codeFile = "";
  if (uri && uri.fsPath) {
    codeFile = uri.fsPath;
  } else if (doc) {
    if (doc.fileName) {
      codeFile = doc.fileName;
    } else if (doc.uri && doc.uri.fsPath) {
      codeFile = doc.uri.fsPath;
    }
  }
  let code = "";
  if (selected) {
    // run selected code if there is one or more non-empty selections, otherwise run all code

    // since you can have multiple selections, append the text for each selection in order of selection
    // note: selection ranges can be empty (ex. just a carat)
    for (const selection of editor.selections) {
      const selectedText: string = doc.getText(selection);
      code += selectedText;
    }
    // if no non-whitespace characters are selected, treat as no selection and run all code
    if (code.trim().length === 0) {
      code = doc?.getText();
    }
  } else {
    code = doc?.getText();
  }
  if (codeFile) {
    code = assign_SASProgramFile(code, codeFile);
  }
  return wrapCodeWithOutputHtml(code);
}

async function getSelectedRegions(
  client: BaseLanguageClient,
): Promise<Selection[]> {
  const result: string[] = [];

  async function pushBlock(line: number, col: number) {
    const block = await client.sendRequest<FoldingBlock>(
      "sas/getFoldingBlock",
      {
        textDocument: { uri: window.activeTextEditor.document.uri.toString() },
        line,
        col,
      },
    );
    if (block) {
      const start = doc.offsetAt(new Position(block.startLine, block.startCol));
      const end = doc.offsetAt(new Position(block.endLine, block.endCol));
      const key = `${start}-${end}`;
      if (result.indexOf(key) === -1) {
        result.push(key);
      }
      return end;
    }
  }

  const editor = window.activeTextEditor;
  const doc = editor.document;
  for (const selection of editor.selections) {
    const start = doc.offsetAt(selection.start);
    let end = doc.offsetAt(selection.end);
    const selectedText = doc.getText(selection);
    if (selectedText.endsWith("\n")) {
      --end;
    }
    for (let i = start; i <= end; i++) {
      const pos = doc.positionAt(i);
      const blockEnd = await pushBlock(pos.line, pos.character);
      if (blockEnd && blockEnd > i) {
        i = blockEnd;
      }
    }
  }
  return result.map((key) => {
    const [start, end] = key.split("-");
    return new Selection(
      doc.positionAt(parseInt(start)),
      doc.positionAt(parseInt(end)),
    );
  });
}

async function runCode(selected?: boolean, uri?: Uri) {
  if (profileConfig.getActiveProfile() === "") {
    switchProfile();
    return;
  }

  const outputHtml = isOutputHtmlEnabled();
  const code = getCode(selected, uri);

  const session = getSession();
  session.onExecutionLogFn = appendExecutionLogFn;
  session.onSessionLogFn = appendSessionLogFn;

  await session.setup();

  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: l10n.t("SAS code running..."),
      cancellable: typeof session.cancel === "function",
    },
    (_progress, cancellationToken) => {
      cancellationToken.onCancellationRequested(() => {
        session.cancel?.();
      });
      return session.run(code).then((results) => {
        if (outputHtml && results.html5) {
          showResult(results.html5, uri);
        }
      });
    },
  );
}

const _run = async (selected = false, uri?: Uri) => {
  if (useRunStore.getState().isExecutingCode) {
    return;
  }

  setIsExecutingCode(true);
  commands.executeCommand("setContext", "SAS.running", true);

  await runCode(selected, uri)
    .catch((err) => {
      onRunError(err);
    })
    .finally(() => {
      setIsExecutingCode(false);
      commands.executeCommand("setContext", "SAS.running", false);
    });
};

export async function run(): Promise<void> {
  await _run();
}

export async function runSelected(uri: Uri): Promise<void> {
  await _run(true, uri);
}

export async function runRegion(client: BaseLanguageClient): Promise<void> {
  const selections = await getSelectedRegions(client);
  window.activeTextEditor.selections = selections;
  await _run(true);
}

export function hasRunningTask() {
  return useRunStore.getState().isExecutingCode;
}
export async function runTask(
  code: string,
  messageEmitter?: EventEmitter<string>,
  closeEmitter?: EventEmitter<number>,
  onLog?: OnLogFn,
  onSessionLog?: OnLogFn,
): Promise<RunResult> {
  if (useRunStore.getState().isExecutingCode) {
    return;
  }

  if (profileConfig.getActiveProfile() === "") {
    await switchProfile();
    return;
  }

  setIsExecutingCode(true);
  commands.executeCommand("setContext", "SAS.running", true);

  let cancelled = false;
  const session = getSession();
  closeEmitter.event(async (e) => {
    if (e > 0) {
      cancelled = true;
      await session.cancel();
    }

    setIsExecutingCode(false);
    commands.executeCommand("setContext", "SAS.running", false);
  });
  session.onExecutionLogFn = onLog ?? appendExecutionLogFn;
  session.onSessionLogFn = onSessionLog ?? appendSessionLogFn;

  messageEmitter.fire(`${l10n.t("Connecting to SAS session...")}\r\n`);
  !cancelled && (await session.setup(true));

  messageEmitter.fire(`${l10n.t("SAS code running...")}\r\n`);
  return cancelled ? undefined : session.run(code);
}

const isErrorRep = (err: unknown): err is ErrorRepresentation => {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    "details" in err &&
    Array.isArray(err.details) &&
    "errorCode" in err
  ) {
    return true;
  }
  return false;
};

export const onRunError = (err) => {
  console.dir(err);

  if (err.response) {
    // The request was made and we got a status code that falls out side of the 2xx range
    const errorData = err.response.data;

    if (isErrorRep(errorData)) {
      //errorData is an error representation, extract out the details to show a better message
      const details = errorData.details;
      const options = {
        modal: true,
        detail: details.join("\n"),
      };
      window.showErrorMessage(errorData.message, options);
    } else {
      window.showErrorMessage(err.message);
    }
  } else {
    // Either the request was made but no response was received, or
    // there was an issue in the request setup itself, just show the message
    window.showErrorMessage(err.message);
  }
};
