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

const openDocFromText = (content: string, name: string): TextDocument => {
  return TextDocument.create(name, "sas", 1, content);
};

const MULTILINE_TRAIN_OPTIMIZE_CASE = [
  "proc deepprice;",
  "dnn train=(",
  "optimize=",
  ");",
  "run;",
].join("\n");

const MULTILINE_TRAIN_QUOTED_PARENS_CASE = [
  "proc deepprice;",
  "dnn train=(",
  'where=")("',
  ");",
  "run;",
].join("\n");

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

type DeepPriceSyntaxDbFallbackProbe = {
  getProcedureStatementSubOptions: (
    procName: string,
    stmtName: string,
    optName: string,
    cb: (data: string[]) => void,
  ) => string[] | undefined;
  getStatementSubOptions: (
    context: string,
    stmtName: string,
    optName: string,
    cb?: (data: string[]) => void,
  ) => string[] | undefined;
};

type DeepPriceMultilineStub = {
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

type DeepPriceQuotedStub = {
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

const stubTrainContextForMultiline = (syntaxDb: DeepPriceMultilineStub) => {
  syntaxDb.getProcedureStatementOptionValues = (
    _procName: string,
    _stmtName: string,
    _optName: string,
    cb: (data?: { values?: string[] }) => void,
  ) => {
    cb(undefined);
    return undefined;
  };

  syntaxDb.getProcedureStatementSubOptions = (
    procName: string,
    stmtName: string,
    optName: string,
    cb: (data: string[]) => void,
  ) => {
    if (procName === "DEEPPRICE" && stmtName === "DNN" && optName === "TRAIN") {
      cb(["TRAIN_CONTEXT"]);
      return undefined;
    }

    cb([]);
    return undefined;
  };
};

const stubTrainContextForQuotedParens = (syntaxDb: DeepPriceQuotedStub) => {
  syntaxDb.getProcedureStatementOptionValues = (
    _procName: string,
    _stmtName: string,
    _optName: string,
    cb: (data?: { values?: string[] }) => void,
  ) => {
    cb(undefined);
    return undefined;
  };

  syntaxDb.getProcedureStatementSubOptions = (
    procName: string,
    stmtName: string,
    optName: string,
    cb: (data: string[]) => void,
  ) => {
    if (procName === "DEEPPRICE" && stmtName === "DNN" && optName === "TRAIN") {
      cb(["TRAIN_CONTEXT"]);
      return undefined;
    }

    cb([]);
    return undefined;
  };
};

describe("DeepPrice sub-option behavior", () => {
  it("[nodes-empty] does not suggest sub-options inside nodes=()", async () => {
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

  it("[hover-lower-level] provides optimize help via SyntaxDataProvider", async () => {
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

  it("[fallback-global] falls back to global statement sub-options for DNN NODES", async () => {
    const doc = openDoc(
      "server/testFixture/deepprice/deepprice_suboptions.sas",
    );
    const languageServer = new LanguageServiceProvider(doc);
    const syntaxDb: DeepPriceSyntaxDbFallbackProbe =
      languageServer.syntaxProvider.lexer.syntaxDb;

    const sentinel = "GLOBAL_FALLBACK_SENTINEL";
    let fallbackCalled = false;
    const originalGetStatementSubOptions =
      syntaxDb.getStatementSubOptions.bind(syntaxDb);

    syntaxDb.getStatementSubOptions = (
      context: string,
      stmtName: string,
      optName: string,
      cb?: (data: string[]) => void,
    ) => {
      if (context === "global" && stmtName === "DNN" && optName === "NODES") {
        fallbackCalled = true;
        cb && cb([sentinel]);
        return [sentinel];
      }
      return originalGetStatementSubOptions(context, stmtName, optName, cb);
    };

    try {
      const data = await new Promise<string[]>((resolve) => {
        syntaxDb.getProcedureStatementSubOptions(
          "DEEPPRICE",
          "DNN",
          "NODES",
          resolve,
        );
      });

      assert.isTrue(
        fallbackCalled,
        "expected getProcedureStatementSubOptions to call global fallback for DNN NODES",
      );
      assert.include(
        data,
        sentinel,
        "expected fallback data from getStatementSubOptions(global, DNN, NODES)",
      );
    } finally {
      syntaxDb.getStatementSubOptions = originalGetStatementSubOptions;
    }
  });

  it("[hover-e2e] shows optimize hover via CompletionProvider.getHelp", async () => {
    const doc = openDocFromText(
      MULTILINE_TRAIN_OPTIMIZE_CASE,
      "deepprice_suboptions_multiline_hover.sas",
    );
    const languageServer = new LanguageServiceProvider(doc);
    Reflect.set(
      languageServer.completionProvider,
      "_addLinkContext",
      () => "OPTIMIZE hover",
    );

    const optimizeHoverPos = getPositionBySnippet(doc, "optimize=", 1);

    const hover =
      await languageServer.completionProvider.getHelp(optimizeHoverPos);

    assert.isDefined(hover, "hover should be available via CompletionProvider");
    if (!hover) {
      assert.fail("hover should be available via CompletionProvider");
      return;
    }

    const hoverText =
      typeof hover.contents === "string"
        ? hover.contents
        : Array.isArray(hover.contents)
          ? hover.contents
              .map((item) => (typeof item === "string" ? item : item.value))
              .join("\n")
          : hover.contents.value;

    assert.isNotEmpty(hoverText.trim(), "hover markdown should not be empty");
    assert.match(hoverText, /optimize/i, "hover should reference optimize");
  });

  it("[multiline-context] resolves TRAIN context on optimize line when opener is on previous line", async () => {
    const doc = openDocFromText(
      MULTILINE_TRAIN_OPTIMIZE_CASE,
      "deepprice_suboptions_multiline_context.sas",
    );
    const languageServer = new LanguageServiceProvider(doc);
    stubTrainContextForMultiline(languageServer.syntaxProvider.lexer.syntaxDb);

    const optimizePos = getPositionBySnippet(doc, "optimize", 0);
    const params = {
      textDocument: { uri: doc.uri },
      position: optimizePos,
    };

    const completion =
      await languageServer.completionProvider.getCompleteItems(params);
    const labels = completionLabels(completion?.items);

    assert.isTrue(
      labels.includes("TRAIN_CONTEXT"),
      `Expected TRAIN sub-options on optimize line in multiline train block, got: ${labels.join(", ")}`,
    );
  });

  it("[quoted-parens] keeps TRAIN context when quoted value contains parentheses", async () => {
    const doc = openDocFromText(
      MULTILINE_TRAIN_QUOTED_PARENS_CASE,
      "deepprice_suboptions_multiline_quoted.sas",
    );
    const languageServer = new LanguageServiceProvider(doc);
    stubTrainContextForQuotedParens(
      languageServer.syntaxProvider.lexer.syntaxDb,
    );

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
