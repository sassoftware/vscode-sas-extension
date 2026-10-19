// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { ColumnState } from "ag-grid-community";
import type { AgGridReact } from "ag-grid-react";

import type { TableColumn } from "../components/LibraryNavigator/types";

type Options = {
  gridRef: RefObject<AgGridReact | null>;
  fetchColumns: () => Promise<{ columns: TableColumn[] }>;
  setColumnState?: (state: ColumnState[]) => void;
};

const useManageColumns = (options: Options) => {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const isLoading = useRef(false);
  const needsReset = useRef(false);

  const [manageColumnsOpen, setManageColumnsOpen] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === "panel:invalidateColumns") {
        // A session change may make the current column state stale,
        // so close Manage Columns now and reset the table after the next successful reconnect/fetch.
        needsReset.current = true;
        setManageColumnsOpen(false);
        return;
      }

      if (
        event.data.command === "panel:refreshData" ||
        (event.data.command === "panel:changeFocus" &&
          !event.data.data?.focused)
      ) {
        setManageColumnsOpen(false);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const openManageColumns = useCallback(async (): Promise<boolean> => {
    if (isLoading.current) {
      return false;
    }

    isLoading.current = true;

    try {
      // Fetch columns first to ensure the SAS session is available.
      await optionsRef.current.fetchColumns();

      const api = optionsRef.current.gridRef.current?.api;

      if (!api || api.isDestroyed()) {
        return false;
      }

      if (needsReset.current) {
        api.resetColumnState();
        needsReset.current = false;
      }

      optionsRef.current.setColumnState?.(api.getColumnState());
      setManageColumnsOpen(true);

      return true;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      isLoading.current = false;
    }
  }, []);

  return {
    manageColumnsOpen,
    setManageColumnsOpen,
    openManageColumns,
  };
};

export default useManageColumns;
