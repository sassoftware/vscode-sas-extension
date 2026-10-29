// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";

import { beforeEach, describe, expect, it, vi } from "vitest";

import ColumnMenu, { getColumnMenu } from "../../src/webview/ColumnMenu";

const mocks = vi.hoisted(() => ({
  useTheme: vi.fn(() => "test-theme"),
}));

vi.mock("../../src/webview/useTheme", () => ({
  default: mocks.useTheme,
}));

vi.mock("../../src/webview/useDataViewer", () => ({
  applyColumnState: vi.fn(),
}));

const createColumn = () => ({
  colId: "col1",
  getSort: vi.fn(() => null),
  getPinned: vi.fn(() => null),
});

const createProps = () => {
  const dismissMenu = vi.fn();
  const loadColumnProperties = vi.fn();
  const pinColumn = vi.fn();
  const removeAllSorting = vi.fn();
  const removeFromSort = vi.fn();
  const sortColumn = vi.fn();
  const onManageColumns = vi.fn();

  return {
    props: {
      column: createColumn(),
      dismissMenu,
      hasSort: false,
      left: 10,
      loadColumnProperties,
      onManageColumns,
      pinColumn,
      removeAllSorting,
      removeFromSort,
      sortColumn,
      top: 20,
    },
    dismissMenu,
    loadColumnProperties,
    pinColumn,
    removeAllSorting,
    removeFromSort,
    sortColumn,
    onManageColumns,
  };
};

describe("ColumnMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(document.body, "clientWidth", {
      configurable: true,
      value: 1000,
    });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 200, 100),
    );
  });

  it("renders the Manage Columns menu item", () => {
    const menu = createProps();

    render(<ColumnMenu {...menu.props} />);

    expect(screen.getByText("Manage Columns")).toBeTruthy();
  });

  it("calls onManageColumns when Manage Columns is selected", () => {
    const menu = createProps();

    render(<ColumnMenu {...menu.props} />);

    fireEvent.click(screen.getByText("Manage Columns"));

    expect(menu.onManageColumns).toHaveBeenCalledTimes(1);
  });
});
