// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { ColumnState } from "ag-grid-community";
import { expect } from "chai";

import {
  filterColumns,
  getColumnId,
  getManageableColumns,
  isColumnStateSame,
  moveFilteredToDisplayed,
  moveFilteredToHidden,
  moveSelectedDown,
  moveSelectedToBottom,
  moveSelectedToDisplayed,
  moveSelectedToHidden,
  moveSelectedToTop,
  moveSelectedUp,
  splitColumns,
} from "../../../src/webview/ManageColumns/columnStateUtils";

const column = (colId: string, hide = false): ColumnState => ({
  colId,
  hide,
});

describe("columnStateUtils", () => {
  describe("getColumnId", () => {
    it("returns the column id", () => {
      expect(getColumnId(column("col1"))).to.equal("col1");
    });
  });

  describe("getManageableColumns", () => {
    it("excludes the row number column", () => {
      const state = [column("#"), column("col1"), column("col2")];

      expect(getManageableColumns(state)).to.deep.equal([
        column("col1"),
        column("col2"),
      ]);
    });

    it("preserves column order", () => {
      const state = [
        column("col3"),
        column("#"),
        column("col1"),
        column("col2"),
      ];

      expect(getManageableColumns(state).map(getColumnId)).to.deep.equal([
        "col3",
        "col1",
        "col2",
      ]);
    });
  });

  describe("splitColumns", () => {
    it("separates displayed and hidden columns", () => {
      const state = [
        column("col1"),
        column("col2", true),
        column("col3"),
        column("col4", true),
      ];

      const result = splitColumns(state);

      expect(result.displayedColumns).to.deep.equal([
        column("col1"),
        column("col3"),
      ]);

      expect(result.hiddenColumns).to.deep.equal([
        column("col2", true),
        column("col4", true),
      ]);
    });

    it("preserves the order of displayed and hidden columns", () => {
      const state = [
        column("col4", true),
        column("col3"),
        column("col2", true),
        column("col1"),
      ];

      const result = splitColumns(state);

      expect(result.displayedColumns.map(getColumnId)).to.deep.equal([
        "col3",
        "col1",
      ]);

      expect(result.hiddenColumns.map(getColumnId)).to.deep.equal([
        "col4",
        "col2",
      ]);
    });
  });

  describe("filterColumns", () => {
    const state = [column("col1Name"), column("col2Name"), column("col3Age")];

    it("filters columns by partial name", () => {
      expect(filterColumns(state, "Name").map(getColumnId)).to.deep.equal([
        "col1Name",
        "col2Name",
      ]);
    });

    it("filters columns case-insensitively", () => {
      expect(filterColumns(state, "COL1").map(getColumnId)).to.deep.equal([
        "col1Name",
      ]);
    });

    it("returns all columns for an empty filter", () => {
      expect(filterColumns(state, "")).to.deep.equal(state);
    });

    it("returns an empty array when there are no matches", () => {
      expect(filterColumns(state, "missing")).to.deep.equal([]);
    });
  });

  describe("isColumnStateSame", () => {
    it("returns true when the states are the same", () => {
      const current = [column("col1"), column("col2", true)];

      const original = [column("#"), column("col1"), column("col2", true)];

      expect(isColumnStateSame(current, original)).to.equal(true);
    });

    it("returns false when column visibility changes", () => {
      const current = [column("col1"), column("col2")];

      const original = [column("#"), column("col1"), column("col2", true)];

      expect(isColumnStateSame(current, original)).to.equal(false);
    });

    it("returns false when column order changes", () => {
      const current = [column("col2"), column("col1")];

      const original = [column("#"), column("col1"), column("col2")];

      expect(isColumnStateSame(current, original)).to.equal(false);
    });
  });

  describe("moveSelectedToDisplayed", () => {
    it("moves selected hidden columns to displayed", () => {
      const state = [
        column("col1"),
        column("col2", true),
        column("col3", true),
        column("col4"),
      ];

      const result = moveSelectedToDisplayed(state, new Set(["col2"]));

      expect(result).to.deep.equal([
        column("col1"),
        column("col4"),
        column("col2"),
        column("col3", true),
      ]);
    });

    it("moves multiple selected hidden columns while preserving their order", () => {
      const state = [
        column("col1"),
        column("col2", true),
        column("col3", true),
        column("col4", true),
      ];

      const result = moveSelectedToDisplayed(state, new Set(["col2", "col4"]));

      expect(result).to.deep.equal([
        column("col1"),
        column("col2"),
        column("col4"),
        column("col3", true),
      ]);
    });
  });

  describe("moveFilteredToDisplayed", () => {
    it("moves only filtered hidden columns to displayed", () => {
      const state = [
        column("col1"),
        column("col2", true),
        column("col3", true),
        column("col4", true),
      ];

      const result = moveFilteredToDisplayed(state, [
        column("col2", true),
        column("col4", true),
      ]);

      expect(result).to.deep.equal([
        column("col1"),
        column("col2"),
        column("col4"),
        column("col3", true),
      ]);
    });

    it("does not move hidden columns outside the filter", () => {
      const state = [
        column("col1"),
        column("col2", true),
        column("col3", true),
      ];

      const result = moveFilteredToDisplayed(state, [column("col2", true)]);

      expect(result).to.deep.equal([
        column("col1"),
        column("col2"),
        column("col3", true),
      ]);
    });
  });

  describe("moveSelectedToHidden", () => {
    it("hides selected columns", () => {
      const state = [column("col1"), column("col2"), column("col3")];

      const result = moveSelectedToHidden(state, new Set(["col1", "col3"]));

      expect(result).to.deep.equal([
        column("col1", true),
        column("col2"),
        column("col3", true),
      ]);
    });

    it("leaves unselected columns unchanged", () => {
      const state = [column("col1"), column("col2", true)];

      const result = moveSelectedToHidden(state, new Set(["col1"]));

      expect(result).to.deep.equal([
        column("col1", true),
        column("col2", true),
      ]);
    });
  });

  describe("moveFilteredToHidden", () => {
    it("hides only filtered displayed columns", () => {
      const state = [column("col1"), column("col2"), column("col3")];

      const result = moveFilteredToHidden(state, [
        column("col1"),
        column("col3"),
      ]);

      expect(result).to.deep.equal([
        column("col1", true),
        column("col2"),
        column("col3", true),
      ]);
    });

    it("does not modify already hidden columns", () => {
      const state = [column("col1"), column("col2", true), column("col3")];

      const result = moveFilteredToHidden(state, [column("col1")]);

      expect(result).to.deep.equal([
        column("col1", true),
        column("col2", true),
        column("col3"),
      ]);
    });
  });

  describe("moveSelectedToTop", () => {
    it("moves selected displayed columns to the top", () => {
      const state = [
        column("col1"),
        column("col2"),
        column("col3"),
        column("col4"),
        column("col5", true),
      ];

      const result = moveSelectedToTop(state, new Set(["col2", "col4"]));

      expect(result.map(getColumnId)).to.deep.equal([
        "col2",
        "col4",
        "col1",
        "col3",
        "col5",
      ]);
    });

    it("keeps hidden columns after displayed columns", () => {
      const state = [
        column("col1"),
        column("col2", true),
        column("col3"),
        column("col4", true),
      ];

      const result = moveSelectedToTop(state, new Set(["col3"]));

      expect(result).to.deep.equal([
        column("col3"),
        column("col1"),
        column("col2", true),
        column("col4", true),
      ]);
    });
  });

  describe("moveSelectedUp", () => {
    it("moves a selected displayed column up one position", () => {
      const state = [column("col1"), column("col2"), column("col3")];

      const result = moveSelectedUp(state, new Set(["col2"]));

      expect(result.map(getColumnId)).to.deep.equal(["col2", "col1", "col3"]);
    });

    it("moves multiple adjacent selected columns up together", () => {
      const state = [
        column("col1"),
        column("col2"),
        column("col3"),
        column("col4"),
      ];

      const result = moveSelectedUp(state, new Set(["col2", "col3"]));

      expect(result.map(getColumnId)).to.deep.equal([
        "col2",
        "col3",
        "col1",
        "col4",
      ]);
    });

    it("does not move the first displayed column further up", () => {
      const state = [column("col1"), column("col2"), column("col3")];

      const result = moveSelectedUp(state, new Set(["col1"]));

      expect(result.map(getColumnId)).to.deep.equal(["col1", "col2", "col3"]);
    });
  });

  describe("moveSelectedDown", () => {
    it("moves a selected displayed column down one position", () => {
      const state = [column("col1"), column("col2"), column("col3")];

      const result = moveSelectedDown(state, new Set(["col2"]));

      expect(result.map(getColumnId)).to.deep.equal(["col1", "col3", "col2"]);
    });

    it("moves multiple adjacent selected columns down together", () => {
      const state = [
        column("col1"),
        column("col2"),
        column("col3"),
        column("col4"),
      ];

      const result = moveSelectedDown(state, new Set(["col2", "col3"]));

      expect(result.map(getColumnId)).to.deep.equal([
        "col1",
        "col4",
        "col2",
        "col3",
      ]);
    });

    it("does not move the last displayed column further down", () => {
      const state = [column("col1"), column("col2"), column("col3")];

      const result = moveSelectedDown(state, new Set(["col3"]));

      expect(result.map(getColumnId)).to.deep.equal(["col1", "col2", "col3"]);
    });
  });

  describe("moveSelectedToBottom", () => {
    it("moves selected displayed columns to the bottom", () => {
      const state = [
        column("col1"),
        column("col2"),
        column("col3"),
        column("col4"),
        column("col5", true),
      ];

      const result = moveSelectedToBottom(state, new Set(["col1", "col3"]));

      expect(result.map(getColumnId)).to.deep.equal([
        "col2",
        "col4",
        "col1",
        "col3",
        "col5",
      ]);
    });

    it("keeps hidden columns after displayed columns", () => {
      const state = [
        column("col1"),
        column("col2", true),
        column("col3"),
        column("col4", true),
      ];

      const result = moveSelectedToBottom(state, new Set(["col1"]));

      expect(result).to.deep.equal([
        column("col3"),
        column("col1"),
        column("col2", true),
        column("col4", true),
      ]);
    });
  });
});
