// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React from "react";

import { act, fireEvent, render, screen } from "@testing-library/react";

import type { ColumnState } from "ag-grid-community";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataViewer } from "../../src/webview/DataViewer";

const mocks = vi.hoisted(() => ({
  createRootRender: vi.fn(),
  useDataViewer: vi.fn(),
  useTheme: vi.fn(() => "test-theme"),
  manageColumns: vi.fn(
    (_props: {
      columnState: ColumnState[];
      onClose: () => void;
      onApply: (state: ColumnState[]) => void;
    }) => null,
  ),
}));

vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({
    render: mocks.createRootRender,
  })),
}));

vi.mock("ag-grid-react", () => ({
  AgGridReact: () => <div data-testid="ag-grid" />,
}));

vi.mock("../../src/webview/TableFilter", () => ({
  default: () => <div data-testid="table-filter" />,
}));

vi.mock("../../src/webview/ColumnMenu", () => ({
  default: () => <div data-testid="column-menu" />,
}));

vi.mock("../../src/webview/ManageColumns", () => ({
  default: mocks.manageColumns,
}));

vi.mock("../../src/webview/useTheme", () => ({
  default: mocks.useTheme,
}));

vi.mock("../../src/webview/useDataViewer", () => ({
  default: mocks.useDataViewer,
}));

const visibleColumns = [
  {
    field: "#",
  },
  {
    field: "col1",
  },
  {
    field: "col2",
  },
];

const createDataViewerState = () => {
  const dismissMenu = vi.fn();
  const retryColumns = vi.fn();
  const openManageColumns = vi.fn().mockResolvedValue(true);
  const onGridReady = vi.fn();
  const refreshResults = vi.fn();
  const resetColumns = vi.fn();
  const setManageColumnsOpen = vi.fn();

  const applyColumnState = vi.fn();
  const getFocusedCell = vi.fn();
  const setFocusedCell = vi.fn();

  const gridRef = {
    current: {
      api: {
        applyColumnState,
        getFocusedCell,
        setFocusedCell,
      },
    },
  };

  return {
    state: {
      columnMenu: undefined,
      columns: visibleColumns,
      dismissMenu,
      gridRef,
      columnsLoadFailed: false,
      retryColumns,
      openManageColumns,
      manageColumnsOpen: false,
      onGridReady,
      refreshResults,
      resetColumns,
      setManageColumnsOpen,
    },
    dismissMenu,
    retryColumns,
    openManageColumns,
    onGridReady,
    refreshResults,
    resetColumns,
    setManageColumnsOpen,
    applyColumnState,
    getFocusedCell,
    setFocusedCell,
  };
};

describe("DataViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    document.body.innerHTML = `
      <div data-title="TEST.TABLE"></div>
    `;
  });

  it("renders nothing while columns are loading", () => {
    const viewer = createDataViewerState();

    mocks.useDataViewer.mockReturnValue({
      ...viewer.state,
      columns: [],
    });

    const { container } = render(<DataViewer />);

    expect(container.firstChild).toBeNull();
  });

  it("shows retry when loading columns fails", () => {
    const viewer = createDataViewerState();

    mocks.useDataViewer.mockReturnValue({
      ...viewer.state,
      columns: [],
      columnsLoadFailed: true,
    });

    render(<DataViewer />);

    expect(
      screen.getByRole("heading", {
        name: "TEST.TABLE",
      }),
    ).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Retry loading table",
      }),
    );

    expect(viewer.retryColumns).toHaveBeenCalledTimes(1);
  });

  it("renders the table viewer when columns are available", () => {
    const viewer = createDataViewerState();

    mocks.useDataViewer.mockReturnValue(viewer.state);

    render(<DataViewer />);

    expect(
      screen.getByRole("heading", {
        name: "TEST.TABLE",
      }),
    ).toBeTruthy();

    expect(screen.getByTestId("table-filter")).toBeTruthy();
    expect(screen.getByTestId("ag-grid")).toBeTruthy();
  });

  it("dismisses the column menu when Escape is pressed", () => {
    const viewer = createDataViewerState();

    mocks.useDataViewer.mockReturnValue({
      ...viewer.state,
      columnMenu: {},
    });

    render(<DataViewer />);

    fireEvent.keyDown(document, {
      key: "Escape",
    });

    expect(viewer.dismissMenu).toHaveBeenCalledTimes(1);
  });

  it("dismisses the column menu without changing focus when the window loses focus", () => {
    const viewer = createDataViewerState();

    mocks.useDataViewer.mockReturnValue({
      ...viewer.state,
      columnMenu: {},
    });

    render(<DataViewer />);

    fireEvent.blur(window);

    expect(viewer.dismissMenu).toHaveBeenCalledTimes(1);
    expect(viewer.dismissMenu).toHaveBeenCalledWith(false);
  });

  it("refreshes results and resets columns on panel refresh", () => {
    const viewer = createDataViewerState();

    mocks.useDataViewer.mockReturnValue(viewer.state);

    render(<DataViewer />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            command: "panel:refreshData",
          },
        }),
      );
    });

    expect(viewer.refreshResults).toHaveBeenCalledTimes(1);
    expect(viewer.refreshResults).toHaveBeenCalledWith(undefined);

    expect(viewer.resetColumns).toHaveBeenCalledTimes(1);
  });

  it("restores the focused grid cell when the panel receives focus", () => {
    const viewer = createDataViewerState();

    const focusedCell = {
      rowIndex: 4,
      column: "col1",
    };

    viewer.getFocusedCell.mockReturnValue(focusedCell);

    mocks.useDataViewer.mockReturnValue(viewer.state);

    render(<DataViewer />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            command: "panel:changeFocus",
            data: {
              focused: true,
            },
          },
        }),
      );
    });

    expect(viewer.getFocusedCell).toHaveBeenCalledTimes(1);

    expect(viewer.setFocusedCell).toHaveBeenCalledTimes(1);
    expect(viewer.setFocusedCell).toHaveBeenCalledWith(
      focusedCell.rowIndex,
      focusedCell.column,
    );
  });

  it("does not restore grid focus when there is no focused cell", () => {
    const viewer = createDataViewerState();

    viewer.getFocusedCell.mockReturnValue(null);

    mocks.useDataViewer.mockReturnValue(viewer.state);

    render(<DataViewer />);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            command: "panel:changeFocus",
            data: {
              focused: true,
            },
          },
        }),
      );
    });

    expect(viewer.getFocusedCell).toHaveBeenCalledTimes(1);
    expect(viewer.setFocusedCell).not.toHaveBeenCalled();
  });

  it("shows the all-columns-hidden overlay", () => {
    const viewer = createDataViewerState();

    let updateColumnState: ((state: ColumnState[]) => void) | undefined;

    mocks.useDataViewer.mockImplementation((setColumnState) => {
      updateColumnState = setColumnState;

      return viewer.state;
    });

    render(<DataViewer />);

    act(() => {
      updateColumnState?.([
        {
          colId: "#",
        },
        {
          colId: "col1",
          hide: true,
        },
        {
          colId: "col2",
          hide: true,
        },
      ]);
    });

    expect(screen.getByText("All columns are hidden.")).toBeTruthy();

    expect(
      screen.getByRole("button", {
        name: "Manage Columns",
      }),
    ).toBeTruthy();
  });

  it("opens Manage Columns from the all-columns-hidden overlay", () => {
    const viewer = createDataViewerState();

    let updateColumnState: ((state: ColumnState[]) => void) | undefined;

    mocks.useDataViewer.mockImplementation((setColumnState) => {
      updateColumnState = setColumnState;

      return viewer.state;
    });

    render(<DataViewer />);

    act(() => {
      updateColumnState?.([
        {
          colId: "#",
        },
        {
          colId: "col1",
          hide: true,
        },
      ]);
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Manage Columns",
      }),
    );

    expect(viewer.openManageColumns).toHaveBeenCalledTimes(1);
  });

  it("renders Manage Columns when it is open", () => {
    const viewer = createDataViewerState();

    mocks.useDataViewer.mockReturnValue({
      ...viewer.state,
      manageColumnsOpen: true,
    });

    render(<DataViewer />);

    expect(mocks.manageColumns).toHaveBeenCalledTimes(1);
  });

  it("closes Manage Columns through its onClose callback", () => {
    const viewer = createDataViewerState();

    mocks.useDataViewer.mockReturnValue({
      ...viewer.state,
      manageColumnsOpen: true,
    });

    render(<DataViewer />);

    const manageColumnsProps = mocks.manageColumns.mock.calls[0][0];

    act(() => {
      manageColumnsProps.onClose();
    });

    expect(viewer.setManageColumnsOpen).toHaveBeenCalledTimes(1);
    expect(viewer.setManageColumnsOpen).toHaveBeenCalledWith(false);
  });

  it("applies Manage Columns changes to the grid", () => {
    const viewer = createDataViewerState();

    mocks.useDataViewer.mockReturnValue({
      ...viewer.state,
      manageColumnsOpen: true,
    });

    render(<DataViewer />);

    const manageColumnsProps = mocks.manageColumns.mock.calls[0][0];

    const updatedColumnState: ColumnState[] = [
      {
        colId: "col2",
        hide: false,
      },
      {
        colId: "col1",
        hide: true,
      },
    ];

    act(() => {
      manageColumnsProps.onApply(updatedColumnState);
    });

    expect(viewer.applyColumnState).toHaveBeenCalledTimes(1);

    expect(viewer.applyColumnState).toHaveBeenCalledWith({
      state: [
        {
          colId: "#",
        },
        {
          colId: "col2",
          hide: false,
        },
        {
          colId: "col1",
          hide: true,
        },
      ],
      applyOrder: true,
    });

    expect(viewer.setManageColumnsOpen).toHaveBeenCalledTimes(1);
    expect(viewer.setManageColumnsOpen).toHaveBeenCalledWith(false);
  });

  it("updates the hidden-columns state after applying Manage Columns changes", () => {
    const viewer = createDataViewerState();

    mocks.useDataViewer.mockReturnValue({
      ...viewer.state,
      manageColumnsOpen: true,
    });

    render(<DataViewer />);

    const manageColumnsProps = mocks.manageColumns.mock.calls[0][0];

    act(() => {
      manageColumnsProps.onApply([
        {
          colId: "col1",
          hide: true,
        },
        {
          colId: "col2",
          hide: true,
        },
      ]);
    });

    expect(screen.getByText("All columns are hidden.")).toBeTruthy();
  });
});
