// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { RefObject } from "react";

import { act, renderHook } from "@testing-library/react";

import type { ColumnState } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import useManageColumns from "../../src/webview/useManageColumns";

const columnState: ColumnState[] = [
  {
    colId: "col1",
    hide: false,
  },
  {
    colId: "col2",
    hide: true,
  },
];

const createGridRef = ({
  destroyed = false,
  includeApi = true,
}: {
  destroyed?: boolean;
  includeApi?: boolean;
} = {}): RefObject<AgGridReact | null> => {
  let current: AgGridReact | null = null;

  if (includeApi) {
    const grid = Object.create(AgGridReact.prototype);

    grid.api = {
      getColumnState: vi.fn(() => columnState),
      isDestroyed: vi.fn(() => destroyed),
    };

    current = grid;
  }

  return {
    current,
  };
};

describe("useManageColumns", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with Manage Columns closed", () => {
    const gridRef = createGridRef();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns: vi.fn().mockResolvedValue({ columns: [] }),
        setColumnState: vi.fn(),
      }),
    );

    expect(result.current.manageColumnsOpen).toBe(false);
  });

  it("opens Manage Columns after columns are fetched successfully", async () => {
    const gridRef = createGridRef();
    const fetchColumns = vi.fn().mockResolvedValue({ columns: [] });
    const setColumnState = vi.fn();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns,
        setColumnState,
      }),
    );

    let opened = false;

    await act(async () => {
      opened = await result.current.openManageColumns();
    });

    expect(opened).toBe(true);
    expect(fetchColumns).toHaveBeenCalledTimes(1);
    expect(setColumnState).toHaveBeenCalledTimes(1);
    expect(setColumnState).toHaveBeenCalledWith(columnState);
    expect(result.current.manageColumnsOpen).toBe(true);
  });

  it("does not open Manage Columns when fetching columns fails", async () => {
    const gridRef = createGridRef();
    const fetchColumns = vi.fn().mockRejectedValue(new Error("Fetch failed"));
    const setColumnState = vi.fn();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns,
        setColumnState,
      }),
    );

    let opened = true;

    await act(async () => {
      opened = await result.current.openManageColumns();
    });

    expect(opened).toBe(false);
    expect(fetchColumns).toHaveBeenCalledTimes(1);
    expect(setColumnState).not.toHaveBeenCalled();
    expect(result.current.manageColumnsOpen).toBe(false);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("does not open Manage Columns when the grid API is unavailable", async () => {
    const gridRef = createGridRef({
      includeApi: false,
    });

    const fetchColumns = vi.fn().mockResolvedValue({ columns: [] });
    const setColumnState = vi.fn();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns,
        setColumnState,
      }),
    );

    let opened = true;

    await act(async () => {
      opened = await result.current.openManageColumns();
    });

    expect(opened).toBe(false);
    expect(fetchColumns).toHaveBeenCalledTimes(1);
    expect(setColumnState).not.toHaveBeenCalled();
    expect(result.current.manageColumnsOpen).toBe(false);
  });

  it("does not open Manage Columns when the grid API is destroyed", async () => {
    const gridRef = createGridRef({
      destroyed: true,
    });

    const fetchColumns = vi.fn().mockResolvedValue({ columns: [] });
    const setColumnState = vi.fn();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns,
        setColumnState,
      }),
    );

    let opened = true;

    await act(async () => {
      opened = await result.current.openManageColumns();
    });

    expect(opened).toBe(false);
    expect(fetchColumns).toHaveBeenCalledTimes(1);
    expect(setColumnState).not.toHaveBeenCalled();
    expect(result.current.manageColumnsOpen).toBe(false);
  });

  it("prevents multiple Manage Columns opens while columns are loading", async () => {
    const gridRef = createGridRef();

    let resolveFetch: ((value: { columns: never[] }) => void) | undefined;

    const fetchColumns = vi.fn(
      () =>
        new Promise<{ columns: never[] }>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const setColumnState = vi.fn();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns,
        setColumnState,
      }),
    );

    let firstOpened = false;
    let secondOpened = true;

    await act(async () => {
      const firstOpen = result.current.openManageColumns();
      const secondOpen = result.current.openManageColumns();

      secondOpened = await secondOpen;

      resolveFetch?.({
        columns: [],
      });

      firstOpened = await firstOpen;
    });

    expect(fetchColumns).toHaveBeenCalledTimes(1);
    expect(firstOpened).toBe(true);
    expect(secondOpened).toBe(false);
    expect(setColumnState).toHaveBeenCalledTimes(1);
    expect(result.current.manageColumnsOpen).toBe(true);
  });

  it("closes Manage Columns when columns are invalidated", async () => {
    const gridRef = createGridRef();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns: vi.fn().mockResolvedValue({ columns: [] }),
        setColumnState: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.openManageColumns();
    });

    expect(result.current.manageColumnsOpen).toBe(true);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            command: "panel:invalidateColumns",
          },
        }),
      );
    });

    expect(result.current.manageColumnsOpen).toBe(false);
  });

  it("closes Manage Columns when the table is refreshed", async () => {
    const gridRef = createGridRef();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns: vi.fn().mockResolvedValue({ columns: [] }),
        setColumnState: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.openManageColumns();
    });

    expect(result.current.manageColumnsOpen).toBe(true);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            command: "panel:refreshData",
          },
        }),
      );
    });

    expect(result.current.manageColumnsOpen).toBe(false);
  });

  it("closes Manage Columns when the Table Viewer loses focus", async () => {
    const gridRef = createGridRef();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns: vi.fn().mockResolvedValue({ columns: [] }),
        setColumnState: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.openManageColumns();
    });

    expect(result.current.manageColumnsOpen).toBe(true);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            command: "panel:changeFocus",
            data: {
              focused: false,
            },
          },
        }),
      );
    });

    expect(result.current.manageColumnsOpen).toBe(false);
  });

  it("keeps Manage Columns open when the Table Viewer remains focused", async () => {
    const gridRef = createGridRef();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns: vi.fn().mockResolvedValue({ columns: [] }),
        setColumnState: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.openManageColumns();
    });

    expect(result.current.manageColumnsOpen).toBe(true);

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

    expect(result.current.manageColumnsOpen).toBe(true);
  });
});
