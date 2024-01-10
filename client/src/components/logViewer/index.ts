// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  DocumentSemanticTokensProvider,
  OutputChannel,
  SemanticTokensBuilder,
  l10n,
  window,
} from "vscode";

import { useLogStore, useRunStore } from "../../store";
import { logSelectors, runSelectors } from "../../store/selectors";
import {
  showLogOnExecutionFinish,
  showLogOnExecutionStart,
} from "../utils/settings";

const { clearLog, unsetProducedExecutionOutput } = useLogStore.getState();

let outputChannel: OutputChannel;

export const legend = {
  tokenTypes: ["error", "warning", "note"],
  tokenModifiers: [],
};

export const LogTokensProvider: DocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens: (document) => {
    if (document.getText() === "") {
      clearLog();
    }
    const tokensBuilder = new SemanticTokensBuilder(legend);
    const dataTokens = useLogStore.getState().logTokens;

    for (let i = 0; i < dataTokens.length; i++) {
      if (legend.tokenTypes.includes(dataTokens[i])) {
        tokensBuilder.push(document.lineAt(i).range, dataTokens[i]);
      }
    }
    return tokensBuilder.build();
  },
};

useLogStore.subscribe(logSelectors.selectLogLines, (lines, prevLines) => {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel(l10n.t("SAS Log"), "sas-log");
  }

  const delta = lines.filter((x) => !prevLines.includes(x));

  for (const line of delta) {
    outputChannel.appendLine(line.line);
  }
});

useLogStore.subscribe(
  logSelectors.selectProducedExecutionOutput,
  (producedOutput, prevProducedOutput) => {
    if (producedOutput && !prevProducedOutput) {
      if (showLogOnExecutionStart()) {
        outputChannel.show(true);
      }
    }
  },
);

useRunStore.subscribe(
  runSelectors.selectIsExecutingCode,
  (isExecuting, prevIsExecuting) => {
    if (!isExecuting && prevIsExecuting) {
      if (showLogOnExecutionFinish()) {
        outputChannel.show(true);
      }
    } else if (isExecuting && !prevIsExecuting) {
      unsetProducedExecutionOutput();
    }
  },
);
