// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import {
  baseFormatName,
  extractFormatName,
  getIconLabel,
  iconForColumn,
  iconForFormatCategory,
} from "../../src/panels/columnIconClassifier";

// The category each SAS format resolves to, and the icon both views must render for it.
const formatExpectations = [
  { format: "DATE9.", category: "date", icon: "date" },
  { format: "TIME8.", category: "time", icon: "time" },
  { format: "DATETIME20.", category: "datetime", icon: "date-time" },
  { format: "DOLLAR15.2", category: "curr", icon: "currency" },
  { format: "COMMA12.", category: "num", icon: "float" },
  { format: "$CHAR20.", category: "char", icon: "char" },
];

describe("columnIconClassifier", () => {
  describe("iconForColumn", () => {
    formatExpectations.forEach(({ format, category, icon }) => {
      it(`renders the ${icon} icon for ${format} (category ${category})`, () => {
        // Viya reports FLOAT/CHAR, SAS 9 reports num/char; the icon must not depend on that.
        const type = category === "char" ? "CHAR" : "FLOAT";
        assert.strictEqual(iconForColumn(type, category), icon);
        assert.strictEqual(
          iconForColumn(category === "char" ? "char" : "num", category),
          icon,
        );
      });
    });

    it("falls back to the type icon when no category was resolved", () => {
      assert.strictEqual(iconForColumn("FLOAT"), "float");
      assert.strictEqual(iconForColumn("num"), "float");
      assert.strictEqual(iconForColumn("CHAR"), "char");
      assert.strictEqual(iconForColumn("CHARACTER", ""), "char");
    });

    it("falls back to the type icon for an unknown category", () => {
      assert.strictEqual(iconForColumn("FLOAT", "mystery"), "float");
    });

    it("returns no icon for an unknown type without a category", () => {
      assert.strictEqual(iconForColumn(undefined), "");
      assert.strictEqual(iconForColumn("SOMETHING"), "");
    });
  });

  describe("iconForFormatCategory", () => {
    it("maps the SAS format categories to icon classes", () => {
      assert.strictEqual(iconForFormatCategory("date"), "date");
      assert.strictEqual(iconForFormatCategory("datetime"), "date-time");
      assert.strictEqual(iconForFormatCategory("time"), "time");
      assert.strictEqual(iconForFormatCategory("curr"), "currency");
      assert.strictEqual(iconForFormatCategory("num"), "float");
      assert.strictEqual(iconForFormatCategory("char"), "char");
    });

    it("maps categories without a dedicated icon to the numeric icon", () => {
      assert.strictEqual(iconForFormatCategory("binary"), "float");
      assert.strictEqual(iconForFormatCategory("stat"), "float");
      assert.strictEqual(iconForFormatCategory("smf"), "float");
    });

    it("normalizes casing and whitespace", () => {
      assert.strictEqual(iconForFormatCategory(" DATE "), "date");
      assert.strictEqual(iconForFormatCategory("CURR"), "currency");
    });

    it("returns an empty icon for missing or unknown categories", () => {
      assert.strictEqual(iconForFormatCategory(undefined), "");
      assert.strictEqual(iconForFormatCategory(""), "");
      assert.strictEqual(iconForFormatCategory("mystery"), "");
    });
  });

  describe("baseFormatName", () => {
    it("normalizes the formats used by the icon classification", () => {
      assert.strictEqual(baseFormatName("DATE9."), "DATE");
      assert.strictEqual(baseFormatName("TIME8."), "TIME");
      assert.strictEqual(baseFormatName("DATETIME20."), "DATETIME");
      assert.strictEqual(baseFormatName("DOLLAR15.2"), "DOLLAR");
      assert.strictEqual(baseFormatName("$CHAR20."), "$CHAR");
      assert.strictEqual(baseFormatName("MMDDYY10."), "MMDDYY");
      assert.strictEqual(baseFormatName("E8601DA10."), "E8601DA");
    });

    it("strips width and decimal specifiers", () => {
      assert.strictEqual(baseFormatName("DATE9."), "DATE");
      assert.strictEqual(baseFormatName("MMDDYY10."), "MMDDYY");
      assert.strictEqual(baseFormatName("DOLLAR15.2"), "DOLLAR");
      assert.strictEqual(baseFormatName("PERCENT8.2"), "PERCENT");
      assert.strictEqual(baseFormatName("$CHAR20."), "$CHAR");
    });

    it("keeps digits that belong to the format name", () => {
      assert.strictEqual(baseFormatName("E8601DA10."), "E8601DA");
      assert.strictEqual(baseFormatName("B8601DT"), "B8601DT");
    });

    it("upper cases and trims", () => {
      assert.strictEqual(baseFormatName(" date9. "), "DATE");
    });

    it("accepts format objects and missing formats", () => {
      assert.strictEqual(baseFormatName({ name: "TIME8." }), "TIME");
      assert.strictEqual(baseFormatName(undefined), "");
      assert.strictEqual(baseFormatName({}), "");
    });
  });

  describe("extractFormatName", () => {
    it("supports strings, objects and missing values", () => {
      assert.strictEqual(extractFormatName("DATE9."), "DATE9.");
      assert.strictEqual(extractFormatName({ name: "DATE9." }), "DATE9.");
      assert.strictEqual(extractFormatName(undefined), "");
    });
  });

  describe("getIconLabel", () => {
    it("returns a label for every icon class", () => {
      assert.strictEqual(getIconLabel("float"), "Numeric");
      assert.strictEqual(getIconLabel("char"), "Character");
      assert.strictEqual(getIconLabel("date"), "Date");
      assert.strictEqual(getIconLabel("time"), "Time");
      assert.strictEqual(getIconLabel("date-time"), "Datetime");
      assert.strictEqual(getIconLabel("currency"), "Currency");
      assert.strictEqual(getIconLabel(""), "");
    });
  });
});
