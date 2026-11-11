// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";
import { describe, it } from "mocha";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

describe("Selected option completions", () => {
  it("does not suggest options already assigned in the current PROC statement", async () => {
    const text = "proc scoreaccel sessref=mysess sess";
    const document = TextDocument.create(
      "selected_options.sas",
      "sas",
      1,
      text,
    );
    const languageServer = new LanguageServiceProvider(document);
    languageServer.syntaxProvider.lexer.syntaxDb.getProcedureOptions = (
      _procName: string,
      callback: (data?: string[]) => void,
    ) => {
      callback(["SESSREF=", "OTHER="]);
      return undefined;
    };

    const completion = await languageServer.completionProvider.getCompleteItems(
      {
        textDocument: { uri: document.uri },
        position: document.positionAt(text.length),
      },
    );

    const labels = (completion?.items || []).map((item) =>
      String(item.label).toUpperCase(),
    );
    assert.notInclude(labels, "SESSREF=");
    assert.include(labels, "OTHER=");
  });
});
