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
  agGridProps: vi.fn(),
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
  AgGridReact: (props) => {
    mocks.agGridProps(props);
    return <div data-testid="ag-grid" />;
  },
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

const columnState: ColumnState[] = [
  {
    colId: "#",
  },
  {
    colId: "col1",
    hide: false,
  },
  {
    colId: "col2",
    hide: false,
  },
];

const createDataViewerState = () => {
  const dismissMenu = vi.fn();
  const openManageColumns = vi.fn().mockResolvedValue(true);
  const onGridReady = vi.fn();
  const refreshResults = vi.fn();
  const setColumns = vi.fn();
  const setManageColumnsOpen = vi.fn();

  const applyColumnState = vi.fn();
  const getColumnState = vi.fn(() => columnState);
  const getFocusedCell = vi.fn();
  const setFocusedCell = vi.fn();

  const gridRef = {
    current: {
      api: {
        applyColumnState,
        getColumnState,
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
      initialColumnState: columnState,
      openManageColumns,
      manageColumnsOpen: false,
      onGridReady,
      refreshResults,
      setColumns,
      setManageColumnsOpen,
    },
    dismissMenu,
    gridRef,
    openManageColumns,
    onGridReady,
    refreshResults,
    setColumns,
    setManageColumnsOpen,
    applyColumnState,
    getColumnState,
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

  it("shows the all-columns-hidden overlay", () => {
    const viewer = createDataViewerState();

    viewer.getColumnState.mockReturnValue([
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

    mocks.useDataViewer.mockReturnValue(viewer.state);

    render(<DataViewer />);

    act(() => {
      mocks.agGridProps.mock.lastCall?.[0].onColumnVisible({
        api: viewer.gridRef.current.api,
      });
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

    viewer.getColumnState.mockReturnValue([
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

    mocks.useDataViewer.mockReturnValue(viewer.state);

    render(<DataViewer />);

    act(() => {
      mocks.agGridProps.mock.lastCall?.[0].onColumnVisible({
        api: viewer.gridRef.current.api,
      });
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Manage Columns",
      }),
    );

    expect(viewer.openManageColumns).toHaveBeenCalledTimes(1);
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

    expect(viewer.getColumnState).toHaveBeenCalled();

    expect(viewer.setManageColumnsOpen).toHaveBeenCalledTimes(1);
    expect(viewer.setManageColumnsOpen).toHaveBeenCalledWith(false);
  });

  it("updates the hidden-columns state after applying Manage Columns changes", () => {
    const viewer = createDataViewerState();

    viewer.getColumnState.mockReturnValue([
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

    expect(viewer.getColumnState).toHaveBeenCalled();

    expect(screen.getByText("All columns are hidden.")).toBeTruthy();
  });
});
