// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";

import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";
import { extractPythonCodes } from "../../src/python/utils";

describe("Python Code Extraction", () => {
  it("extracts simple Python code from PROC PYTHON", () => {
    const sasCode = `proc python;
submit;
x = [1, 2, 3]
print(sum(x))
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const pythonCode = extractPythonCodes(doc, languageService);

    assert.include(pythonCode, "x = [1, 2, 3]");
    assert.include(pythonCode, "print(sum(x))");
    assert.include(pythonCode, "import sas2py"); // Python includes helper import
  });

  it("extracts Python code from multiple PROC PYTHON blocks", () => {
    const sasCode = `proc python;
submit;
x = list(range(10))
endsubmit;
run;

data _null_;
  put "SAS code";
run;

proc python;
submit;
y = sum(x)
print(y)
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const pythonCode = extractPythonCodes(doc, languageService);

    assert.include(pythonCode, "x = list(range(10))");
    assert.include(pythonCode, "y = sum(x)");
    assert.include(pythonCode, "print(y)");
  });

  it("handles Python code with comments", () => {
    const sasCode = `proc python;
submit;
# This is a Python comment
x = [1, 2, 3]
# Calculate sum
print(sum(x))
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const pythonCode = extractPythonCodes(doc, languageService);

    assert.include(pythonCode, "# This is a Python comment");
    assert.include(pythonCode, "# Calculate sum");
  });

  it("handles Python code with triple-quoted strings", () => {
    const sasCode = `proc python;
submit;
text = """Hello
World"""
print(text)
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const pythonCode = extractPythonCodes(doc, languageService);

    assert.include(pythonCode, "text =");
    assert.include(pythonCode, "print(text)");
  });

  it("handles Python code with loops and control structures", () => {
    const sasCode = `proc python;
submit;
for i in range(10):
    print(i)
    if i == 5:
        break
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const pythonCode = extractPythonCodes(doc, languageService);

    assert.include(pythonCode, "for i in range(10):");
    assert.include(pythonCode, "print(i)");
    assert.include(pythonCode, "if i == 5:");
    assert.include(pythonCode, "break");
  });

  it("handles Python code with function definitions", () => {
    const sasCode = `proc python;
submit;
def my_func(x, y):
    result = x + y
    return result
z = my_func(5, 3)
endsubmit;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const pythonCode = extractPythonCodes(doc, languageService);

    assert.include(pythonCode, "def my_func(x, y):");
    assert.include(pythonCode, "return result");
    assert.include(pythonCode, "z = my_func(5, 3)");
  });

  it("returns import statement when no PROC PYTHON blocks exist", () => {
    const sasCode = `data _null_;
  x = 5;
  put x=;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const pythonCode = extractPythonCodes(doc, languageService);

    assert.include(pythonCode, "import sas2py");
    assert.notInclude(pythonCode, "data _null_");
  });

  it("handles interactive mode", () => {
    const sasCode = `proc python;
interactive;
import pandas as pd
df = pd.DataFrame({'x': [1, 2, 3]})
endinteractive;
run;`;

    const doc = TextDocument.create("test.sas", "sas", 1, sasCode);
    const languageService = new LanguageServiceProvider(doc);
    const pythonCode = extractPythonCodes(doc, languageService);

    assert.include(pythonCode, "import pandas as pd");
    assert.include(pythonCode, "df = pd.DataFrame");
  });
});
