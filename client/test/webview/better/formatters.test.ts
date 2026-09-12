// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import {
  CELL_TRUNCATE_AT,
  detectContent,
  displayValue,
  isNumericKind,
  prettifyJSON,
  prettifyXML,
} from "../../../src/webview/better/formatters";

describe("better formatters", () => {
  describe("displayValue", () => {
    it("renders null/undefined as NULL", () => {
      assert.deepEqual(displayValue(null), {
        text: "NULL",
        isNull: true,
        truncated: false,
      });
      assert.deepEqual(displayValue(undefined), {
        text: "NULL",
        isNull: true,
        truncated: false,
      });
    });

    it("keeps short values verbatim", () => {
      assert.deepEqual(displayValue("hello"), {
        text: "hello",
        isNull: false,
        truncated: false,
      });
    });

    it("truncates long values with an ellipsis and collapses newlines", () => {
      const long = "x".repeat(CELL_TRUNCATE_AT + 50);
      const out = displayValue(long);
      assert.isTrue(out.truncated);
      assert.strictEqual(out.text.length, CELL_TRUNCATE_AT + 1);
      assert.strictEqual(out.text.endsWith("…"), true);
    });

    it("collapses embedded newlines so rows stay single-line", () => {
      assert.strictEqual(displayValue("a\nb").text, "a↵b");
      assert.strictEqual(displayValue("a\r\nb").text, "a↵b");
    });
  });

  describe("isNumericKind", () => {
    it("flags numeric and date-like kinds", () => {
      for (const k of ["num", "currency", "date", "datetime", "time"]) {
        assert.isTrue(isNumericKind(k as never));
      }
      assert.isFalse(isNumericKind("char"));
      assert.isFalse(isNumericKind("unknown"));
    });
  });

  describe("detectContent / prettify", () => {
    it("detects JSON, XML and plain text", () => {
      assert.strictEqual(detectContent('{"a":1}'), "json");
      assert.strictEqual(detectContent("[1,2]"), "json");
      assert.strictEqual(detectContent("<tag>…</tag>"), "xml");
      assert.strictEqual(detectContent("plain string"), "text");
      assert.strictEqual(detectContent("{ not valid json"), "text");
    });
    it("prettifies JSON with indentation", () => {
      assert.strictEqual(prettifyJSON('{"a":1}'), '{\n  "a": 1\n}');
      assert.strictEqual(prettifyJSON("not json"), "not json");
    });
    it("prettifies XML by indenting tags (naive but stable)", () => {
      assert.strictEqual(
        prettifyXML("<r><a>1</a><b>2</b></r>"),
        "<r>\n  <a>1\n  </a>\n  <b>2\n  </b>\n</r>",
      );
    });
  });
});
