// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AgColumn,
  AllCommunityModule,
  ColDef,
  ColumnState,
  GridApi,
  GridReadyEvent,
  IGetRowsParams,
  ModuleRegistry,
  SortModelItem,
  SuppressHeaderKeyboardEventParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { v4 } from "uuid";

import type {
  TableColumn,
  TableData,
  TableQuery,
} from "../components/LibraryNavigator/types";
import ColumnHeader from "./ColumnHeader";
import { ColumnMenuProps, getColumnMenu } from "./ColumnMenu";
import localize from "./localize";
import useManageColumns from "./useManageColumns";

declare const acquireVsCodeApi;
const vscode = acquireVsCodeApi();

ModuleRegistry.registerModules([AllCommunityModule]);

const contextMenuHandler = (e) => {
  e.stopImmediatePropagation();
};

export const applyColumnState = (api: GridApi, state: ColumnState[]) => {
  api.applyColumnState({ state, defaultState: { sort: null } });
  api.ensureIndexVisible(0);
};

const defaultTimeout = 60 * 1000; // 60 seconds (accounting for compute session expiration)

let queryTableDataTimeoutId: ReturnType<typeof setTimeout> | null = null;
const clearQueryTimeout = (): void => {
  if (!queryTableDataTimeoutId) {
    return;
  }
  clearTimeout(queryTableDataTimeoutId);
  queryTableDataTimeoutId = null;
};
const queryTableData = (
  start: number,
  end: number,
  sortModel: SortModelItem[],
  query: TableQuery | undefined,
): Promise<TableData> => {
  const requestKey = v4();
  vscode.postMessage({
    command: "request:loadData",
    key: requestKey,
    data: { start, end, sortModel, query },
  });

  return new Promise((resolve, reject) => {
    const commandHandler = (event) => {
      const { data } = event.data;
      if (event.data.key !== requestKey) {
        return;
      }
      if (event.data.command === "response:loadData") {
        window.removeEventListener("message", commandHandler);
        clearQueryTimeout();
        resolve(data);
      }
    };

    clearQueryTimeout();
    queryTableDataTimeoutId = setTimeout(() => {
      window.removeEventListener("message", commandHandler);
      reject(new Error("Timeout exceeded"));
    }, defaultTimeout);

    window.addEventListener("message", commandHandler);
  });
};

const fetchColumns = (): Promise<{
  columns: TableColumn[];
}> => {
  const requestKey = v4();
  return new Promise((resolve, reject) => {
    const commandHandler = (event) => {
      const { data } = event.data;
      if (event.data.key !== requestKey) {
        return;
      }
      if (event.data.command === "response:loadColumns") {
        window.removeEventListener("message", commandHandler);
        clearTimeout(fetchColumnsTimeoutId);
        if (event.data.error !== undefined) {
          reject(new Error(event.data.error));
        } else {
          resolve(data);
        }
      }
    };

    const fetchColumnsTimeoutId = setTimeout(() => {
      window.removeEventListener("message", commandHandler);
      reject(new Error("Timeout exceeded"));
    }, defaultTimeout);

    window.addEventListener("message", commandHandler);
    vscode.postMessage({ command: "request:loadColumns", key: requestKey });
  });
};

const useDataViewer = (
  setColumnState?: (state: ColumnState[]) => void,
  resetColumnState?: () => void,
) => {
  const gridRef = useRef<AgGridReact>(null);
  const [columns, setColumns] = useState<ColDef[]>([]);
  const [columnMenu, setColumnMenu] = useState<ColumnMenuProps | undefined>();
  const [queryParams, setQueryParamsState] = useState<TableQuery | undefined>(
    undefined,
  );

  const columnMenuRef = useRef<ColumnMenuProps | undefined>(columnMenu);

  useEffect(() => {
    columnMenuRef.current = columnMenu;
  }, [columnMenu]);

  /**
   * Resets column-specific UI state while preserving
   * the current table query/filter.
   *
   * Used by ordinary table refresh.
   */
  const resetColumns = useCallback(() => {
    resetColumnState?.();
    setColumns([]);
  }, [resetColumnState]);

  /**
   * Complete viewer reset.
   *
   * Used when the session/table state becomes stale
   * and the table should return to its initial state.
   */
  const resetViewerState = useCallback(() => {
    setQueryParamsState(undefined);
    setColumnMenu(undefined);
    resetColumns();
  }, [resetColumns]);

  const {
    manageColumnsOpen,
    setManageColumnsOpen,
    openManageColumns,
    onColumnsReady,
    loadColumns,
    columnsLoadFailed,
    retryColumns,
    reloadVersion,
  } = useManageColumns({
    gridRef,
    fetchColumns,
    setColumnState,
    resetColumns: resetViewerState,
  });

  const dataSource = useCallback(
    (incomingQueryParams?: TableQuery) => ({
      rowCount: undefined,
      getRows: async (params: IGetRowsParams) => {
        params.api.setGridOption("activeOverlay", undefined);
        const tableData = await queryTableData(
          params.startRow,
          params.endRow,
          params.sortModel,
          incomingQueryParams || queryParams,
        );
        if (tableData.rows.length === 0) {
          params.api.setGridOption("activeOverlay", "agNoRowsOverlay");
        }

        const { rows, count } = tableData;
        const rowData = rows.map(({ cells }) => {
          const row = cells.reduce(
            (carry, cell, index) => ({
              ...carry,
              [columns[index].field]: cell,
            }),
            {},
          );

          return row;
        });

        params.successCallback(
          rowData,
          // If we've returned less than 100 rows, we can assume that's the last page
          // of the data and stop searching.
          rowData.length < 100 && count === undefined
            ? rowData[rowData.length - 1]["#"]
            : count,
        );
      },
    }),
    [columns, queryParams],
  );

  const onGridReady = useCallback(
    (event: GridReadyEvent) => {
      event.api.setGridOption("datasource", dataSource());
      onColumnsReady(event.api);
    },
    [dataSource, onColumnsReady],
  );

  const dismissMenu = useCallback((focusColumn: boolean = true) => {
    if (focusColumn && columnMenuRef.current?.column.colId) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const headerElement = document.querySelector(
        `.ag-header-cell[col-id="${columnMenuRef.current.column.colId}"]`,
      ) as HTMLElement;
      if (headerElement) {
        headerElement.focus();
      }
    }
    setColumnMenu(undefined);
  }, []);

  const refreshResults = useCallback(
    (query: TableQuery | undefined) => {
      const params = queryParams
        ? {
            ...queryParams,
            ...(query || {}),
          }
        : query;

      setQueryParamsState(params);

      gridRef.current?.api.setGridOption("datasource", dataSource(params));
    },
    [dataSource, queryParams],
  );

  const displayMenuForColumn = useCallback(
    (api: GridApi, column: AgColumn, rect: DOMRect) => {
      if (columnMenuRef.current?.column) {
        setColumnMenu(undefined);
        return;
      }
      setColumnMenu(
        getColumnMenu(
          api,
          column,
          rect,
          dismissMenu,
          (columnName: string) => {
            vscode.postMessage({
              command: "request:loadColumnProperties",
              data: { columnName },
            });
          },
          openManageColumns,
        ),
      );
    },
    [dismissMenu, openManageColumns],
  );

  useEffect(() => {
    if (columns.length > 0) {
      return;
    }

    loadColumns().then((result) => {
      if (!result) {
        return;
      }
      const { columns: columnsData } = result;
      const columns: ColDef[] = columnsData.map((column) => ({
        field: column.name,
        headerComponent: ColumnHeader,
        headerComponentParams: {
          columnType: column.type || "",
          columnFormatCategory: column.formatCategory,
          currentColumn: () => columnMenuRef.current?.column,
          displayMenuForColumn,
        },
        suppressHeaderKeyboardEvent: (
          params: SuppressHeaderKeyboardEventParams,
        ) => {
          // If a user tabs to a different column, dismiss the column menu
          if (params.event.key === "Tab") {
            setColumnMenu(undefined);
            return false;
          }
          if (
            params.event.key === "Enter" ||
            (params.event.key === "F10" && params.event.shiftKey)
          ) {
            // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
            const dropdown = (params.event.target as HTMLElement).querySelector(
              ".dropdown",
            );
            if (!dropdown) {
              return true;
            }
            if (!dropdown.classList.contains("active")) {
              dropdown.classList.add("active");
            }
            const dropdownButton = dropdown.querySelector("button");
            displayMenuForColumn(
              params.api,
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              params.column as AgColumn,
              dropdownButton.getBoundingClientRect(),
            );
            params.event.stopPropagation();
            return true;
          }
          return false;
        },
      }));

      columns.unshift({
        field: "#",
        headerTooltip: localize("Row number"),
        pinned: "left",
        lockPinned: true,
        lockPosition: true,
        sortable: false,
        suppressMovable: true,
      });

      setColumns(columns);
    });
  }, [columns.length, displayMenuForColumn, loadColumns, reloadVersion]);

  useEffect(() => {
    window.addEventListener("contextmenu", contextMenuHandler, true);

    return () => {
      window.removeEventListener("contextmenu", contextMenuHandler);
    };
  }, []);

  return {
    columnMenu,
    columns,
    dismissMenu,
    gridRef,
    openManageColumns,
    columnsLoadFailed,
    retryColumns,
    manageColumnsOpen,
    onGridReady,
    refreshResults,
    resetColumns,
    setManageColumnsOpen,
  };
};

export default useDataViewer;
