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
  const current = useRef(options);
  current.current = options;

  const loading = useRef(false);
  const stale = useRef(false);

  const [manageColumnsOpen, setManageColumnsOpen] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === "panel:invalidateColumns") {
        // A session change may make the current column state stale,
        // so close Manage Columns now and reset the table after the next successful reconnect/fetch.
        stale.current = true;
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
    if (loading.current) {
      return false;
    }

    loading.current = true;

    try {
      /*
       * Always fetch before opening.
       *
       * If the previous SAS session was closed or expired, this allows
       * the connection/session to be re-established before the dialog
       * is shown.
       */
      await current.current.fetchColumns();

      const api = current.current.gridRef.current?.api;

      if (!api || api.isDestroyed()) {
        return false;
      }

      if (stale.current) {
        // Reset the grid only after a successful fresh fetch so the disconnected view
        // stays unchanged and stale hide/order state is cleared after reconnection.
        api.resetColumnState();
        stale.current = false;
      }

      current.current.setColumnState?.(api.getColumnState());
      setManageColumnsOpen(true);

      return true;
    } catch (error) {
      // The extension-side loadColumns handler displays server errors.
      console.error(error);
      return false;
    } finally {
      loading.current = false;
    }
  }, []);

  return {
    manageColumnsOpen,
    setManageColumnsOpen,
    openManageColumns,
  };
};

export default useManageColumns;
