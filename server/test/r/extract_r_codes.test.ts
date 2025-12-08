// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { extractRCodes } from "../../src/r/utils";
import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

describe("R Code Extraction", () => {
  it("extracts simple R code from PROC RLANG", () => {
    const sasCode = `proc rlang;
submit;
x <- c(1, 2, 3)
mean(x)
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const rCode = extractRCodes(doc, languageService);

    assert.include(rCode, "x <- c(1, 2, 3)");
    assert.include(rCode, "mean(x)");
    assert.notInclude(rCode, "proc rlang");
    assert.notInclude(rCode, "endsubmit");
  });

  it("extracts R code from multiple PROC RLANG blocks", () => {
    const sasCode = `proc rlang;
submit;
x <- 1:10
endsubmit;
run;

data _null_;
  put "SAS code";
run;

proc rlang;
submit;
y <- mean(x)
print(y)
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const rCode = extractRCodes(doc, languageService);

    assert.include(rCode, "x <- 1:10");
    assert.include(rCode, "y <- mean(x)");
    assert.include(rCode, "print(y)");
    assert.notInclude(rCode, 'put "SAS code"');
  });

  it("handles R code with comments", () => {
    const sasCode = `proc rlang;
submit;
# This is an R comment
x <- c(1, 2, 3)
# Calculate mean
mean(x)
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const rCode = extractRCodes(doc, languageService);

    assert.include(rCode, "# This is an R comment");
    assert.include(rCode, "# Calculate mean");
  });

  it("handles R code with multiline strings", () => {
    const sasCode = `proc rlang;
submit;
text <- "Hello
World"
cat(text)
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const rCode = extractRCodes(doc, languageService);

    assert.include(rCode, "text <-");
    assert.include(rCode, "cat(text)");
  });

  it("handles R code with loops and control structures", () => {
    const sasCode = `proc rlang;
submit;
for (i in 1:10) {
  print(i)
  if (i == 5) {
    break
  }
}
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const rCode = extractRCodes(doc, languageService);

    assert.include(rCode, "for (i in 1:10)");
    assert.include(rCode, "print(i)");
    assert.include(rCode, "if (i == 5)");
    assert.include(rCode, "break");
  });

  it("handles R code with function definitions", () => {
    const sasCode = `proc rlang;
submit;
my_func <- function(x, y) {
  result <- x + y
  return(result)
}
z <- my_func(5, 3)
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const rCode = extractRCodes(doc, languageService);

    assert.include(rCode, "my_func <- function(x, y)");
    assert.include(rCode, "return(result)");
    assert.include(rCode, "z <- my_func(5, 3)");
  });

  it("returns empty string when no PROC RLANG blocks exist", () => {
    const sasCode = `data _null_;
  x = 5;
  put x=;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const rCode = extractRCodes(doc, languageService);

    assert.equal(rCode, "");
  });

  it("handles empty PROC RLANG blocks", () => {
    const sasCode = `proc rlang;
submit;
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const rCode = extractRCodes(doc, languageService);

    assert.equal(rCode, "");
  });

  it("handles mixed SAS and R code", () => {
    const sasCode = `/* SAS comment */
data test;
  x = 1;
run;

proc rlang;
submit;
r_data <- data.frame(x = 1:5, y = 6:10)
summary(r_data)
endsubmit;
run;

proc print data=test;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const rCode = extractRCodes(doc, languageService);

    assert.include(rCode, "r_data <- data.frame");
    assert.include(rCode, "summary(r_data)");
    assert.notInclude(rCode, "data test");
    assert.notInclude(rCode, "proc print");
  });

  it("preserves R code whitespace and indentation", () => {
    const sasCode = `proc rlang;
submit;
if (TRUE) {
  x <- 1
  if (x > 0) {
    print("positive")
  }
}
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const rCode = extractRCodes(doc, languageService);

    // Check that indentation is preserved
    assert.include(rCode, "  x <- 1");
    assert.include(rCode, '    print("positive")');
  });
});
