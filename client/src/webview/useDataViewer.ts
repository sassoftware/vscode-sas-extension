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
  TableData,
  TableQuery,
} from "../components/LibraryNavigator/types";
import { Column } from "../connection/rest/api/compute";
import type { ViewProperties } from "../panels/DataViewer";
import ColumnHeader from "./ColumnHeader";
import { ColumnMenuProps, getColumnMenu } from "./ColumnMenu";
import localize from "./localize";

declare const acquireVsCodeApi;
const vscode = acquireVsCodeApi();

ModuleRegistry.registerModules([AllCommunityModule]);

const contextMenuHandler = (e) => {
  e.stopImmediatePropagation();
};

export const applyColumnState = (api: GridApi, state: ColumnState[]) => {
  api.applyColumnState({ state, defaultState: { sort: null } });
  api.ensureIndexVisible(0);
  storeViewProperties({ columnState: state });
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

let fetchColumnsTimeoutId: ReturnType<typeof setTimeout> | null = null;
const clearFetchColumnsTimeout = () =>
  fetchColumnsTimeoutId && clearTimeout(fetchColumnsTimeoutId);
const fetchColumns = (): Promise<{
  columns: Column[];
  viewProperties?: ViewProperties;
}> => {
  const requestKey = v4();
  vscode.postMessage({ command: "request:loadColumns", key: requestKey });

  return new Promise((resolve, reject) => {
    const commandHandler = (event) => {
      const { data } = event.data;
      if (event.data.key !== requestKey) {
        return;
      }
      if (event.data.command === "response:loadColumns") {
        window.removeEventListener("message", commandHandler);
        clearFetchColumnsTimeout();
        resolve(data);
      }
    };

    clearFetchColumnsTimeout();
    fetchColumnsTimeoutId = setTimeout(() => {
      window.removeEventListener("message", commandHandler);
      reject(new Error("Timeout exceeded"));
    }, defaultTimeout);

    window.addEventListener("message", commandHandler);
  });
};

export const storeViewProperties = (viewProperties: ViewProperties) =>
  vscode.postMessage({
    command: "request:storeViewProperties",
    data: { viewProperties },
  });

const useDataViewer = () => {
  const gridRef = useRef<AgGridReact>(null);
  const [columns, setColumns] = useState<ColDef[]>([]);
  const [columnMenu, setColumnMenu] = useState<ColumnMenuProps | undefined>();
  const [queryParams, setQueryParamsState] = useState<TableQuery | undefined>(
    undefined,
  );
  const setQueryParams = (query: TableQuery | undefined) => {
    setQueryParamsState(query);
    storeViewProperties({ query });
  };

  const columnMenuRef = useRef<ColumnMenuProps | undefined>(columnMenu);
  const columnStateRef = useRef<ColumnState[] | undefined>(undefined);
  const loadedViewPropertiesRef = useRef<ViewProperties | undefined>(undefined);
  useEffect(() => {
    columnMenuRef.current = columnMenu;
  }, [columnMenu]);

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
      const { columnState, query } = loadedViewPropertiesRef.current;
      event.api.setGridOption("datasource", dataSource(query));

      // Re-hydrate our view with persisted view properties
      if (!loadedViewPropertiesRef.current) {
        return;
      }
      if (query) {
        setQueryParams(query);
      }
      if (columnState && columnState.length > 0) {
        applyColumnState(event.api, columnState);
        event.api.refreshHeader();
        columnStateRef.current = undefined;
      }
    },
    [dataSource],
  );

  const dismissMenu = (focusColumn: boolean = true) => {
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
  };

  const refreshResults = useCallback(
    (query: TableQuery | undefined) => {
      const params = queryParams ? { ...queryParams, ...(query || {}) } : query;
      setQueryParams(params);
      gridRef.current.api.setGridOption("datasource", dataSource(params));
    },
    [dataSource, queryParams],
  );

  const displayMenuForColumn = useCallback(
    (api: GridApi, column: AgColumn, rect: DOMRect) => {
      if (columnMenuRef.current?.column) {
        return setColumnMenu(undefined);
      }
      setColumnMenu(
        getColumnMenu(api, column, rect, dismissMenu, (columnName: string) => {
          vscode.postMessage({
            command: "request:loadColumnProperties",
            data: { columnName },
          });
        }),
      );
    },
    [],
  );

  useEffect(() => {
    if (columns.length > 0) {
      return;
    }

    fetchColumns().then(({ columns: columnsData, viewProperties }) => {
      if (viewProperties.columnState && viewProperties.columnState.length > 0) {
        columnStateRef.current = viewProperties.columnState;
      }
      loadedViewPropertiesRef.current = viewProperties;

      const columns: ColDef[] = columnsData.map((column) => ({
        field: column.name,
        headerComponent: ColumnHeader,
        headerComponentParams: {
          columnType: column.type,
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
        sortable: false,
        suppressMovable: true,
      });

      setColumns(columns);
    });
  }, [columns.length, displayMenuForColumn]);

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
    onGridReady,
    refreshResults,
    viewProperties: () => loadedViewPropertiesRef.current,
  };
};

export default useDataViewer;
