// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";
import { describe, it } from "mocha";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

describe("Selected option completions", () => {
  const groupCases = [
    {
      name: "keeps COLOR available in a sibling option group",
      statement: "markerattrs=(color=red) datalabelattrs=( ",
      available: ["COLOR="],
      hidden: [],
    },
    {
      name: "hides COLOR already assigned in the current group",
      statement: "datalabelattrs=(CoLoR=red ",
      available: ["SIZE="],
      hidden: ["COLOR="],
    },
    {
      name: "keeps parent options available in a deeper group",
      statement: "datalabelattrs=(color=red nested=( ",
      available: ["COLOR="],
      hidden: [],
    },
    {
      name: "restores parent assignments after leaving a deeper group",
      statement: "datalabelattrs=(color=red nested=(size=10) ",
      available: ["SIZE="],
      hidden: ["COLOR="],
    },
    {
      name: "does not leak child assignments into the top-level statement",
      statement: "markerattrs=(color=red) ",
      available: ["COLOR=", "DATALABELATTRS="],
      hidden: ["MARKERATTRS="],
    },
    {
      name: "ignores parentheses and assignments inside escaped quoted text",
      statement:
        'markerattrs=(color=red) datalabelattrs=(label="a ""quoted"" )( size=10;" ',
      available: ["COLOR=", "SIZE="],
      hidden: ["LABEL="],
    },
    {
      name: "ignores parentheses and assignments inside comments",
      statement: "datalabelattrs=(color=red /* )( size=10; */ ",
      available: ["SIZE="],
      hidden: ["COLOR="],
    },
  ];

  for (const testCase of groupCases) {
    it(testCase.name, async () => {
      const text = `proc sgplot;\nscatter x=x y=y / ${testCase.statement}`;
      const document = TextDocument.create(
        "selected_group_options.sas",
        "sas",
        1,
        text,
      );
      const languageServer = new LanguageServiceProvider(document);
      const options = [
        "COLOR=",
        "SIZE=",
        "LABEL=",
        "MARKERATTRS=",
        "DATALABELATTRS=",
      ];
      const syntaxDb = languageServer.syntaxProvider.lexer.syntaxDb;
      syntaxDb.getProcedureStatementSubOptions = (
        _procName,
        _stmtName,
        _optName,
        callback,
      ) => {
        callback(options);
        return undefined;
      };
      syntaxDb.getProcedureStatementOptions = (
        _procName,
        _stmtName,
        callback,
      ) => {
        callback(options);
        return undefined;
      };

      const completion =
        await languageServer.completionProvider.getCompleteItems({
          textDocument: { uri: document.uri },
          position: document.positionAt(text.length),
        });
      assert.isDefined(completion);
      const labels = (completion?.items || []).map((item) =>
        String(item.label).toUpperCase(),
      );
      assert.includeMembers(labels, testCase.available);
      for (const hidden of testCase.hidden) {
        assert.notInclude(labels, hidden);
      }
    });
  }

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
