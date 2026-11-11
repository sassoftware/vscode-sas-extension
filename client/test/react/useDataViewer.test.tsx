import { act, cleanup, renderHook, waitFor } from "@testing-library/react";

import { expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";

// Mock VS Code communication.
const postMessage = sinon.stub();

const mockVscode = {
  postMessage,
};

// Mock Manage Columns hook.
const openManageColumns = sinon.stub();
const setManageColumnsOpen = sinon.stub();
const mockUseManageColumns = sinon.stub();

// Define the mocked Column Menu function parameters.
type GetColumnMenuArgs = [
  api: unknown,
  column: { colId: string },
  rect: DOMRect,
  dismissMenu: () => void,
  loadColumnProperties: unknown,
  onManageColumns?: () => Promise<void>,
];

type MockColumnMenuResult = {
  column: { colId: string };
  dismissMenu: () => void;
  hasSort: boolean;
  left: number;
  top: number;
  loadColumnProperties: sinon.SinonStub;
  pinColumn: sinon.SinonStub;
  removeAllSorting: sinon.SinonStub;
  removeFromSort: sinon.SinonStub;
  sortColumn: sinon.SinonStub;
  onManageColumns: (() => Promise<void>) | undefined;
};

// Mock Column Menu creation.
// Explicitly type the Sinon stub to preserve its argument types.
const getColumnMenu = sinon
  .stub<GetColumnMenuArgs, MockColumnMenuResult>()
  .callsFake((...[, column, , dismissMenu, , onManageColumns]) => ({
    column,
    dismissMenu,
    hasSort: false,
    left: 0,
    top: 0,
    loadColumnProperties: sinon.stub(),
    pinColumn: sinon.stub(),
    removeAllSorting: sinon.stub(),
    removeFromSort: sinon.stub(),
    sortColumn: sinon.stub(),
    onManageColumns,
  }));

// Mock AG Grid module registration.
const registerModules = sinon.stub();

// Load the actual useDataViewer hook with mocked dependencies.
const {
  default: useDataViewer,
}: typeof import("../../src/webview/useDataViewer") = proxyquire.noCallThru()(
  "../../src/webview/useDataViewer",
  {
    uuid: {
      v4: () => "request-key",
    },

    "./vscode": {
      __esModule: true,
      default: mockVscode,
    },

    "./ColumnMenu": {
      getColumnMenu,
    },

    "./useManageColumns": {
      __esModule: true,
      default: mockUseManageColumns,
    },

    "./ColumnHeader": {
      __esModule: true,
      default: () => null,
    },

    "ag-grid-community": {
      ModuleRegistry: {
        registerModules,
      },
      AllCommunityModule: {},
    },
  },
);

// Simulate the response from the VS Code extension.
const respondWithColumns = (
  columns = [
    {
      name: "col1",
      type: "CHAR",
    },
    {
      name: "col2",
      type: "NUM",
    },
  ],
) => {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        key: "request-key",
        command: "response:loadColumns",
        data: {
          columns,
        },
      },
    }),
  );
};

// Wait until useDataViewer sends the column-loading request.
const waitForColumnRequest = async () => {
  await waitFor(() => {
    expect(
      postMessage.calledWithMatch({
        command: "request:loadColumns",
        key: "request-key",
      }),
    ).to.equal(true);
  });
};

// Load columns through the mocked VS Code messaging API.
const loadColumns = async (result: {
  current: ReturnType<typeof useDataViewer>;
}) => {
  await waitForColumnRequest();

  act(() => {
    respondWithColumns();
  });

  await waitFor(() => {
    expect(result.current.columns).to.have.length(3);
  });
};

describe("useDataViewer", () => {
  beforeEach(() => {
    postMessage.resetHistory();
    openManageColumns.reset();
    setManageColumnsOpen.resetHistory();
    mockUseManageColumns.reset();
    getColumnMenu.resetHistory();

    openManageColumns.resolves(true);

    mockUseManageColumns.returns({
      initialColumnState: [],
      manageColumnsOpen: false,
      setManageColumnsOpen,
      openManageColumns,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("loads columns and prepends the row number column", async () => {
    const { result } = renderHook(() => useDataViewer());

    await loadColumns(result);

    expect(result.current.columns.map((column) => column.field)).to.deep.equal([
      "#",
      "col1",
      "col2",
    ]);

    expect(result.current.columns[0]).to.include({
      field: "#",
      pinned: "left",
      lockPinned: true,
      lockPosition: true,
      sortable: false,
      suppressMovable: true,
    });
  });

  it("keeps the column menu open when Manage Columns fails to open", async () => {
    openManageColumns.resolves(false);

    const { result } = renderHook(() => useDataViewer());

    await loadColumns(result);

    const displayMenuForColumn =
      result.current.columns[1].headerComponentParams.displayMenuForColumn;

    act(() => {
      displayMenuForColumn(
        {},
        {
          colId: "col1",
        },
        new DOMRect(0, 0, 100, 20),
      );
    });

    await waitFor(() => {
      expect(result.current.columnMenu).to.not.equal(undefined);
    });

    expect(getColumnMenu.calledOnce).to.equal(true);

    const onManageColumns = getColumnMenu.firstCall.args[5];

    await act(async () => {
      await onManageColumns?.();
    });

    expect(openManageColumns.calledOnce).to.equal(true);

    // The column menu should remain open if Manage Columns
    // could not be opened.
    expect(result.current.columnMenu).to.not.equal(undefined);
  });

  it("dismisses the column menu after Manage Columns opens successfully", async () => {
    openManageColumns.resolves(true);

    const { result } = renderHook(() => useDataViewer());

    await loadColumns(result);

    const displayMenuForColumn =
      result.current.columns[1].headerComponentParams.displayMenuForColumn;

    act(() => {
      displayMenuForColumn(
        {},
        {
          colId: "col1",
        },
        new DOMRect(0, 0, 100, 20),
      );
    });

    await waitFor(() => {
      expect(result.current.columnMenu).to.not.equal(undefined);
    });

    expect(getColumnMenu.calledOnce).to.equal(true);

    const onManageColumns = getColumnMenu.firstCall.args[5];

    await act(async () => {
      await onManageColumns?.();
    });

    expect(openManageColumns.calledOnce).to.equal(true);

    await waitFor(() => {
      expect(result.current.columnMenu).to.equal(undefined);
    });
  });
});
