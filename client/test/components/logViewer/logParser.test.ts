// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import assert from "assert";

import { parseLog } from "../../../src/components/logViewer/logParser";
import {
  logWith3Problems,
  logWith7Problems,
  logWith13Problems,
  logWithLongSourceCode,
  logWithMultipleIndicatorInOneLine,
  multipleSameProblemIndexAtOneLine,
  replayedLogWith7Problems,
} from "./log";

const firstCodeLine = "/** LOG_START_INDICATOR **/";

describe("parse log", () => {
  it("parse the log in which has 7 problems", () => {
    const result = parseLog(logWith7Problems, firstCodeLine);
    assert.equal(result.length, 7, "result should have 7 problems.");
  });

  it("parse the log in which has 13 problems", () => {
    const result = parseLog(logWith13Problems, firstCodeLine);
    assert.equal(result.length, 13, "result should have 13 problems.");
  });

  it("parse the log in which has 3 problems", () => {
    const result = parseLog(logWith3Problems, firstCodeLine);
    assert.equal(result.length, 3, "result should have 3 problems.");
  });

  it("parse the replayed log in which has 13 problems", () => {
    const result = parseLog(replayedLogWith7Problems, firstCodeLine);
    assert.equal(result.length, 13, "result should have 13 problems.");
  });

  /*
  this test case concerns the truncated source code lines:

  18   proc casutil;
  ERROR: A connection to the Cloud Analytic Services session could not be made.
  ERROR: An error has occurred.
  18 !               load data=SASHELP.BASEBALL outcaslib="CASUSER" casout="CASBALL"; run;
  ERROR: An error has occurred.

  */
  it("parse the log in which has long source code and 3 problems", () => {
    const result = parseLog(logWithLongSourceCode, firstCodeLine);
    assert.equal(result.length, 3, "result should have 3 problems.");
  });

  /* 
  this test case concerns multiple location indicators in one line:
  
  65       call call symputx('mac', quote(strip(emple)));
                     -------                            -
                     22                                 79
                     68
                ----
                251
  ERROR 22-322: Syntax error, expecting one of the following: (, ;.  

  ERROR 79-322: Expecting a ).

  ERROR 68-185: The function SYMPUTX is unknown, or cannot be accessed.

  ERROR 251-185: The subroutine CALL is unknown, or cannot be accessed. Check your spelling. 
                 Either it was not found in the path(s) of executable images, or there was incorrect or missing subroutine descriptor 
                 information.
  
  */
  it("parse the log in which has 8 problems, 6 errors and 2 warning", () => {
    const result = parseLog(logWithMultipleIndicatorInOneLine, firstCodeLine);
    assert.equal(result.length, 8, "result should have 8 problems.");

    const errors = result.filter((problem) => problem.type === "error").length;
    assert.equal(errors, 6, "result should have 6 error type problems.");

    const warnings = result.filter(
      (problem) => problem.type === "warning",
    ).length;
    assert.equal(warnings, 2, "result should have 2 warning type problems.");

    // problem location
    assert.deepEqual(
      result[1],
      {
        startColumn: 14,
        endColumn: 21,
        lineNumber: 13,
        type: "error",
        message:
          "ERROR 22-322: Syntax error, expecting one of the following: (, ;.",
      },
      "location is incorrect.",
    );
  });

  /*
  this test case handle below log snippet. the point is the problem index 200 occurred multiple times in on source code,
  but there is only one log message to indicate what 200 problem index means. In such case, the generated problem count will more than
  problem count in log

  67         connect to &dbms as mydb (&CONNOPT);
                        _              _
                        22             79
                        200            200
  WARNING: Apparent symbolic reference DBMS not resolved.
  4                                                    The SAS System                         09:25 Monday, March 25, 2024
  WARNING: Apparent symbolic reference CONNOPT not resolved.
  ERROR 22-322: Expecting a name.  
  ERROR 79-322: Expecting a ).
  ERROR 200-322: The symbol is not recognized and will be ignored.
NOTE: PROC SQL set option NOEXEC and will continue to check the syntax of statements.
   */
  it("parse the log in which same problem index occurs at different positions in one line", () => {
    const result = parseLog(multipleSameProblemIndexAtOneLine, firstCodeLine);
    assert.equal(result.length, 43, "result should have 43 problems.");
  });
});
