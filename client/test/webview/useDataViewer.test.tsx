// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { act, renderHook, waitFor } from "@testing-library/react";

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  postMessage: vi.fn(),
  openManageColumns: vi.fn(),
  setManageColumnsOpen: vi.fn(),
  getColumnMenu: vi.fn(
    (
      _api: unknown,
      column: { colId: string },
      _rect: DOMRect,
      dismissMenu: () => void,
      _loadColumnProperties: (columnName: string) => void,
      onManageColumns?: () => void | Promise<void>,
    ) => ({
      column,
      dismissMenu,
      hasSort: false,
      left: 0,
      top: 0,
      loadColumnProperties: vi.fn(),
      pinColumn: vi.fn(),
      removeAllSorting: vi.fn(),
      removeFromSort: vi.fn(),
      sortColumn: vi.fn(),
      onManageColumns,
    }),
  ),
  useManageColumns: vi.fn(),
}));

vi.mock("uuid", () => ({
  v4: () => "request-key",
}));

vi.mock("../../src/webview/ColumnMenu", () => ({
  getColumnMenu: mocks.getColumnMenu,
}));

vi.mock("../../src/webview/useManageColumns", () => ({
  default: mocks.useManageColumns,
}));

let useDataViewer: typeof import("../../src/webview/useDataViewer").default;

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

const waitForColumnRequest = async () => {
  await waitFor(() => {
    expect(mocks.postMessage).toHaveBeenCalledWith({
      command: "request:loadColumns",
      key: "request-key",
    });
  });
};

describe("useDataViewer", () => {
  beforeAll(async () => {
    vi.stubGlobal("acquireVsCodeApi", () => ({
      postMessage: mocks.postMessage,
    }));

    const module = await import("../../src/webview/useDataViewer");
    useDataViewer = module.default;
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.openManageColumns.mockResolvedValue(true);

    mocks.useManageColumns.mockReturnValue({
      initialColumnState: [],
      manageColumnsOpen: false,
      setManageColumnsOpen: mocks.setManageColumnsOpen,
      openManageColumns: mocks.openManageColumns,
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("loads columns and prepends the row number column", async () => {
    const { result } = renderHook(() => useDataViewer());

    await waitForColumnRequest();

    act(() => {
      respondWithColumns();
    });

    await waitFor(() => {
      expect(result.current.columns).toHaveLength(3);
    });

    expect(result.current.columns.map((column) => column.field)).toEqual([
      "#",
      "col1",
      "col2",
    ]);

    expect(result.current.columns[0]).toMatchObject({
      field: "#",
      pinned: "left",
      lockPinned: true,
      lockPosition: true,
      sortable: false,
      suppressMovable: true,
    });
  });

  it("keeps the column menu open when Manage Columns fails to open", async () => {
    mocks.openManageColumns.mockResolvedValue(false);

    const { result } = renderHook(() => useDataViewer());

    await waitForColumnRequest();

    act(() => {
      respondWithColumns();
    });

    await waitFor(() => {
      expect(result.current.columns).toHaveLength(3);
    });

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
      expect(result.current.columnMenu).toBeDefined();
    });

    const onManageColumns = mocks.getColumnMenu.mock.calls[0][5];

    await act(async () => {
      await onManageColumns?.();
    });

    expect(mocks.openManageColumns).toHaveBeenCalledTimes(1);
    expect(result.current.columnMenu).toBeDefined();
  });

  it("dismisses the column menu after Manage Columns opens successfully", async () => {
    mocks.openManageColumns.mockResolvedValue(true);

    const { result } = renderHook(() => useDataViewer());

    await waitForColumnRequest();

    act(() => {
      respondWithColumns();
    });

    await waitFor(() => {
      expect(result.current.columns).toHaveLength(3);
    });

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
      expect(result.current.columnMenu).toBeDefined();
    });

    expect(mocks.getColumnMenu).toHaveBeenCalledTimes(1);

    const onManageColumns = mocks.getColumnMenu.mock.calls[0][5];

    await act(async () => {
      await onManageColumns?.();
    });

    expect(mocks.openManageColumns).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(result.current.columnMenu).toBeUndefined();
    });
  });
});
