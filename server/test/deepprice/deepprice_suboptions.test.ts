// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";
import fs from "fs";
import { describe, it } from "mocha";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";
import { HelpData } from "../../src/sas/SyntaxDataProvider";

const openDoc = (path: string): TextDocument => {
  const content = fs.readFileSync(path, {
    encoding: "utf-8",
  });
  return TextDocument.create(path, "sas", 1, content);
};

describe("DeepPrice sub-option behavior", () => {
  it("does not suggest sub-options for nodes=()", async () => {
    const doc = openDoc(
      "server/testFixture/deepprice/deepprice_suboptions.sas",
    );
    const languageServer = new LanguageServiceProvider(doc);

    const nodesLine = doc.getText().split("\n")[1];
    const nodesParenIdx = nodesLine.indexOf("(");

    const params = {
      textDocument: { uri: doc.uri },
      position: { line: 1, character: nodesParenIdx + 1 },
    };

    const completion =
      await languageServer.completionProvider.getCompleteItems(params);

    assert.isTrue(
      completion === undefined || completion.items.length === 0,
      "nodes=() should not have sub-option completions",
    );
  });

  it("shows hover help for optimize in train=(optimize=)", async () => {
    const doc = openDoc(
      "server/testFixture/deepprice/deepprice_suboptions.sas",
    );
    const languageServer = new LanguageServiceProvider(doc);

    const help = await new Promise<HelpData | undefined>((resolve) => {
      languageServer.syntaxProvider.lexer.syntaxDb.getProcedureStatementSubOptionHelp(
        "DEEPPRICE",
        "DNN",
        "TRAIN",
        "OPTIMIZE",
        resolve,
      );
    });

    assert.isDefined(help, "help should be available for optimize");
    if (!help) {
      assert.fail("help should be available for optimize");
      return;
    }
    assert.isNotEmpty(help.data || "", "description should not be empty");
    assert.isNotEmpty(help.syntax || "", "syntax should not be empty");
  });
});
