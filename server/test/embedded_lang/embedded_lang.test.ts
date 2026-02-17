// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocument } from "vscode-languageserver-textdocument";

import { assert } from "chai";
import fs from "fs";

import { CodeZoneManager } from "../../src/sas/CodeZoneManager";
import { LanguageServiceProvider } from "../../src/sas/LanguageServiceProvider";

const openDoc = (path: string): TextDocument => {
  const content = fs.readFileSync(path, {
    encoding: "utf-8",
  });
  const doc: TextDocument = TextDocument.create(path, "sas", 1, content);
  return doc;
};

describe("Test code zone for embedded language", () => {
  it("proc sql", () => {
    const doc = openDoc("server/testFixture/embedded_lang/proc_sql.sas");
    const languageServer = new LanguageServiceProvider(doc);
    const codeZoneManager = languageServer.getCodeZoneManager();

    const zoneList = [];
    for (let i = 0; i < doc.lineCount; i++) {
      zoneList.push(codeZoneManager.getCurrentZone(i, 1));
    }

    assert.equal(zoneList[0], CodeZoneManager.ZONE_TYPE.COMMENT);
    assert.equal(zoneList[3], CodeZoneManager.ZONE_TYPE.PROC_STMT);
    assert.equal(zoneList[5], CodeZoneManager.ZONE_TYPE.COMMENT);
    assert.equal(zoneList[8], CodeZoneManager.ZONE_TYPE.PROC_STMT);
  });

  it("proc python", () => {
    const doc = openDoc("server/testFixture/embedded_lang/proc_python.sas");
    const languageServer = new LanguageServiceProvider(doc);
    const codeZoneManager = languageServer.getCodeZoneManager();

    const zoneList = [];
    for (let i = 0; i < doc.lineCount; i++) {
      zoneList.push(codeZoneManager.getCurrentZone(i, 1));
    }

    assert.equal(zoneList[2], CodeZoneManager.ZONE_TYPE.COMMENT);
    assert.equal(zoneList[6], CodeZoneManager.ZONE_TYPE.PROC_STMT);
    assert.equal(zoneList[8], CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG);
    assert.equal(zoneList[11], CodeZoneManager.ZONE_TYPE.PROC_STMT);
  });

  it("proc lua", () => {
    const doc = openDoc("server/testFixture/embedded_lang/proc_lua.sas");
    const languageServer = new LanguageServiceProvider(doc);
    const codeZoneManager = languageServer.getCodeZoneManager();

    const zoneList = [];
    for (let i = 0; i < doc.lineCount; i++) {
      zoneList.push(codeZoneManager.getCurrentZone(i, 1));
    }

    assert.equal(zoneList[1], CodeZoneManager.ZONE_TYPE.PROC_STMT);
    assert.equal(zoneList[2], CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG);
    assert.equal(zoneList[4], CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG);
    assert.equal(zoneList[6], CodeZoneManager.ZONE_TYPE.PROC_STMT);
  });

  it("proc r", () => {
    const doc = openDoc("server/testFixture/embedded_lang/proc_r.sas");
    const languageServer = new LanguageServiceProvider(doc);
    const codeZoneManager = languageServer.getCodeZoneManager();

    const zoneList = [];
    for (let i = 0; i < doc.lineCount; i++) {
      zoneList.push(codeZoneManager.getCurrentZone(i, 1));
    }
    assert.equal(zoneList[1], CodeZoneManager.ZONE_TYPE.PROC_STMT);
    assert.equal(zoneList[2], CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG);
    assert.equal(zoneList[4], CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG);
    assert.equal(zoneList[6], CodeZoneManager.ZONE_TYPE.PROC_STMT);
  });
});
