// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useRef, useState } from "react";

import {
  AllCommunityModule,
  ColDef,
  GridReadyEvent,
  IGetRowsParams,
  ModuleRegistry,
  SortModelItem,
} from "ag-grid-community";
import { v4 } from "uuid";

import { TableData } from "../components/LibraryNavigator/types";
import { Column } from "../connection/rest/api/compute";
import ColumnHeader from "./ColumnHeader";
import { ColumnHeaderProps } from "./ColumnHeaderMenu";

declare const acquireVsCodeApi;
const vscode = acquireVsCodeApi();

ModuleRegistry.registerModules([AllCommunityModule]);

const contextMenuHandler = (e) => {
  e.stopImmediatePropagation();
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
): Promise<TableData> => {
  const requestKey = v4();
  vscode.postMessage({
    command: "request:loadData",
    key: requestKey,
    data: { start, end, sortModel },
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
const fetchColumns = (): Promise<Column[]> => {
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

const useDataViewer = (theme: string) => {
  const [columns, setColumns] = useState<ColDef[]>([]);
  const [columnMenu, setColumnMenu] = useState<ColumnHeaderProps | undefined>();

  const columnMenuRef = useRef<ColumnHeaderProps | undefined>(columnMenu);
  useEffect(() => {
    columnMenuRef.current = columnMenu;
  }, [columnMenu]);

  const onGridReady = useCallback(
    (event: GridReadyEvent) => {
      const dataSource = {
        rowCount: undefined,
        getRows: async (params: IGetRowsParams) => {
          await queryTableData(
            params.startRow,
            params.endRow,
            params.sortModel,
          ).then(({ rows, count }: TableData) => {
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

            params.successCallback(rowData, count);
          });
        },
      };

      event.api.setGridOption("datasource", dataSource);
    },
    [columns],
  );

  useEffect(() => {
    if (columns.length > 0) {
      return;
    }

    fetchColumns().then((columnsData) => {
      const columns: ColDef[] = columnsData.map((column) => ({
        field: column.name,
        headerComponent: ColumnHeader,
        headerComponentParams: {
          columnType: column.type,
          setColumnMenu,
          currentColumn: () => columnMenuRef.current?.column,
          theme,
        },
      }));
      columns.unshift({
        field: "#",
        suppressMovable: true,
        sortable: false,
      });

      setColumns(columns);
    });
  }, [columns.length]);

  useEffect(() => {
    window.addEventListener("contextmenu", contextMenuHandler, true);

    return () => {
      window.removeEventListener("contextmenu", contextMenuHandler);
    };
  }, []);

  return { columns, onGridReady, columnMenu };
};

export default useDataViewer;
