import { act, cleanup, renderHook } from "@testing-library/react";

import type { ColumnState } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { expect } from "chai";
import sinon from "sinon";

import useManageColumns from "../../src/webview/useManageColumns";

const columnState: ColumnState[] = [
  { colId: "col1", hide: false },
  { colId: "col2", hide: true },
];

// Create a typed AG Grid instance without calling its constructor.
const createGridRef = (destroyed = false) => {
  const getColumnState = sinon.stub().returns(columnState);
  const isDestroyed = sinon.stub().returns(destroyed);
  const resetColumnState = sinon.stub();

  const grid = sinon.createStubInstance(AgGridReact);

  Object.defineProperty(grid, "api", {
    configurable: true,
    value: {
      getColumnState,
      isDestroyed,
      resetColumnState,
    },
  });

  return {
    current: grid,
  };
};

const createFetchColumns = () =>
  sinon.stub().resolves({
    columns: [
      { name: "col1", type: "CHAR" },
      { name: "col2", type: "NUM" },
    ],
  });

// Keep the fetch pending until the test explicitly resolves it.
const createPendingFetch = () => {
  let resolveFetch: () => void = () => {
    throw new Error("Fetch resolver was not initialized");
  };

  const pendingFetch = new Promise<void>((resolve) => {
    resolveFetch = resolve;
  });

  const fetchColumns = sinon.stub().callsFake(async () => {
    await pendingFetch;

    return {
      columns: [],
    };
  });

  return {
    fetchColumns,
    resolveFetch,
  };
};

// Simulate messages sent by the VS Code extension.
const dispatchPanelMessage = (command: string, data?: { focused: boolean }) => {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        command,
        data,
      },
    }),
  );
};

describe("useManageColumns", () => {
  let sandbox: sinon.SinonSandbox;
  let consoleErrorStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    consoleErrorStub = sandbox.stub(console, "error");
  });

  afterEach(() => {
    cleanup();
    sandbox.restore();
  });

  it("starts with Manage Columns closed", () => {
    const fetchColumns = createFetchColumns();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef: createGridRef(),
        fetchColumns,
      }),
    );

    expect(result.current.manageColumnsOpen).to.equal(false);
    expect(result.current.initialColumnState).to.deep.equal([]);
  });

  it("opens Manage Columns after columns are fetched successfully", async () => {
    const fetchColumns = createFetchColumns();
    const gridRef = createGridRef();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns,
      }),
    );

    let opened = false;

    await act(async () => {
      opened = await result.current.openManageColumns();
    });

    expect(opened).to.equal(true);
    expect(fetchColumns.calledOnce).to.equal(true);

    expect(result.current.initialColumnState).to.deep.equal(columnState);

    expect(result.current.manageColumnsOpen).to.equal(true);
  });

  it("does not open Manage Columns when fetching columns fails", async () => {
    const fetchColumns = sinon.stub().rejects(new Error("Fetch failed"));

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef: createGridRef(),
        fetchColumns,
      }),
    );

    let opened = true;

    await act(async () => {
      opened = await result.current.openManageColumns();
    });

    expect(opened).to.equal(false);
    expect(fetchColumns.calledOnce).to.equal(true);

    expect(result.current.initialColumnState).to.deep.equal([]);
    expect(result.current.manageColumnsOpen).to.equal(false);

    expect(consoleErrorStub.calledOnce).to.equal(true);
    expect(consoleErrorStub.firstCall.args[0]).to.be.instanceOf(Error);
  });

  it("prevents multiple Manage Columns opens while columns are loading", async () => {
    const { fetchColumns, resolveFetch } = createPendingFetch();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef: createGridRef(),
        fetchColumns,
      }),
    );

    let firstOpened = false;
    let secondOpened = true;

    await act(async () => {
      const firstOpen = result.current.openManageColumns();
      const secondOpen = result.current.openManageColumns();

      secondOpened = await secondOpen;

      resolveFetch();

      firstOpened = await firstOpen;
    });

    expect(fetchColumns.calledOnce).to.equal(true);
    expect(firstOpened).to.equal(true);
    expect(secondOpened).to.equal(false);

    expect(result.current.initialColumnState).to.deep.equal(columnState);

    expect(result.current.manageColumnsOpen).to.equal(true);
  });

  it("does not open Manage Columns if the viewer loses focus while columns are loading", async () => {
    const { fetchColumns, resolveFetch } = createPendingFetch();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef: createGridRef(),
        fetchColumns,
      }),
    );

    let opened = true;

    await act(async () => {
      const pendingOpen = result.current.openManageColumns();

      dispatchPanelMessage("panel:changeFocus", {
        focused: false,
      });

      resolveFetch();

      opened = await pendingOpen;
    });

    expect(fetchColumns.calledOnce).to.equal(true);
    expect(opened).to.equal(false);

    expect(result.current.initialColumnState).to.deep.equal([]);
    expect(result.current.manageColumnsOpen).to.equal(false);
  });

  it("closes Manage Columns when columns are invalidated", async () => {
    const { result } = renderHook(() =>
      useManageColumns({
        gridRef: createGridRef(),
        fetchColumns: createFetchColumns(),
      }),
    );

    await act(async () => {
      await result.current.openManageColumns();
    });

    expect(result.current.manageColumnsOpen).to.equal(true);

    act(() => {
      dispatchPanelMessage("panel:invalidateColumns");
    });

    expect(result.current.manageColumnsOpen).to.equal(false);
  });

  it("closes Manage Columns when the table is refreshed", async () => {
    const { result } = renderHook(() =>
      useManageColumns({
        gridRef: createGridRef(),
        fetchColumns: createFetchColumns(),
      }),
    );

    await act(async () => {
      await result.current.openManageColumns();
    });

    expect(result.current.manageColumnsOpen).to.equal(true);

    act(() => {
      dispatchPanelMessage("panel:refreshData");
    });

    expect(result.current.manageColumnsOpen).to.equal(false);
  });

  it("closes Manage Columns when the Table Viewer loses focus", async () => {
    const { result } = renderHook(() =>
      useManageColumns({
        gridRef: createGridRef(),
        fetchColumns: createFetchColumns(),
      }),
    );

    await act(async () => {
      await result.current.openManageColumns();
    });

    expect(result.current.manageColumnsOpen).to.equal(true);

    act(() => {
      dispatchPanelMessage("panel:changeFocus", {
        focused: false,
      });
    });

    expect(result.current.manageColumnsOpen).to.equal(false);
  });

  it("keeps Manage Columns open when the Table Viewer remains focused", async () => {
    const { result } = renderHook(() =>
      useManageColumns({
        gridRef: createGridRef(),
        fetchColumns: createFetchColumns(),
      }),
    );

    await act(async () => {
      await result.current.openManageColumns();
    });

    expect(result.current.manageColumnsOpen).to.equal(true);

    act(() => {
      dispatchPanelMessage("panel:changeFocus", {
        focused: true,
      });
    });

    expect(result.current.manageColumnsOpen).to.equal(true);
  });
});
