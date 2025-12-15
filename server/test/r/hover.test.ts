// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { HoverParams, Position } from "vscode-languageserver";
import { CancellationToken } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";
import { describe, it } from "mocha";

import { RLanguageProviderNode } from "../../src/r/node/RLanguageProviderNode";
import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

describe("R Hover Support", () => {
  let rProvider: RLanguageProviderNode;
  let mockDoc: TextDocument;

  beforeEach(() => {
    // Create a simple mock connection for testing
    const mockConnection = {
      console: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        log: (_message: string) => {
          // Mock console log
        },
      },
    };

    // Create R provider
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rProvider = new RLanguageProviderNode(mockConnection as any);

    // Create a mock SAS document with R code
    const sasContent = `proc rlang;
submit;
x <- c(1, 2, 3, 4, 5)
result <- mean(x)
print(result)
endsubmit;
run;`;

    mockDoc = TextDocument.create("file:///test.sas", "sas", 1, sasContent);

    // Set up mock language service provider
    const languageService = new LanguageServiceProvider(mockDoc);
    rProvider.setSasLspProvider(() => languageService);
  });

  it("should provide hover documentation for R function 'mean'", async () => {
    const params: HoverParams = {
      textDocument: { uri: mockDoc.uri },
      position: Position.create(3, 12), // Position of 'mean'
    };

    const hover = await rProvider.onHover(params, CancellationToken.None);

    assert.isNotNull(hover);
    if (
      hover &&
      typeof hover.contents !== "string" &&
      !Array.isArray(hover.contents)
    ) {
      assert.include(hover.contents.value, "mean");
      assert.include(hover.contents.value, "arithmetic mean");
    }
  });

  it("should provide hover documentation for R function 'print'", async () => {
    const params: HoverParams = {
      textDocument: { uri: mockDoc.uri },
      position: Position.create(4, 1), // Position of 'print'
    };

    const hover = await rProvider.onHover(params, CancellationToken.None);

    assert.isNotNull(hover);
    if (
      hover &&
      typeof hover.contents !== "string" &&
      !Array.isArray(hover.contents)
    ) {
      const lower = hover.contents.value.toLowerCase();
      assert.include(lower, "print");
      // Check for key terms from R help documentation
      assert.match(lower, /print|value|argument/);
    }
  });

  it("should provide hover documentation for R function 'c'", async () => {
    const params: HoverParams = {
      textDocument: { uri: mockDoc.uri },
      position: Position.create(2, 6), // Position of 'c'
    };

    const hover = await rProvider.onHover(params, CancellationToken.None);

    assert.isNotNull(hover);
    if (
      hover &&
      typeof hover.contents !== "string" &&
      !Array.isArray(hover.contents)
    ) {
      const lower = hover.contents.value.toLowerCase();
      // Check for key terms from R help documentation
      assert.match(lower, /combine|vector|concatenate/);
    }
  });

  it("should provide hover for variables from source code", async () => {
    const params: HoverParams = {
      textDocument: { uri: mockDoc.uri },
      position: Position.create(2, 1), // Position of variable 'x'
    };

    const hover = await rProvider.onHover(params, CancellationToken.None);

    // Variables should show their definition from source code
    assert.isNotNull(hover);
    if (
      hover &&
      typeof hover.contents !== "string" &&
      !Array.isArray(hover.contents)
    ) {
      assert.include(hover.contents.value, "c(1, 2, 3, 4, 5)");
    }
  });

  it("should return null when cursor is not on an R symbol", async () => {
    const params: HoverParams = {
      textDocument: { uri: mockDoc.uri },
      position: Position.create(0, 0), // Position at 'proc'
    };

    const hover = await rProvider.onHover(params, CancellationToken.None);

    assert.isNull(hover);
  });

  it("should handle data.frame function", async () => {
    const sasContent2 = `proc rlang;
submit;
df <- data.frame(x = 1:5, y = letters[1:5])
endsubmit;
run;`;

    const mockDoc2 = TextDocument.create(
      "file:///test2.sas",
      "sas",
      1,
      sasContent2,
    );

    const languageService2 = new LanguageServiceProvider(mockDoc2);
    rProvider.setSasLspProvider(() => languageService2);

    const params: HoverParams = {
      textDocument: { uri: mockDoc2.uri },
      position: Position.create(2, 8), // Position of 'data.frame'
    };

    const hover = await rProvider.onHover(params, CancellationToken.None);

    assert.isNotNull(hover);
    if (
      hover &&
      typeof hover.contents !== "string" &&
      !Array.isArray(hover.contents)
    ) {
      const lower = hover.contents.value.toLowerCase();
      // Check for key terms from R help documentation
      assert.match(lower, /data.*frame|dataframe|tightly.*coupled/);
    }
  });

  it("should return null for undefined symbols", async () => {
    const sasContent3 = `proc rlang;
submit;
x <- undefined_function()
endsubmit;
run;`;

    const mockDoc3 = TextDocument.create(
      "file:///test3.sas",
      "sas",
      1,
      sasContent3,
    );

    const languageService3 = new LanguageServiceProvider(mockDoc3);
    rProvider.setSasLspProvider(() => languageService3);

    const params: HoverParams = {
      textDocument: { uri: mockDoc3.uri },
      position: Position.create(2, 7), // Position of 'undefined_function'
    };

    const hover = await rProvider.onHover(params, CancellationToken.None);

    // Undefined functions should return null
    assert.isNull(hover);
  });

  it("should return markdown formatted content", async () => {
    const params: HoverParams = {
      textDocument: { uri: mockDoc.uri },
      position: Position.create(3, 12), // Position of 'mean'
    };

    const hover = await rProvider.onHover(params, CancellationToken.None);

    assert.isNotNull(hover);
    if (
      hover &&
      typeof hover.contents !== "string" &&
      !Array.isArray(hover.contents)
    ) {
      assert.include(hover.contents.value, "```r");
      assert.include(hover.contents.value, "mean(");
    }
  });
});
