// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { DocumentSemanticTokensProvider, SemanticTokensBuilder } from "vscode";

let data: string[] = [];

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

export const appendLog = (type: string): void => {
  data.push(type);
};
