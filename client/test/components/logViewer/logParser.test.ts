// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import assert from "assert";

import { parseLog } from "../../../src/components/logViewer/logParser";
import {
  case4,
  case5,
  case6,
  case7_8,
  case9,
  case10,
  case11,
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
  case 1:
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
  case 2:
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
  it("parse the log in which an problem message is shared", () => {
    const result = parseLog(multipleSameProblemIndexAtOneLine, firstCodeLine);
    assert.equal(result.length, 43, "result should have 43 problems.");
  });

  /*
  87         data CUSTOMERS (label="Customer data for geocoding");
  88            infile datalines dlm=#' dlm=#' dlm=#;
                                     _             _
                                     24            24
                                     24            24
  ERROR 24-322: Variable name is not valid.
  ERROR 24-2: Invalid value for the DLM option.
  89            length address $ 24 city $ 24 state $ 2;
  */
  it("parse the log in which same problem index occurs at different positions in different lines", () => {
    const result = parseLog(case4, firstCodeLine);
    assert.equal(result.length, 20, "result should have 20 problems.");
  });

  /*
  118        proc sgscatter data=sashelp.iris(=(species="Virginica"));
                                              _                     _
                                              22                    22
                                                                    200
  ERROR 22-7: Invalid option name =.
  ERROR 22-322: Syntax error, expecting one of the following: ;, BACKCOLOR, DATA, DATACOLORS, DATACONTRASTCOLORS, DATALINEPATTERNS, 
                DATASYMBOLS, DATTRMAP, DESCRIPTION, NOOPAQUE, NOSUBPIXEL, OPAQUE, PAD, RATTRMAP, SGANNO, SUBPIXEL, TMPLOUT, 
                WALLCOLOR.  
  ERROR 200-322: The symbol is not recognized and will be ignored.
  118      ! proc sgscatter data=sashelp.iris(=(species="Virginica"));
  */
  it("parse the log in which same problem index have different problem message", () => {
    const result = parseLog(case5, firstCodeLine);
    assert.equal(result.length, 4, "result should have 4 problems.");
  });

  /*
  NOTE: 由于出错，SAS 系统停止处理该步。
  11         proc hpclus data=sampsio.dmairis maxclusters=9
  12                  NOC=ABCB=10 minclusters=2 align=PCA criterion=FIRSTPEAK);
                          _____
                          1   22
                              200
  WARNING 1-322: 假定符号 ABC 被错拼为 ABCB。
  ERROR 22-322: 语法错误，期望下列之一: ;, (, DATA, DISTANCE, DISTANCEINT, DISTANCENOM, IMP, IMPUTE, IMPUTEINT, IMPUTENOM, INSEED,
                INSTAT, MAXC, MAXCLUSTERS, MAXITER, NOC, NOPRINT, OUTITER, OUTSTAT, SEED, STANDARDIZE, STOPCRITERION.  
  ERROR 200-322: 该符号不可识别，将被忽略。
  */

  it("parse the log in which there is 1 indicator but 2 problem indexes", () => {
    const result = parseLog(case6, firstCodeLine);
    assert.equal(result.length, 3, "result should have 3 problems.");
  });

  /*
  50   proc optex seed=193030034 data=a;
                      -
                      22
                      200
  51      class    Habitat;
          -----
          180
  52      model    Habitat Month c1-c4 s1-s3 / noint;
          -----
          180
  53      generate n=12;
          --------
          180
  ERROR 22-322: Syntax error, expecting one of the following: a name, a quoted string, (, /, ;, _DATA_, _LAST_, _NULL_.  
  ERROR 200-322: The symbol is not recognized and will be ignored.
  ERROR 180-322: Statement is not valid or it is used out of proper order.
   */
  it("parse the long log", () => {
    const result = parseLog(case7_8, firstCodeLine);
    assert.equal(result.length, 11, "result should have 11 problems.");
  });

  /*
  problems occur before user's source code.
   */
  it("parse the log with case9", () => {
    const result = parseLog(case9, firstCodeLine);
    assert.equal(result.length, 2, "result should have 2 problems.");
  });

  /*
  handle below case: same source code line appear many times with error on it.

  22         %let _SASPROGRAMFILE = %nrquote(%nrstr(c:\SAS\GIT\GitHub\TestData\error_case_10.sas));
  23         proc sgplot data=&dvttestdata1 dattrmap=&dvttestdata2;
                              _
                              22
                              200
  WARNING: Apparent symbolic reference DVTTESTDATA1 not resolved.
  23         proc sgplot data=&dvttestdata1 dattrmap=&dvttestdata2;
                                                    _
                                                    22
  ERROR 22-322: Expecting a name.
  ERROR 200-322: The symbol is not recognized and will be ignored.
  23         proc sgplot data=&dvttestdata1 dattrmap=&dvttestdata2;
                                                    _
                                                    200
  ERROR 200-322: The symbol is not recognized and will be ignored.
  ERROR: File WORK.DVTTESTDATA1.DATA does not exist.
  WARNING: Apparent symbolic reference DVTTESTDATA2 not resolved.
  ERROR: File WORK.DVTTESTDATA2.DATA does not exist.
  24             scatter x=x y=x2 / group=y3 attrid=myid1;
  */
  it("parse the log with case10", () => {
    const result = parseLog(case10, firstCodeLine);
    assert.equal(result.length, 11, "result should have 11 problems.");
  });

  /*
  problems occur after user's source code
  */
  it("parse the log with case11", () => {
    const result = parseLog(case11, firstCodeLine);
    assert.equal(result.length, 4, "result should have 4 problems.");
  });
});
