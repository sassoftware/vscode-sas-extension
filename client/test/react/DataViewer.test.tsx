import { useEffect } from "react";

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import type { ColumnState } from "ag-grid-community";
import { expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";

import type { ManageColumnsProps } from "../../src/webview/ManageColumns/ManageColumns";

type GridVisibleEvent = {
  api: {
    getColumnState: () => ColumnState[];
  };
};

type GridProps = {
  onColumnVisible: (event: GridVisibleEvent) => void;
};

type MockColumnMenu = {
  column: {
    colId: string;
  };
};

const visibleColumns = [{ field: "#" }, { field: "col1" }, { field: "col2" }];

const columnState: ColumnState[] = [
  { colId: "#" },
  { colId: "col1", hide: false },
  { colId: "col2", hide: false },
];

// Mock React initialization at module scope.
const createRootRender = sinon.stub();

const createRoot = sinon.stub().returns({
  render: createRootRender,
});

// Mock hooks used by DataViewer.
const mockUseDataViewer = sinon.stub();
const mockUseTheme = sinon.stub().returns("test-theme");

const resetSelection = sinon.stub();
const onSelectionKeyDown = sinon.stub();

const mockUseSelectionRectangle = sinon.stub().callsFake(() => ({
  onKeyDown: onSelectionKeyDown,
  resetSelection,
}));

// Capture AG Grid props after rendering, not during rendering.
let lastGridProps: GridProps | undefined;

const MockAgGridReact = (props: GridProps) => {
  useEffect(() => {
    lastGridProps = props;

    return () => {
      lastGridProps = undefined;
    };
  }, [props]);

  return <div data-testid="ag-grid" />;
};

// Capture Manage Columns callbacks.
const mockManageColumns = sinon.spy((props: ManageColumnsProps) => {
  void props;
  return null;
});

// Load DataViewer with mocked dependencies.
const { DataViewer }: typeof import("../../src/webview/DataViewer") =
  proxyquire.noCallThru()("../../src/webview/DataViewer", {
    "react-dom/client": {
      createRoot,
    },

    "ag-grid-react": {
      AgGridReact: MockAgGridReact,
    },

    "./TableFilter": {
      __esModule: true,
      default: () => <div data-testid="table-filter" />,
    },

    "./ColumnMenu": {
      __esModule: true,
      default: () => <div data-testid="column-menu" />,
    },

    "./ManageColumns": {
      __esModule: true,
      default: mockManageColumns,
    },

    "./useTheme": {
      __esModule: true,
      default: mockUseTheme,
    },

    "./useDataViewer": {
      __esModule: true,
      default: mockUseDataViewer,
    },

    "./useSelectionRectangle": {
      __esModule: true,
      default: mockUseSelectionRectangle,
    },

    ".": {
      "@noCallThru": true,
    },

    "./DataViewer.css": {
      "@noCallThru": true,
    },

    "ag-grid-community/styles/ag-grid.css": {
      "@noCallThru": true,
    },

    "ag-grid-community/styles/ag-theme-alpine.css": {
      "@noCallThru": true,
    },
  });

const createDataViewerState = () => {
  const dismissMenu = sinon.stub();
  const openManageColumns = sinon.stub().resolves(true);
  const onGridReady = sinon.stub();
  const refreshResults = sinon.stub();
  const setColumns = sinon.stub();
  const setManageColumnsOpen = sinon.stub();

  const applyColumnState = sinon.stub();
  const getColumnState = sinon.stub().returns(columnState);
  const getFocusedCell = sinon.stub();
  const setFocusedCell = sinon.stub();

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

  const state = {
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
  };

  return {
    state,
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

type MockViewerState = Omit<
  ReturnType<typeof createDataViewerState>["state"],
  "columnMenu"
> & {
  columnMenu: MockColumnMenu | undefined;
};

const renderViewer = (state: MockViewerState) => {
  mockUseDataViewer.returns(state);
  render(<DataViewer />);
};

const getManageColumnsProps = (): ManageColumnsProps => {
  if (!mockManageColumns.called) {
    throw new Error("Manage Columns was not rendered");
  }

  return mockManageColumns.firstCall.args[0];
};

const triggerColumnVisible = (
  viewer: ReturnType<typeof createDataViewerState>,
) => {
  const gridProps = lastGridProps;

  if (!gridProps) {
    throw new Error("AG Grid props were not captured");
  }

  act(() => {
    gridProps.onColumnVisible({
      api: viewer.gridRef.current.api,
    });
  });
};

describe("DataViewer", () => {
  beforeEach(() => {
    mockUseDataViewer.reset();
    mockUseTheme.resetHistory();
    mockManageColumns.resetHistory();
    mockUseSelectionRectangle.resetHistory();

    createRoot.resetHistory();
    createRootRender.resetHistory();

    resetSelection.resetHistory();
    onSelectionKeyDown.resetHistory();

    lastGridProps = undefined;

    document.body.innerHTML = `
      <div
        class="data-viewer-container"
        data-allow-download="true"
      ></div>
      <div data-title="TEST.TABLE"></div>
    `;
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
  });

  it("renders the table viewer when columns are available", () => {
    const viewer = createDataViewerState();

    renderViewer(viewer.state);

    expect(screen.getByRole("heading", { name: "TEST.TABLE" })).to.exist;

    expect(screen.getByTestId("table-filter")).to.exist;
    expect(screen.getByTestId("ag-grid")).to.exist;
  });

  it("does not render the viewer when no columns are available", () => {
    const viewer = createDataViewerState();

    renderViewer({
      ...viewer.state,
      columns: [],
    });

    expect(screen.queryByTestId("ag-grid")).to.equal(null);
    expect(screen.queryByTestId("table-filter")).to.equal(null);
  });

  it("restores the focused grid cell when the panel receives focus", () => {
    const viewer = createDataViewerState();

    const focusedCell = {
      rowIndex: 4,
      column: "col1",
    };

    viewer.getFocusedCell.returns(focusedCell);

    renderViewer(viewer.state);

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

    expect(viewer.getFocusedCell.calledOnce).to.equal(true);

    expect(
      viewer.setFocusedCell.calledOnceWithExactly(
        focusedCell.rowIndex,
        focusedCell.column,
      ),
    ).to.equal(true);
  });

  it("shows the all-columns-hidden overlay", () => {
    const viewer = createDataViewerState();

    viewer.getColumnState.returns([
      { colId: "#" },
      { colId: "col1", hide: true },
      { colId: "col2", hide: true },
    ]);

    renderViewer(viewer.state);

    triggerColumnVisible(viewer);

    expect(screen.getByText("All columns are hidden.")).to.exist;

    expect(screen.getByRole("button", { name: "Manage Columns" })).to.exist;
  });

  it("opens Manage Columns from the all-columns-hidden overlay", () => {
    const viewer = createDataViewerState();

    viewer.getColumnState.returns([
      { colId: "#" },
      { colId: "col1", hide: true },
      { colId: "col2", hide: true },
    ]);

    renderViewer(viewer.state);

    triggerColumnVisible(viewer);

    fireEvent.click(screen.getByRole("button", { name: "Manage Columns" }));

    expect(viewer.openManageColumns.calledOnce).to.equal(true);
  });

  it("closes Manage Columns through its onClose callback", () => {
    const viewer = createDataViewerState();

    renderViewer({
      ...viewer.state,
      manageColumnsOpen: true,
    });

    const manageColumnsProps = getManageColumnsProps();

    act(() => {
      manageColumnsProps.onClose();
    });

    expect(viewer.setManageColumnsOpen.calledOnceWithExactly(false)).to.equal(
      true,
    );
  });

  it("applies Manage Columns changes to the grid", () => {
    const viewer = createDataViewerState();

    renderViewer({
      ...viewer.state,
      manageColumnsOpen: true,
    });

    const manageColumnsProps = getManageColumnsProps();

    const updatedColumnState: ColumnState[] = [
      { colId: "col2", hide: false },
      { colId: "col1", hide: true },
    ];

    act(() => {
      manageColumnsProps.onApply(updatedColumnState);
    });

    expect(viewer.applyColumnState.calledOnce).to.equal(true);

    expect(viewer.applyColumnState.firstCall.args[0]).to.deep.equal({
      state: [
        { colId: "#" },
        { colId: "col2", hide: false },
        { colId: "col1", hide: true },
      ],
      applyOrder: true,
    });

    expect(viewer.getColumnState.called).to.equal(true);

    expect(viewer.setManageColumnsOpen.calledOnceWithExactly(false)).to.equal(
      true,
    );
  });

  it("updates the hidden-columns overlay after applying changes", () => {
    const viewer = createDataViewerState();

    viewer.getColumnState.returns([
      { colId: "#" },
      { colId: "col1", hide: true },
      { colId: "col2", hide: true },
    ]);

    renderViewer({
      ...viewer.state,
      manageColumnsOpen: true,
    });

    const manageColumnsProps = getManageColumnsProps();

    act(() => {
      manageColumnsProps.onApply([
        { colId: "col1", hide: true },
        { colId: "col2", hide: true },
      ]);
    });

    expect(viewer.getColumnState.called).to.equal(true);

    expect(screen.getByText("All columns are hidden.")).to.exist;
  });

  it("resets the columns when the panel refreshes data", () => {
    const viewer = createDataViewerState();

    renderViewer(viewer.state);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            command: "panel:refreshData",
          },
        }),
      );
    });

    expect(viewer.refreshResults.calledOnceWithExactly(undefined)).to.equal(
      true,
    );

    expect(viewer.setColumns.calledOnceWithExactly([])).to.equal(true);
  });

  it("dismisses the column menu when Escape is pressed", () => {
    const viewer = createDataViewerState();

    renderViewer({
      ...viewer.state,
      columnMenu: {
        column: { colId: "col1" },
      },
    });

    fireEvent.keyDown(document, {
      key: "Escape",
    });

    expect(viewer.dismissMenu.calledOnce).to.equal(true);
    expect(onSelectionKeyDown.calledOnce).to.equal(true);
  });
});
