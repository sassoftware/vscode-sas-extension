// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  DocumentSemanticTokensProvider,
  OutputChannel,
  SemanticTokensBuilder,
  l10n,
  window,
} from "vscode";

import type { OnLogFn } from "../../connection";
import { useLogStore, useRunStore } from "../../store";
import { logSelectors, runSelectors } from "../../store/selectors";
import {
  clearLogOnExecutionStart,
  showLogOnExecutionFinish,
  showLogOnExecutionStart,
} from "../utils/settings";

const { setProducedExecutionLogOutput } = useLogStore.getState();

let outputChannel: OutputChannel;
let data: string[] = [];
let fileName = "";

export const legend = {
  tokenTypes: ["error", "warning", "note"],
  tokenModifiers: [],
};

export const LogTokensProvider: DocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens: (document) => {
    if (document.getText() === "") {
      data = [];
    }
    const tokensBuilder = new SemanticTokensBuilder(legend);

    for (let i = 0; i < data.length; i++) {
      if (legend.tokenTypes.includes(data[i])) {
        tokensBuilder.push(document.lineAt(i).range, data[i]);
      }
    }
    return tokensBuilder.build();
  },
};

/**
 * Handles log lines generated for the SAS session startup.
 * @param logs array of log lines to write.
 */
export const appendSessionLogFn: OnLogFn = (logLines) => {
  appendLogLines(logLines);
};

/**
 * Handles log lines generated for the SAS session execution.
 * @param logs array of log lines to write.
 */
export const appendExecutionLogFn: OnLogFn = (logLines) => {
  appendLogLines(logLines);

  if (!useLogStore.getState().producedExecutionOutput) {
    setProducedExecutionLogOutput(true);
  }
};

export const appendLogToken = (type: string): void => {
  data.push(type);
};

export const setFileName = (name: string) => {
  fileName = name;
};

const appendLogLines: OnLogFn = (logs) => {
  if (!outputChannel) {
    const name = clearLogOnExecutionStart()
      ? l10n.t("SAS Log: {name}", { name: fileName })
      : l10n.t("SAS Log");
    outputChannel = window.createOutputChannel(name, "sas-log");
  }
  for (const line of logs) {
    appendLogToken(line.type);
    outputChannel.appendLine(line.line.trimEnd());
  }
};

useLogStore.subscribe(
  logSelectors.selectProducedExecutionOutput,
  (producedOutput, prevProducedOutput) => {
    if (producedOutput && !prevProducedOutput) {
      if (showLogOnExecutionStart()) {
        outputChannel?.show(true);
      }
    }
  },
);

useRunStore.subscribe(
  runSelectors.selectIsExecutingCode,
  (isExecuting, prevIsExecuting) => {
    if (
      !isExecuting &&
      prevIsExecuting &&
      useLogStore.getState().producedExecutionOutput
    ) {
      if (showLogOnExecutionFinish()) {
        outputChannel?.show(true);
      }
    } else if (isExecuting && !prevIsExecuting) {
      setProducedExecutionLogOutput(false);

      if (clearLogOnExecutionStart() && outputChannel) {
        outputChannel.dispose();
        outputChannel = undefined;
        data = [];
      }
    }
  },
);
