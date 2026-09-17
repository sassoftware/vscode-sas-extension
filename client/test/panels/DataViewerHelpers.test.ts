// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
import { assert } from "chai";

import type { Column } from "../../src/connection/rest/api/compute";
import {
  buildSelectionPredicate,
  combineFilters,
  csvCell,
  inSelectionAtCell,
  mapType,
  stripIndexCell,
  toColumnMeta,
  toSortModel,
} from "../../src/panels/DataViewerHelpers";

describe("DataViewerHelpers", () => {
  describe("mapType", () => {
    it("maps each recognised SAS type to its ColumnKind", () => {
      assert.strictEqual(mapType("char"), "char");
      assert.strictEqual(mapType("STRING"), "char");
      assert.strictEqual(mapType("text"), "char");
      assert.strictEqual(mapType("num"), "num");
      assert.strictEqual(mapType("NUMERIC"), "num");
      assert.strictEqual(mapType("double"), "num");
      assert.strictEqual(mapType("integer"), "num");
      assert.strictEqual(mapType("date"), "date");
      assert.strictEqual(mapType("time"), "time");
      assert.strictEqual(mapType("datetime"), "datetime");
      assert.strictEqual(mapType("dt"), "datetime");
      assert.strictEqual(mapType("currency"), "currency");
    });

    it("maps unknown/empty types to unknown", () => {
      assert.strictEqual(mapType("totally-bogus"), "unknown");
      assert.strictEqual(mapType(undefined), "unknown");
      assert.strictEqual(mapType(" "), "unknown");
    });
  });

  describe("toColumnMeta", () => {
    it("maps name/id/label/length/format", () => {
      const col: Column = {
        id: "ID",
        name: "FULLNAME",
        label: "Readable",
        length: 42,
        type: "char",
        format: { name: "$CHAR40." },
      } as Column;
      const meta = toColumnMeta(col);
      assert.strictEqual(meta.id, "FULLNAME");
      assert.strictEqual(meta.name, "FULLNAME");
      assert.strictEqual(meta.label, "Readable");
      assert.strictEqual(meta.length, 42);
      assert.strictEqual(meta.format, "$CHAR40.");
      assert.strictEqual(meta.kind, "char");
    });

    it("falls back to id/empty label when name is absent", () => {
      const meta = toColumnMeta({ id: "K1", type: "num" } as Column);
      assert.strictEqual(meta.id, "K1");
      assert.strictEqual(meta.name, "K1");
      assert.strictEqual(meta.label, undefined);
      assert.strictEqual(meta.format, undefined);
      assert.strictEqual(meta.kind, "num");
    });
  });

  describe("combineFilters", () => {
    it("returns undefined when there are no filters", () => {
      assert.strictEqual(combineFilters([]), undefined);
      assert.strictEqual(
        combineFilters([{ colId: "A", expr: "   " }]),
        undefined,
      );
      assert.strictEqual(
        combineFilters([{ colId: "A", values: [] }]),
        undefined,
      );
    });

    it("emits a WHERE fragment for values-lists", () => {
      const q = combineFilters([{ colId: "SEX", values: ["F", "M"] }]);
      assert.deepEqual(q, { filterValue: '(SEX in ("F","M"))' });
    });

    it("escapes embedded quotes in string literals", () => {
      const q = combineFilters([{ colId: "NAME", values: [`a"b`] }]);
      assert.deepEqual(q, { filterValue: '(NAME in ("a""b"))' });
    });

    it("concatenates expr fragments verbatim (trusted SAS)", () => {
      const q = combineFilters([
        { colId: "AGE", expr: "AGE gt 18" },
        { colId: "SEX", values: ["F"] },
      ]);
      assert.strictEqual(q?.filterValue, '(AGE gt 18) and (SEX in ("F"))');
    });

    it("prefers expr over values when both are set", () => {
      const q = combineFilters([{ colId: "X", expr: "X ne .", values: ["1"] }]);
      assert.strictEqual(q?.filterValue, "(X ne .)");
    });
  });

  describe("csvCell", () => {
    it("passes through simple values unchanged", () => {
      assert.strictEqual(csvCell("plain"), "plain");
      assert.strictEqual(csvCell(""), "");
      assert.strictEqual(csvCell(null), "");
      assert.strictEqual(csvCell(undefined), "");
    });

    it("quotes cells containing commas, quotes, or newlines", () => {
      assert.strictEqual(csvCell("a,b"), '"a,b"');
      assert.strictEqual(csvCell("a\nb"), '"a\nb"');
      assert.strictEqual(csvCell('say "hi"'), '"say ""hi"""');
    });
  });

  describe("buildSelectionPredicate", () => {
    it("matches rows touched by any rectangle, ignoring columns", () => {
      const pred = buildSelectionPredicate([
        { fromRow: 1, toRow: 3, fromCol: 0, toCol: 5 },
        { fromRow: 9, toRow: 9, fromCol: 2, toCol: 2 },
      ]);
      assert.isFalse(pred(0));
      assert.isTrue(pred(1));
      assert.isTrue(pred(2));
      assert.isTrue(pred(3));
      assert.isFalse(pred(4));
      assert.isTrue(pred(9));
      assert.isFalse(pred(10));
    });

    it("returns false for empty selection", () => {
      assert.isFalse(buildSelectionPredicate([])(7));
    });
  });

  describe("inSelectionAtCell", () => {
    it("is true only for cells inside a rectangle", () => {
      const sel = [{ fromRow: 0, toRow: 1, fromCol: 2, toCol: 3 }];
      assert.isTrue(inSelectionAtCell(sel, 0, 2));
      assert.isTrue(inSelectionAtCell(sel, 1, 3));
      assert.isFalse(inSelectionAtCell(sel, 0, 1));
      assert.isFalse(inSelectionAtCell(sel, 2, 2));
    });

    it("returns false for empty selection", () => {
      assert.isFalse(inSelectionAtCell([], 0, 0));
    });
  });

  describe("toSortModel", () => {
    it("maps webview SortSpec onto ag-grid SortModelItem", () => {
      assert.deepEqual(
        toSortModel([
          { colId: "A", dir: "asc" },
          { colId: "B", dir: "desc" },
        ]),
        [
          { colId: "A", sort: "asc" },
          { colId: "B", sort: "desc" },
        ],
      );
    });

    it("returns an empty array for no sort", () => {
      assert.deepEqual(toSortModel([]), []);
    });
  });

  describe("stripIndexCell", () => {
    it("removes the leading index cell and maps undefined to null", () => {
      assert.deepEqual(stripIndexCell(["", "a", null, undefined]), [
        "a",
        null,
        null,
      ]);
      assert.deepEqual(stripIndexCell(["", "x"]), ["x"]);
    });

    it("handles undefined input and an empty header row", () => {
      assert.deepEqual(stripIndexCell(["", "only"]), ["only"]);
      assert.deepEqual(stripIndexCell(undefined), []);
      assert.deepEqual(stripIndexCell([]), []);
    });
  });
});
