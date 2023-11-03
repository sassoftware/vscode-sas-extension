// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import assert from "assert";

import { parseLog } from "../../../src/components/logViewer/logParser";
import {
  logWith3Problems,
  logWith7Problems,
  logWith13Problems,
  replayedLogWith7Problems,
} from "./log";

const firstCodeLine = "title;footnote;ods _all_ close;";

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

  it("parse the replayed log in which has 7 problems", () => {
    const result = parseLog(replayedLogWith7Problems, firstCodeLine);
    assert.equal(result.length, 7, "result should have 7 problems.");
  });
});
