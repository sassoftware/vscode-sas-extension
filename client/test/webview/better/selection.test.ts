// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import type { CellRange } from "../../../src/webview/better/protocol";
import {
  bounds,
  cellCount,
  cellKey,
  containsCell,
  iterCells,
  rectFromTo,
  singleCell,
  toggleCell,
} from "../../../src/webview/better/selection";

describe("better selection", () => {
  describe("singleCell / rectFromTo", () => {
    it("creates a 1x1 rectangle", () => {
      assert.deepEqual(singleCell(3, 4), [
        { fromRow: 3, toRow: 3, fromCol: 4, toCol: 4 },
      ]);
    });

    it("normalises swapped corners", () => {
      assert.deepEqual(rectFromTo({ row: 5, col: 1 }, { row: 2, col: 4 }), {
        fromRow: 2,
        toRow: 5,
        fromCol: 1,
        toCol: 4,
      });
    });
  });

  describe("containsCell", () => {
    const ranges: CellRange[] = [
      { fromRow: 0, toRow: 2, fromCol: 1, toCol: 3 },
    ];
    it("is inclusive on all edges", () => {
      assert.isTrue(containsCell(ranges, 0, 1));
      assert.isTrue(containsCell(ranges, 2, 3));
      assert.isTrue(containsCell(ranges, 1, 2));
    });
    it("is false just outside", () => {
      assert.isFalse(containsCell(ranges, 3, 2));
      assert.isFalse(containsCell(ranges, 1, 4));
      assert.isFalse(containsCell([], 1, 1));
    });
  });

  describe("toggleCell", () => {
    it("adds a cell not currently selected", () => {
      const out = toggleCell([], 1, 1);
      assert.deepEqual(out, [{ fromRow: 1, toRow: 1, fromCol: 1, toCol: 1 }]);
    });
    it("removes the whole containing rectangle when a covered cell is toggled", () => {
      const sel: CellRange[] = [{ fromRow: 1, toRow: 2, fromCol: 1, toCol: 2 }];
      // Any cell wholly covered by the rectangle removes the rectangle.
      assert.deepEqual(toggleCell(sel, 2, 2), []);
      assert.deepEqual(toggleCell(sel, 1, 1), []);
    });
  });

  describe("iterCells", () => {
    it("enumerates row-major with no duplicates across overlap", () => {
      const ranges: CellRange[] = [
        { fromRow: 0, toRow: 1, fromCol: 0, toCol: 1 },
        { fromRow: 1, toRow: 1, fromCol: 0, toCol: 0 }, // overlaps (1,0)
      ];
      const cells = iterCells(ranges);
      assert.deepEqual(cells, [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 1, col: 0 },
        { row: 1, col: 1 },
      ]);
      assert.strictEqual(cellKey(1, 0), "1|0");
    });
  });

  describe("cellCount / bounds", () => {
    it("counts rectangle areas", () => {
      assert.strictEqual(
        cellCount([{ fromRow: 1, toRow: 3, fromCol: 0, toCol: 4 }]),
        15,
      );
    });
    it("returns null bounds for empty selection", () => {
      assert.isNull(bounds([]));
    });
    it("computes the bounding box across disjoint rects", () => {
      const b = bounds([
        { fromRow: 1, toRow: 2, fromCol: 3, toCol: 4 },
        { fromRow: 5, toRow: 6, fromCol: 0, toCol: 1 },
      ]);
      assert.deepEqual(b, {
        fromRow: 1,
        toRow: 6,
        fromCol: 0,
        toCol: 4,
      });
    });
  });
});
