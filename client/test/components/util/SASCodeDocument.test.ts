// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import assert from "assert";

import {
  CodeMetadata,
  SASCodeDocument,
  SASCodeDocumentOptions,
} from "../../../src/components/utils/SASCodeDocument";

describe("sas code document", () => {
  it("wrap python code", () => {
    const metadata: CodeMetadata = {
      languageId: "python",
      code: `python code
selected python code`,
      selectedCode: "",
    };
    const options: SASCodeDocumentOptions = {
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };
    const sasCodeDoc = new SASCodeDocument(metadata, options);

    const expected = `title;footnote;ods _all_ close;
ods graphics on;
ods html5 style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
proc python;
submit;
python code
selected python code
endsubmit;
run;
;*';*";*/;run;quit;ods html5 close;`;

    assert.equal(sasCodeDoc.getWrappedCode(), expected);
  });

  it("wrap sql code", () => {
    const metadata: CodeMetadata = {
      languageId: "sql",
      code: `SELECT * FROM issues WHERE issue.developer = 'scnjdl'`,
      selectedCode: "",
    };
    const options: SASCodeDocumentOptions = {
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };
    const sasCodeDoc = new SASCodeDocument(metadata, options);

    const expected = `title;footnote;ods _all_ close;
ods graphics on;
ods html5 style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
proc sql;
SELECT * FROM issues WHERE issue.developer = 'scnjdl'
;quit;
;*';*";*/;run;quit;ods html5 close;`;

    assert.equal(sasCodeDoc.getWrappedCode(), expected);
  });

  it("wrap sas code", () => {
    const metadata: CodeMetadata = {
      languageId: "sas",
      code: `proc sgplot data=sashelp.class;
  histogram age;
run;`,
      selectedCode: "",
      uri: "file:///c%3A/SAS/GIT/GitHub/TestData/run.sas",
      fileName: "c:\\SAS\\GIT\\GitHub\\TestData\\run.sas",
    };
    const options: SASCodeDocumentOptions = {
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };
    const sasCodeDoc = new SASCodeDocument(metadata, options);

    const expected = `title;footnote;ods _all_ close;
ods graphics on;
ods html5 style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
%let _SASPROGRAMFILE = %nrquote(%nrstr(c:\\SAS\\GIT\\GitHub\\TestData\\run.sas));
proc sgplot data=sashelp.class;
  histogram age;
run;
;*';*";*/;run;quit;ods html5 close;`;

    assert.equal(sasCodeDoc.getWrappedCode(), expected);
  });

  it("wrap sas code with correct windows style file path to &_SASPROGRAMFILE", () => {
    const metadata: CodeMetadata = {
      languageId: "sas",
      code: "%put &=_SASPROGRAMFILE;",
      selectedCode: "",
      uri: "file:///c%3A/SAS/GIT/GitHub/TestData/run.sas",
      fileName: `c:\\temp\\My Test\\R&D\\mean(95%CI)\\Parkinson's Disease example.sas`,
    };
    const options: SASCodeDocumentOptions = {
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };
    const sasCodeDoc = new SASCodeDocument(metadata, options);

    const expected = `title;footnote;ods _all_ close;
ods graphics on;
ods html5 style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
%let _SASPROGRAMFILE = %nrquote(%nrstr(c:\\temp\\My Test\\R&D\\mean%(95%CI%)\\Parkinson%'s Disease example.sas));
%put &=_SASPROGRAMFILE;
;*';*";*/;run;quit;ods html5 close;`;

    assert.equal(
      sasCodeDoc.getWrappedCode(),
      expected,
      "assign_SASProgramFile returned unexpected string",
    );
  });

  it("wrap sas code with correct unix style file path to &_SASPROGRAMFILE", () => {
    const metadata: CodeMetadata = {
      languageId: "sas",
      code: "%put &=_SASPROGRAMFILE;",
      selectedCode: "",
      uri: "file:///c%3A/SAS/GIT/GitHub/TestData/run.sas",
      fileName: `/tmp/My Test/R&D/mean(95%CI)/Parkinson's Disease example.sas`,
    };
    const options: SASCodeDocumentOptions = {
      htmlStyle: "Illuminate",
      outputHtml: true,
      uuid: "519058ad-d33b-4b5c-9d23-4cc8d6ffb163",
    };

    const sasCodeDoc = new SASCodeDocument(metadata, options);
    const expected = `title;footnote;ods _all_ close;
ods graphics on;
ods html5 style=Illuminate options(bitmap_mode='inline' svg_mode='inline') body="519058ad-d33b-4b5c-9d23-4cc8d6ffb163.htm";
%let _SASPROGRAMFILE = %nrquote(%nrstr(/tmp/My Test/R&D/mean%(95%CI%)/Parkinson%'s Disease example.sas));
%put &=_SASPROGRAMFILE;
;*';*";*/;run;quit;ods html5 close;`;

    assert.equal(
      sasCodeDoc.getWrappedCode(),
      expected,
      "assign_SASProgramFile returned unexpected string",
    );
  });
});
