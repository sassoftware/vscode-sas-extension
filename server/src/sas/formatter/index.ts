// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { TextEdit } from "vscode-languageserver-protocol";

import type { Options, Plugin } from "prettier";
import { format } from "prettier/standalone";

import type { Token } from "../Lexer";
import type { Model } from "../Model";
import type { SyntaxProvider } from "../SyntaxProvider";
import { SASAST, getParser } from "./parser";
import { print } from "./printer";

const getSasPlugin = (
  model: Model,
  tokens: Token[],
  syntaxProvider: SyntaxProvider,
): Plugin<SASAST> => ({
  languages: [
    {
      name: "sas",
      parsers: ["sas"],
      extensions: [".sas"],
      vscodeLanguageIds: ["sas"],
    },
  ],
  parsers: {
    sas: {
      parse: getParser(model, tokens, syntaxProvider),
      astFormat: "sas-ast",
      locStart: () => 0,
      locEnd: () => 0,
    },
  },
  printers: {
    "sas-ast": {
      print,
    },
  },
});

export class Formatter {
  private tokens: Token[] = [];

  constructor(
    private model: Model,
    private syntaxProvider: SyntaxProvider,
  ) {
    this.syntaxProvider.setTokenCallback(this.tokens.push.bind(this.tokens));
  }

  async format(options: Options): Promise<TextEdit[]> {
    const formattedText = await format("text", {
      parser: "sas",
      plugins: [getSasPlugin(this.model, this.tokens, this.syntaxProvider)],
      ...options,
    });
    return [
      {
        range: {
          start: { line: 0, character: 0 },
          end: { line: this.model.getLineCount(), character: 0 },
        },
        newText: formattedText,
      },
    ];
  }
}
