// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  DocumentSemanticTokensProvider,
  OutputChannel,
  SemanticTokensBuilder,
  l10n,
  window,
} from "vscode";

import { useStore } from "../../store";
import { logSelectors } from "../../store/selectors";

const { clearDataLogTokens } = useStore.getState();

let outputChannel: OutputChannel;

export const legend = {
  tokenTypes: ["error", "warning", "note"],
  tokenModifiers: [],
};

export const LogTokensProvider: DocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens: (document) => {
    if (document.getText() === "") {
      clearDataLogTokens();
    }
    const tokensBuilder = new SemanticTokensBuilder(legend);
    const dataTokens = useStore.getState().logTokens;

    for (let i = 0; i < dataTokens.length; i++) {
      if (legend.tokenTypes.includes(dataTokens[i])) {
        tokensBuilder.push(document.lineAt(i).range, dataTokens[i]);
      }
    }
    return tokensBuilder.build();
  },
};

useStore.subscribe(logSelectors.selectIsOutputChannelOpen, (open) => {
  if (open) {
    outputChannel.show(true);
  }
});

useStore.subscribe(logSelectors.selectLogLines, (lines, prevLines) => {
  if (!outputChannel) {
    outputChannel = window.createOutputChannel(l10n.t("SAS Log"), "sas-log");
  }

  const delta = lines.filter((x) => !prevLines.includes(x));

  for (const line of delta) {
    outputChannel.appendLine(line.line);
  }
});
