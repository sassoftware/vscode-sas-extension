// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import assert from "assert";

import {
  SASCodeDocument,
  SASCodeDocumentParameters,
} from "../../../src/components/utils/SASCodeDocument";

describe("sas code document", () => {
  it("wrap python code", () => {
    const parameters: SASCodeDocumentParameters = {
      languageId: "python",
      code: `python code
selected python code`,
      selectedCode: "",
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };

    const sasCodeDoc = new SASCodeDocument(parameters);

    const expected = `/** LOG_START_INDICATOR **/
title;footnote;ods _all_ close;
ods graphics on;
ods html5(id=vscode) style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
proc python;
submit;
python code
selected python code
endsubmit;
run;
;*';*";*/;run;quit;ods html5(id=vscode) close;
`;

    assert.equal(sasCodeDoc.getWrappedCode(), expected);
  });

  it("wrap sql code", () => {
    const parameters: SASCodeDocumentParameters = {
      languageId: "sql",
      code: `SELECT * FROM issues WHERE issue.developer = 'scnjdl'`,
      selectedCode: "",
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };

    const sasCodeDoc = new SASCodeDocument(parameters);

    const expected = `/** LOG_START_INDICATOR **/
title;footnote;ods _all_ close;
ods graphics on;
ods html5(id=vscode) style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
proc sql;
SELECT * FROM issues WHERE issue.developer = 'scnjdl'
;quit;
;*';*";*/;run;quit;ods html5(id=vscode) close;
`;

    assert.equal(sasCodeDoc.getWrappedCode(), expected);
  });

  it("wrap sas code", () => {
    const parameters: SASCodeDocumentParameters = {
      languageId: "sas",
      code: `proc sgplot data=sashelp.class;
  histogram age;
run;`,
      selectedCode: "",
      uri: "file:///c%3A/SAS/GIT/GitHub/TestData/run.sas",
      fileName: "c:\\SAS\\GIT\\GitHub\\TestData\\run.sas",
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };

    const sasCodeDoc = new SASCodeDocument(parameters);

    const expected = `/** LOG_START_INDICATOR **/
title;footnote;ods _all_ close;
ods graphics on;
ods html5(id=vscode) style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
%let _SASPROGRAMFILE = %nrquote(%nrstr(c:\\SAS\\GIT\\GitHub\\TestData\\run.sas));
proc sgplot data=sashelp.class;
  histogram age;
run;
;*';*";*/;run;quit;ods html5(id=vscode) close;
`;

    assert.equal(sasCodeDoc.getWrappedCode(), expected);
  });

  it("wrap sas code with correct windows style file path to &_SASPROGRAMFILE", () => {
    const parameters: SASCodeDocumentParameters = {
      languageId: "sas",
      code: "%put &=_SASPROGRAMFILE;",
      selectedCode: "",
      uri: "file:///c%3A/SAS/GIT/GitHub/TestData/run.sas",
      fileName: `c:\\temp\\My Test\\R&D\\mean(95%CI)\\Parkinson's Disease example.sas`,
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };
    const sasCodeDoc = new SASCodeDocument(parameters);

    const expected = `/** LOG_START_INDICATOR **/
title;footnote;ods _all_ close;
ods graphics on;
ods html5(id=vscode) style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
%let _SASPROGRAMFILE = %nrquote(%nrstr(c:\\temp\\My Test\\R&D\\mean%(95%CI%)\\Parkinson%'s Disease example.sas));
%put &=_SASPROGRAMFILE;
;*';*";*/;run;quit;ods html5(id=vscode) close;
`;

    assert.equal(
      sasCodeDoc.getWrappedCode(),
      expected,
      "assign_SASProgramFile returned unexpected string",
    );
  });

  it("wrap sas code with correct unix style file path to &_SASPROGRAMFILE", () => {
    const parameters: SASCodeDocumentParameters = {
      languageId: "sas",
      code: "%put &=_SASPROGRAMFILE;",
      selectedCode: "",
      uri: "file:///c%3A/SAS/GIT/GitHub/TestData/run.sas",
      fileName: `/tmp/My Test/R&D/mean(95%CI)/Parkinson's Disease example.sas`,
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };

    const sasCodeDoc = new SASCodeDocument(parameters);
    const expected = `/** LOG_START_INDICATOR **/
title;footnote;ods _all_ close;
ods graphics on;
ods html5(id=vscode) style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
%let _SASPROGRAMFILE = %nrquote(%nrstr(/tmp/My Test/R&D/mean%(95%CI%)/Parkinson%'s Disease example.sas));
%put &=_SASPROGRAMFILE;
;*';*";*/;run;quit;ods html5(id=vscode) close;
`;

    assert.equal(
      sasCodeDoc.getWrappedCode(),
      expected,
      "assign_SASProgramFile returned unexpected string",
    );
  });

  it("includes blank lines", () => {
    const parameters: SASCodeDocumentParameters = {
      languageId: "sas",
      code: `cas; caslib _all_ assign;

  data casuser.cascars; set sashelp.cars; run;

  proc casutil; load data=SASHELP.BASEBALL outcaslib="CASUSER" casout="CASBALL";run;`,
      selectedCode: "",
      uri: "file:///c%3A/SAS/GIT/GitHub/TestData/run.sas",
      fileName: `/tmp/My Test/R&D/mean(95%CI)/Parkinson's Disease example.sas`,
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };

    const sasCodeDoc = new SASCodeDocument(parameters);
    const expected = `/** LOG_START_INDICATOR **/
title;footnote;ods _all_ close;\nods graphics on;
ods html5(id=vscode) style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
%let _SASPROGRAMFILE = %nrquote(%nrstr(/tmp/My Test/R&D/mean%(95%CI%)/Parkinson%'s Disease example.sas));
cas; caslib _all_ assign;

  data casuser.cascars; set sashelp.cars; run;

  proc casutil; load data=SASHELP.BASEBALL outcaslib="CASUSER" casout="CASBALL";run;
;*';*";*/;run;quit;ods html5(id=vscode) close;
`;

    assert.equal(
      sasCodeDoc.getWrappedCode(),
      expected,
      "returns unexpected string",
    );
  });

  it("getProblemLocationInRawCode", () => {
    const parameters: SASCodeDocumentParameters = {
      languageId: "sas",
      code: "\r\n\r\n/* I am comment */\r\noptions ls=72;\r\n\r\ndata pf70 pm70 pf80 pm80;\r\n\tinput state $ pop_f70 pop_m70 pop_f80 pop_m80 @@;\r\n\tdrop pop_m70 pop_f70 pop_m80 pop_f80;\r\n\tdecade= 70;\r\n\tsex= 'Female'\r\n\tpop= pop_f70;  output pf70;\r\n\tsex= 'Male';\r\n\tpop= pop_m70;  output pm70;\r\n\r\n\tdecade= 80;\r\n\tpop= pop_m80;  output pm80;\r\n\tsex= 'Female';\r\n\tpop= pop_f80;  output pf80;\r\n\tdecade= 70;\r\n\tsex= 'Female'\r\n\tpop= pop_f70;  output pf70;\r\n\tsex= 'Male';\r\n\tpop= pop_m70;  output pm70;\r\n\tdecade= 80;\r\n\tpop= pop_m80;  output pm80;\r\n\tsex= 'Female';\r\n\tpop= pop_f80;  output pf80;\r\n\tcards;\r\nALA    1.78  1.66  2.02  1.87   ALASKA 0.14  0.16  0.19  0.21\r\nARIZ   0.90  0.87  1.38  1.34   ARK    0.99  0.93  1.18  1.10\r\nCALIF 10.14  9.82 12.00 11.67   COLO   1.12  1.09  1.46  1.43\r\nCONN   1.56  1.47  1.61  1.50   DEL    0.28  0.27  0.31  0.29\r\nFLA    3.51  3.28  5.07  4.68   GA     2.36  2.23  2.82  2.64\r\nHAW    0.37  0.40  0.47  0.49   IDAHO  0.36  0.36  0.47  0.47\r\nILL    5.72  5.39  5.89  5.54   IND    2.66  2.53  2.82  2.67\r\nIOWA   1.45  1.37  1.50  1.41   KAN    1.15  1.02  1.21  1.16\r\nKY     1.64  1.58  1.87  1.79   LA     1.87  1.77  2.17  2.04\r\nME     0.51  0.48  0.58  0.55   MD     2.01  1.92  2.17  2.04\r\n\r\nMASS   2.97  2.72  3.01  2.73   MICH   4.53  4.39  4.75  4.52\r\nMINN   1.94  1.86  2.08  2.00   MISS   1.14  1.07  1.31  1.21\r\nMO     2.42  2.26  2.55  2.37   MONT   0.35  0.35  0.39  0.39\r\nNEB    0.76  0.72  0.80  0.77   NEV    0.24  0.25  0.40  0.41\r\nNH     0.38  0.36  0.47  0.45   NJ     3.70  3.47  3.83  3.53\r\nNM     0.52  0.50  0.66  0.64   NY     9.52  8.72  9.22  8.34\r\nNC     2.59  2.49  3.03  2.86   ND     0.31  0.31  0.32  0.33\r\nOHIO   5.49  5.16  5.58  5.22   OKLA   1.31  1.25  1.55  1.48\r\nORE    1.07  1.02  1.34  1.30   PA     6.13  5.67  6.18  5.68\r\nRI     0.48  0.46  0.50  0.45   SC     1.32  1.27  1.60  1.52\r\nSD     0.34  0.33  0.35  0.34   TENN   2.03  1.90  2.37  2.22\r\nTEXAS  5.72  5.48  7.23  7.00   UTAH   0.54  0.52  0.74  0.72\r\nVT     0.23  0.22  0.26  0.25   VA     2.35  2.30  2.73  2.62\r\nWASH   1.72  1.69  2.08  2.05   W.VA   0.90  0.84  1.00  0.95\r\nWIS    2.25  2.17  2.40  2.31   WYO    0.16  0.17  0.23  0.24\r\nXX      .     .     .     .     YY      .     .     .     .\r\n;\r\n\r\ndata popstate;\r\n\tset pf70 pm70 pf80 pm80;\r\n\tlabel pop= 'Census Population In Millions';\r\ntitle 'The SAS System';\r\n\r\nproc univariate data=popstate freq plot normal;\r\n\tvar2 pop;\r\n\tid state;\r\n\tby decade sex;\r\n\toutput out= univout mean= popnmean median= popn50\r\n\t\tpctlpre= pop_  pctlpts= 50, 95 to 100 by 2.5;\r\n\r\nproc print data= univout;\r\n\ttitle 'Output Dataset From PROC UNIVARIATE';\r\n\tformat popn50 pop_50 pop_95 pop_97_5 pop_100 best8.;\r\n",
      selectedCode: "",
      uri: "file:///c%3A/SAS/GIT/GitHub/TestData/error_init.sas",
      fileName: `c:\\SAS\\GIT\\GitHub\\TestData\\error_init.sas`,
      htmlStyle: "Ignite",
      outputHtml: true,
      uuid: "6128b4fc-7337-4a2c-94ab-bdc592fcdf44",
      selections: [
        { start: { line: 0, character: 0 }, end: { line: 72, character: 0 } },
      ],
    };

    const sasCodeDoc = new SASCodeDocument(parameters);
    const problem = {
      lineNumber: 65,
      startColumn: 2,
      endColumn: 57,
      message:
        "WARNING: Data set WORK.UNIVOUT was not replaced because new file is incomplete.",
      type: "warning",
    };
    const problemLocationInRawCode = sasCodeDoc.getLocationInRawCode(problem);
    assert.equal(problemLocationInRawCode.lineNumber, 60);
  });
});
