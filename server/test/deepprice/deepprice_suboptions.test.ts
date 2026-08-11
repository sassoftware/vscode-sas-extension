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

const getPositionBySnippet = (
  doc: TextDocument,
  snippet: string,
  offset = 0,
) => {
  const source = doc.getText();
  const index = source.indexOf(snippet);
  assert.isAtLeast(index, 0, `snippet not found: ${snippet}`);
  return doc.positionAt(index + offset);
};

const completionLabels = (items?: Array<{ label: unknown }>) =>
  (items || []).map((item) => {
    if (typeof item.label === "string") {
      return item.label.toUpperCase();
    }
    if (item.label && typeof item.label === "object") {
      const labelValue = Reflect.get(item.label, "label");
      if (typeof labelValue === "string") {
        return labelValue.toUpperCase();
      }
    }
    return "";
  });

type DeepPriceSyntaxDbStub = {
  getProcedureStatementOptionValues: (
    procName: string,
    stmtName: string,
    optName: string,
    cb: (data?: { values?: string[] }) => void,
  ) => string[] | undefined;
  getProcedureStatementSubOptions: (
    procName: string,
    stmtName: string,
    optName: string,
    cb: (data: string[]) => void,
  ) => string[] | undefined;
};

const stubDeepPriceSubOptions = (syntaxDb: DeepPriceSyntaxDbStub) => {
  syntaxDb.getProcedureStatementOptionValues = (
    procName: string,
    stmtName: string,
    optName: string,
    cb: (data?: { values?: string[] }) => void,
  ) => {
    if (
      procName === "DEEPPRICE" &&
      stmtName === "DNN" &&
      optName === "OPTIMIZE"
    ) {
      cb(undefined);
      return undefined;
    }

    cb(undefined);
    return undefined;
  };

  syntaxDb.getProcedureStatementSubOptions = (
    procName: string,
    stmtName: string,
    optName: string,
    cb: (data: string[]) => void,
  ) => {
    if (
      procName === "DEEPPRICE" &&
      stmtName === "DNN" &&
      optName === "OPTIMIZE"
    ) {
      cb(["OPTIMIZE_CONTEXT"]);
      return undefined;
    }

    if (procName === "DEEPPRICE" && stmtName === "DNN" && optName === "TRAIN") {
      cb(["TRAIN_CONTEXT"]);
      return undefined;
    }

    cb([]);
    return undefined;
  };
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

  it("suggests sub-options after optimize= in multiline train block", async () => {
    const doc = openDoc(
      "server/testFixture/deepprice/deepprice_suboptions_multiline.sas",
    );
    const languageServer = new LanguageServiceProvider(doc);
    stubDeepPriceSubOptions(languageServer.syntaxProvider.lexer.syntaxDb);

    const optimizePos = getPositionBySnippet(
      doc,
      "optimize=",
      "optimize=".length,
    );
    const params = {
      textDocument: { uri: doc.uri },
      position: optimizePos,
    };

    const completion =
      await languageServer.completionProvider.getCompleteItems(params);
    const labels = completionLabels(completion?.items);

    assert.isTrue(
      labels.includes("OPTIMIZE_CONTEXT"),
      `Expected OPTIMIZE sub-options after optimize=, got: ${labels.join(", ")}`,
    );
  });

  it("keeps parent option context when quoted value contains parentheses", async () => {
    const doc = openDoc(
      "server/testFixture/deepprice/deepprice_suboptions_multiline.sas",
    );
    const languageServer = new LanguageServiceProvider(doc);
    stubDeepPriceSubOptions(languageServer.syntaxProvider.lexer.syntaxDb);

    const quotedWherePos = getPositionBySnippet(
      doc,
      'where=")("',
      'where=")("'.length,
    );
    const params = {
      textDocument: { uri: doc.uri },
      position: quotedWherePos,
    };

    const completion =
      await languageServer.completionProvider.getCompleteItems(params);
    const labels = completionLabels(completion?.items);

    assert.isTrue(
      labels.includes("TRAIN_CONTEXT"),
      `Expected TRAIN sub-options after quoted parentheses, got: ${labels.join(", ")}`,
    );
  });
});
