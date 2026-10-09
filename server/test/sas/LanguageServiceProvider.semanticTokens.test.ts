import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import {
  LanguageServiceProvider,
  legend,
} from "../../src/sas/LanguageServiceProvider";

describe("SAS semantic token ranges", () => {
  ["\n", "\r\n"].forEach((lineEnding) => {
    it(`keeps ranges within line content for ${JSON.stringify(lineEnding)}`, () => {
      const content = `/* start of comment${lineEnding}continued comment${lineEnding}end of comment */${lineEnding}title "value";${lineEnding}`;
      const document = TextDocument.create(
        "semantic-token-ranges.sas",
        "sas",
        1,
        content,
      );
      const tokens = new LanguageServiceProvider(document).getTokens();
      const lines = content.split(/\r\n|\r|\n/);
      let line = 0;
      let start = 0;
      let foundEndOfLineComment = false;

      assert.isNotEmpty(tokens);
      assert.equal(tokens.length % 5, 0);

      for (let i = 0; i < tokens.length; i += 5) {
        const deltaLine = tokens[i];
        line += deltaLine;
        start = deltaLine === 0 ? start + tokens[i + 1] : tokens[i + 1];

        const length = tokens[i + 2];
        assert.isAtLeast(length, 0);
        assert.isAtMost(
          start + length,
          lines[line].length,
          `semantic token on line ${line + 1} extends past line content`,
        );

        if (
          line === 0 &&
          tokens[i + 3] === legend.tokenTypes.indexOf("comment")
        ) {
          foundEndOfLineComment = true;
          assert.equal(start + length, lines[line].length);
        }
      }

      assert.isTrue(
        foundEndOfLineComment,
        "expected a semantic comment token on the newline-terminated line",
      );
    });
  });
});