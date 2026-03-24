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

let fetchDistinctValuesTimeoutId: ReturnType<typeof setTimeout> | null = null;
const clearFetchDistinctValuesTimeout = () =>
  fetchDistinctValuesTimeoutId && clearTimeout(fetchDistinctValuesTimeoutId);
const fetchDistinctValues = (
  columnName: string,
  query: TableQuery | undefined,
  maxValues: number = 100,
): Promise<(string | number | null)[]> => {
  const requestKey = v4();
  vscode.postMessage({
    command: "request:loadDistinctValues",
    key: requestKey,
    data: {
      columnName,
      query,
      maxValues,
    },
  });

  return new Promise((resolve, reject) => {
    const commandHandler = (event) => {
      const { data } = event.data;
      if (event.data.key !== requestKey) {
        return;
      }
      if (event.data.command === "response:loadDistinctValues") {
        window.removeEventListener("message", commandHandler);
        clearFetchDistinctValuesTimeout();
        resolve(data.distinctValues || []);
      }
    };

    clearFetchDistinctValuesTimeout();
    fetchDistinctValuesTimeoutId = setTimeout(() => {
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
  const [distinctValuesByColumn, setDistinctValuesByColumn] = useState<
    Record<string, (string | number | null)[]>
  >({});
  const [loadingDistinctValuesByColumn, setLoadingDistinctValuesByColumn] =
    useState<Record<string, boolean>>({});
  const columnTypesRef = useRef<Record<string, string>>({});
  const [queryParams, setQueryParamsState] = useState<TableQuery | undefined>(
    undefined,
  );
  const normalizeQuery = (
    query: TableQuery | undefined,
  ): TableQuery | undefined => {
    if (!query) {
      return undefined;
    }

    const filterValue = query.filterValue || "";
    const columnFilters = Object.entries(query.columnFilters || {}).reduce(
      (carry, [columnName, expression]) => {
        if (!expression?.trim()) {
          return carry;
        }

        return {
          ...carry,
          [columnName]: expression,
        };
      },
      {},
    );

    if (!filterValue.trim() && Object.keys(columnFilters).length === 0) {
      return undefined;
    }

    return {
      filterValue,
      ...(Object.keys(columnFilters).length > 0 ? { columnFilters } : {}),
    };
  };
  const setQueryParams = (query: TableQuery | undefined) => {
    const normalizedQuery = normalizeQuery(query);
    setQueryParamsState(normalizedQuery);
    storeViewProperties({ query: normalizedQuery });
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
      const params = normalizeQuery(
        queryParams ? { ...queryParams, ...(query || {}) } : query,
      );
      setQueryParams(params);
      gridRef.current.api.setGridOption("datasource", dataSource(params));
    },
    [dataSource, queryParams],
  );

  const quoteString = (value: string): string =>
    `'${value.replace(/'/g, "''")}'`;

  const buildColumnFilterExpression = (
    columnName: string,
    value: string | number | null,
  ): string => {
    const columnType = (columnTypesRef.current[columnName] || "").toLowerCase();
    const isNumericColumn = [
      "float",
      "num",
      "date",
      "time",
      "datetime",
      "currency",
    ].includes(columnType);

    if (value === null || (value === "." && isNumericColumn)) {
      return `missing(${columnName})`;
    }

    if (isNumericColumn) {
      return `${columnName} = ${value}`;
    }

    return `${columnName} = ${quoteString(`${value}`)}`;
  };

  const queryWithoutColumnFilter = (
    columnName: string,
    query: TableQuery | undefined,
  ): TableQuery | undefined => {
    if (!query?.columnFilters?.[columnName]) {
      return query;
    }

    const { [columnName]: _unused, ...remainingFilters } =
      query.columnFilters;
    return normalizeQuery({
      ...query,
      columnFilters: remainingFilters,
    });
  };

  const loadDistinctValues = useCallback(
    async (columnName: string) => {
      if (loadingDistinctValuesByColumn[columnName]) {
        return;
      }

      setLoadingDistinctValuesByColumn((current) => ({
        ...current,
        [columnName]: true,
      }));

      try {
        const distinctValues = await fetchDistinctValues(
          columnName,
          queryWithoutColumnFilter(columnName, queryParams),
          100,
        );

        setDistinctValuesByColumn((current) => ({
          ...current,
          [columnName]: distinctValues,
        }));
      } finally {
        setLoadingDistinctValuesByColumn((current) => ({
          ...current,
          [columnName]: false,
        }));
      }
    },
    [loadingDistinctValuesByColumn, queryParams],
  );

  const applyColumnFilter = useCallback(
    (columnName: string, value: string | number | null) => {
      const expression = buildColumnFilterExpression(columnName, value);
      const existingFilters = queryParams?.columnFilters || {};

      refreshResults({
        filterValue: queryParams?.filterValue || "",
        columnFilters: {
          ...existingFilters,
          [columnName]: expression,
        },
      });
    },
    [queryParams, refreshResults],
  );

  const clearColumnFilter = useCallback(
    (columnName: string) => {
      if (!queryParams?.columnFilters?.[columnName]) {
        return;
      }

      const { [columnName]: _unused, ...remainingFilters } =
        queryParams.columnFilters;
      refreshResults({
        filterValue: queryParams?.filterValue || "",
        columnFilters: remainingFilters,
      });
    },
    [queryParams, refreshResults],
  );

  const displayMenuForColumn = useCallback(
    (api: GridApi, column: AgColumn, rect: DOMRect) => {
      if (columnMenuRef.current?.column) {
        return setColumnMenu(undefined);
      }
      const colId = column.colId;
      setColumnMenu({
        ...getColumnMenu(api, column, rect, dismissMenu, (columnName: string) => {
          vscode.postMessage({
            command: "request:loadColumnProperties",
            data: { columnName },
          });
        }),
        distinctValues: distinctValuesByColumn[colId],
        hasColumnFilter: !!queryParams?.columnFilters?.[colId],
        isDistinctValuesLoading: !!loadingDistinctValuesByColumn[colId],
        loadDistinctValues: () => {
          loadDistinctValues(colId);
        },
        filterByDistinctValue: (value) => {
          applyColumnFilter(colId, value);
        },
        clearColumnFilter: () => {
          clearColumnFilter(colId);
        },
      });

      if (!distinctValuesByColumn[colId]) {
        loadDistinctValues(colId);
      }
    },
    [
      applyColumnFilter,
      clearColumnFilter,
      distinctValuesByColumn,
      loadDistinctValues,
      loadingDistinctValuesByColumn,
      queryParams,
    ],
  );

  useEffect(() => {
    if (!columnMenuRef.current) {
      return;
    }

    const colId = columnMenuRef.current.column.colId;
    setColumnMenu((currentMenu) => {
      if (!currentMenu) {
        return currentMenu;
      }

      return {
        ...currentMenu,
        distinctValues: distinctValuesByColumn[colId],
        hasColumnFilter: !!queryParams?.columnFilters?.[colId],
        isDistinctValuesLoading: !!loadingDistinctValuesByColumn[colId],
      };
    });
  }, [distinctValuesByColumn, loadingDistinctValuesByColumn, queryParams]);

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
        suppressMovable: true,
        sortable: false,
        headerTooltip: localize("Row number"),
      });

      setColumns(columns);
      columnTypesRef.current = columnsData.reduce(
        (carry, column) => ({
          ...carry,
          [column.name]: column.type,
        }),
        {},
      );
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
