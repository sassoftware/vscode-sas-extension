// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import type { ColumnState, GridApi } from "ag-grid-community";
import type { AgGridReact } from "ag-grid-react";

import type { TableColumn } from "../components/LibraryNavigator/types";

type Options = {
  gridRef: RefObject<AgGridReact | null>;
  fetchColumns: () => Promise<{ columns: TableColumn[] }>;
  resetColumns: () => void;
  setColumnState?: (state: ColumnState[]) => void;
};

const useManageColumns = (options: Options) => {
  const current = useRef(options);
  current.current = options;
  const staleData = useRef(false);
  const revision = useRef(0);
  const request = useRef(0);
  const loading = useRef(false);
  const opening = useRef(false);
  const openAfterReload = useRef(false);
  const loadedRevision = useRef<number | undefined>(undefined);
  const [manageColumnsOpen, setManageColumnsOpen] = useState(false);
  const [columnsLoadFailed, setColumnsLoadFailed] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const invalidate = (event: MessageEvent) => {
      const isRefresh = event.data.command === "panel:refreshData";
      if (!isRefresh && event.data.command !== "panel:invalidateColumns") {
        return;
      }
      const reason = isRefresh ? "refresh" : event.data.data.reason;
      staleData.current = true;
      revision.current++;
      setManageColumnsOpen(false);
      loadedRevision.current = undefined;
      if (reason !== "creating") {
        request.current++;
        opening.current = false;
        openAfterReload.current = false;
        if (loading.current) {
          loading.current = false;
          setColumnsLoadFailed(true);
        }
        // A second refresh while already empty must restart the load effect.
        if (reason === "refresh") {
          setReloadVersion((value) => value + 1);
        }
      }
    };
    window.addEventListener("message", invalidate);
    return () => {
      window.removeEventListener("message", invalidate);
      request.current = -1;
    };
  }, []);

  const loadColumns = useCallback(async () => {
    const id = ++request.current;
    loadedRevision.current = undefined;
    loading.current = true;
    setColumnsLoadFailed(false);
    try {
      // A load may start a new session; retry once after that invalidation.
      for (let attempt = 0; attempt < 2; attempt++) {
        const version = revision.current;
        const result = await current.current.fetchColumns();
        if (id !== request.current) {
          return;
        }
        if (version === revision.current) {
          loadedRevision.current = version;
          return result;
        }
      }
    } catch (error) {
      // The extension-side loadColumns handler displays server errors.
      console.error(error);
    } finally {
      if (id === request.current) {
        loading.current = false;
        if (loadedRevision.current === undefined) {
          opening.current = false;
          openAfterReload.current = false;
          setColumnsLoadFailed(true);
        }
      }
    }
  }, []);

  const retryColumns = useCallback(() => {
    if (loading.current || opening.current) {
      return;
    }
    opening.current = true;
    openAfterReload.current = staleData.current;
    loadedRevision.current = undefined;
    setColumnsLoadFailed(false);
    current.current.resetColumns();
    setReloadVersion((value) => value + 1);
  }, []);

  const openManageColumns = useCallback(() => {
    if (loading.current || opening.current) {
      return;
    }
    if (staleData.current) {
      retryColumns();
      return;
    }
    const api = current.current.gridRef.current?.api;
    if (api && !api.isDestroyed()) {
      current.current.setColumnState?.(api.getColumnState());
      setManageColumnsOpen(true);
    }
  }, [retryColumns]);

  const onColumnsReady = useCallback((api: GridApi) => {
    opening.current = false;

    if (loadedRevision.current !== revision.current || api.isDestroyed()) {
      return;
    }

    staleData.current = false;

    if (!openAfterReload.current) {
      return;
    }

    openAfterReload.current = false;
    current.current.setColumnState?.(api.getColumnState());
    setManageColumnsOpen(true);
  }, []);

  return {
    manageColumnsOpen,
    setManageColumnsOpen,
    openManageColumns,
    onColumnsReady,
    loadColumns,
    columnsLoadFailed,
    retryColumns,
    reloadVersion,
  };
};

export default useManageColumns;
