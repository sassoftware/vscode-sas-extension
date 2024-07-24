// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from "react";

import { ColDef, GridReadyEvent, IGetRowsParams } from "ag-grid-community";
import { v4 } from "uuid";

import { TableData } from "../components/LibraryNavigator/types";
import { Column } from "../connection/rest/api/compute";
import columnHeaderTemplate from "./columnHeaderTemplate";

declare const acquireVsCodeApi;
const vscode = acquireVsCodeApi();

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
const queryTableData = (start: number, end: number): Promise<TableData> => {
  const requestKey = v4();
  vscode.postMessage({
    command: "request:loadData",
    key: requestKey,
    data: { start, end },
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

const useDataViewer = () => {
  const [columns, setColumns] = useState<ColDef[]>([]);

  const onGridReady = useCallback(
    (event: GridReadyEvent) => {
      const dataSource = {
        rowCount: undefined,
        getRows: async (params: IGetRowsParams) => {
          await queryTableData(params.startRow, params.endRow).then(
            ({ rows, count }: TableData) => {
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
            },
          );
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
        headerComponentParams: {
          template: columnHeaderTemplate(column.type),
        },
      }));
      columns.unshift({
        field: "#",
        suppressMovable: true,
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

  return { columns, onGridReady };
};

export default useDataViewer;
