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
      }),
    );

    expect(result.current.manageColumnsOpen).toBe(false);
    expect(result.current.initialColumnState).toEqual([]);
  });

  it("opens Manage Columns after columns are fetched successfully", async () => {
    const gridRef = createGridRef();
    const fetchColumns = vi.fn().mockResolvedValue({ columns: [] });

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

    expect(opened).toBe(true);
    expect(fetchColumns).toHaveBeenCalledTimes(1);
    expect(result.current.initialColumnState).toEqual(columnState);
    expect(result.current.manageColumnsOpen).toBe(true);
  });

  it("does not open Manage Columns when fetching columns fails", async () => {
    const gridRef = createGridRef();
    const fetchColumns = vi.fn().mockRejectedValue(new Error("Fetch failed"));

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns,
      }),
    );

    let opened = true;

    await act(async () => {
      opened = await result.current.openManageColumns();
    });

    expect(opened).toBe(false);
    expect(fetchColumns).toHaveBeenCalledTimes(1);
    expect(result.current.initialColumnState).toEqual([]);
    expect(result.current.manageColumnsOpen).toBe(false);
    expect(console.error).toHaveBeenCalledTimes(1);
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

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns,
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
    expect(result.current.initialColumnState).toEqual(columnState);
    expect(result.current.manageColumnsOpen).toBe(true);
  });

  it("does not open Manage Columns if the viewer loses focus while columns are loading", async () => {
    const gridRef = createGridRef();

    let resolveFetch: ((value: { columns: never[] }) => void) | undefined;

    const fetchColumns = vi.fn(
      () =>
        new Promise<{ columns: never[] }>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns,
      }),
    );

    let opened = true;

    await act(async () => {
      const pendingOpen = result.current.openManageColumns();

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

      resolveFetch?.({
        columns: [],
      });

      opened = await pendingOpen;
    });

    expect(fetchColumns).toHaveBeenCalledTimes(1);
    expect(opened).toBe(false);
    expect(result.current.initialColumnState).toEqual([]);
    expect(result.current.manageColumnsOpen).toBe(false);
  });

  it("closes Manage Columns when columns are invalidated", async () => {
    const gridRef = createGridRef();

    const { result } = renderHook(() =>
      useManageColumns({
        gridRef,
        fetchColumns: vi.fn().mockResolvedValue({ columns: [] }),
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
