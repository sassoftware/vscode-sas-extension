// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React from "react";

import { fireEvent, render, screen, within } from "@testing-library/react";

import type { ColumnState } from "ag-grid-community";
import { beforeAll, describe, expect, it, vi } from "vitest";

import ManageColumns from "../../../src/webview/ManageColumns/ManageColumns";

vi.mock("../../../src/webview/ManageColumns/useResponsiveDialog", () => ({
  default: vi.fn(),
}));

vi.mock("../../../src/webview/ManageColumns/useDraggableDialog", () => ({
  default: () => ({
    handleDragStart: vi.fn(),
    handleDrag: vi.fn(),
    handleDragEnd: vi.fn(),
  }),
}));

vi.mock("../../../src/webview/ManageColumns/useColumnPanelResize", () => ({
  default: () => ({
    leftPanelRef: { current: null },
    rightPanelRef: { current: null },
    handleResizeStart: vi.fn(),
    handleResize: vi.fn(),
    handleResizeEnd: vi.fn(),
    handleResizeKeyDown: vi.fn(),
  }),
}));

const column = (colId: string, hide = false): ColumnState => ({
  colId,
  hide,
});

const defaultColumnState = [
  column("#"),
  column("col1"),
  column("col2"),
  column("col3", true),
  column("col4", true),
];

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function () {
      this.setAttribute("open", "");
    },
  });

  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function () {
      this.removeAttribute("open");
    },
  });
});

describe("ManageColumns", () => {
  it("renders displayed and hidden columns", () => {
    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    const hiddenList = screen.getByRole("listbox", {
      name: "Hidden columns",
    });

    const displayedList = screen.getByRole("listbox", {
      name: "Displayed columns",
    });

    expect(
      within(hiddenList).getByRole("option", { name: "col3" }),
    ).toBeTruthy();
    expect(
      within(hiddenList).getByRole("option", { name: "col4" }),
    ).toBeTruthy();

    expect(
      within(displayedList).getByRole("option", { name: "col1" }),
    ).toBeTruthy();

    expect(
      within(displayedList).getByRole("option", { name: "col2" }),
    ).toBeTruthy();

    expect(screen.queryByRole("option", { name: "#" })).toBeNull();
  });

  it("disables OK when column state has not changed", () => {
    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    const okButton = screen.getByRole("button", {
      name: "OK",
    });

    expect(okButton.hasAttribute("disabled")).toBe(true);
  });

  it("filters hidden columns and clears the filter", () => {
    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    const [hiddenFilter] = screen.getAllByRole("textbox", {
      name: "Filter",
    });

    fireEvent.change(hiddenFilter, {
      target: {
        value: "col3",
      },
    });

    const hiddenList = screen.getByRole("listbox", {
      name: "Hidden columns",
    });

    expect(
      within(hiddenList).getByRole("option", { name: "col3" }),
    ).toBeTruthy();

    expect(
      within(hiddenList).queryByRole("option", { name: "col4" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Clear",
      }),
    );

    expect(
      within(hiddenList).getByRole("option", { name: "col3" }),
    ).toBeTruthy();
    expect(
      within(hiddenList).getByRole("option", { name: "col4" }),
    ).toBeTruthy();
  });

  it("filters displayed columns and clears the filter", () => {
    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    const [, displayedFilter] = screen.getAllByRole("textbox", {
      name: "Filter",
    });

    fireEvent.change(displayedFilter, {
      target: {
        value: "col1",
      },
    });

    const displayedList = screen.getByRole("listbox", {
      name: "Displayed columns",
    });

    expect(
      within(displayedList).getByRole("option", { name: "col1" }),
    ).toBeTruthy();

    expect(
      within(displayedList).queryByRole("option", { name: "col2" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Clear",
      }),
    );

    expect(
      within(displayedList).getByRole("option", { name: "col1" }),
    ).toBeTruthy();

    expect(
      within(displayedList).getByRole("option", { name: "col2" }),
    ).toBeTruthy();
  });

  it("moves a selected hidden column to displayed columns", () => {
    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("option", {
        name: "col3",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add",
      }),
    );

    const displayedList = screen.getByRole("listbox", {
      name: "Displayed columns",
    });

    const hiddenList = screen.getByRole("listbox", {
      name: "Hidden columns",
    });

    expect(
      within(displayedList).getByRole("option", { name: "col3" }),
    ).toBeTruthy();

    expect(
      within(hiddenList).queryByRole("option", { name: "col3" }),
    ).toBeNull();

    expect(
      screen
        .getByRole("button", {
          name: "OK",
        })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("moves a selected displayed column to hidden columns", () => {
    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("option", {
        name: "col1",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove",
      }),
    );

    const hiddenList = screen.getByRole("listbox", {
      name: "Hidden columns",
    });

    const displayedList = screen.getByRole("listbox", {
      name: "Displayed columns",
    });

    expect(
      within(hiddenList).getByRole("option", { name: "col1" }),
    ).toBeTruthy();

    expect(
      within(displayedList).queryByRole("option", { name: "col1" }),
    ).toBeNull();
  });

  it("moves only filtered hidden columns when Add all is clicked", () => {
    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    const [hiddenFilter] = screen.getAllByRole("textbox", {
      name: "Filter",
    });

    fireEvent.change(hiddenFilter, {
      target: {
        value: "col3",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add all",
      }),
    );

    const displayedList = screen.getByRole("listbox", {
      name: "Displayed columns",
    });

    expect(
      within(displayedList).getByRole("option", { name: "col3" }),
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Hidden columns: No items are available."),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Clear",
      }),
    );

    const hiddenList = screen.getByRole("listbox", {
      name: "Hidden columns",
    });

    expect(
      within(hiddenList).getByRole("option", { name: "col4" }),
    ).toBeTruthy();

    expect(
      within(hiddenList).queryByRole("option", { name: "col3" }),
    ).toBeNull();
  });

  it("moves only filtered displayed columns when Remove all is clicked", () => {
    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    const [, displayedFilter] = screen.getAllByRole("textbox", {
      name: "Filter",
    });

    fireEvent.change(displayedFilter, {
      target: {
        value: "col1",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove all",
      }),
    );

    const hiddenList = screen.getByRole("listbox", {
      name: "Hidden columns",
    });

    expect(
      within(hiddenList).getByRole("option", { name: "col1" }),
    ).toBeTruthy();

    expect(
      screen.getByLabelText("Displayed columns: No items are available."),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Clear",
      }),
    );

    const displayedList = screen.getByRole("listbox", {
      name: "Displayed columns",
    });

    expect(
      within(displayedList).getByRole("option", { name: "col2" }),
    ).toBeTruthy();

    expect(
      within(displayedList).queryByRole("option", { name: "col1" }),
    ).toBeNull();
  });

  it("undoes column changes", () => {
    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("option", {
        name: "col3",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add",
      }),
    );

    const undoButton = screen.getByRole("button", {
      name: "Undo",
    });

    expect(undoButton.hasAttribute("disabled")).toBe(false);

    fireEvent.click(undoButton);

    const hiddenList = screen.getByRole("listbox", {
      name: "Hidden columns",
    });

    expect(
      within(hiddenList).getByRole("option", { name: "col3" }),
    ).toBeTruthy();

    expect(
      screen
        .getByRole("button", {
          name: "OK",
        })
        .hasAttribute("disabled"),
    ).toBe(true);
  });

  it("applies the updated column state", () => {
    const onApply = vi.fn();

    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={onApply}
      />,
    );

    fireEvent.click(
      screen.getByRole("option", {
        name: "col3",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Add",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "OK",
      }),
    );

    expect(onApply).toHaveBeenCalledTimes(1);

    expect(onApply).toHaveBeenCalledWith([
      column("col1"),
      column("col2"),
      column("col3"),
      column("col4", true),
    ]);
  });

  it("moves a displayed column down", () => {
    const onApply = vi.fn();

    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={vi.fn()}
        onApply={onApply}
      />,
    );

    fireEvent.click(
      screen.getByRole("option", {
        name: "col1",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Move down",
      }),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "OK",
      }),
    );

    expect(onApply).toHaveBeenCalledWith([
      column("col2"),
      column("col1"),
      column("col3", true),
      column("col4", true),
    ]);
  });

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn();

    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={onClose}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cancel",
      }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the close button is clicked", () => {
    const onClose = vi.fn();

    render(
      <ManageColumns
        columnState={defaultColumnState}
        onClose={onClose}
        onApply={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Close",
      }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
