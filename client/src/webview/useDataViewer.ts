// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { ColDef, GridReadyEvent, IGetRowsParams } from "ag-grid-community";
import { useCallback, useEffect, useState } from "react";
import { TableData } from "../components/LibraryNavigator/types";
import { Column } from "../connection/rest/api/compute";
import columnHeaderTemplate from "./columnHeaderTemplate";

declare const acquireVsCodeApi;
const vscode = acquireVsCodeApi();

const contextMenuHandler = (e) => {
  e.stopImmediatePropagation();
};

const defaultTimeout = 60 * 1000; // 60 seconds (accounting for compute session expiration)

let queryTableDataTimeoutId = null;
const clearQueryTimeout = () =>
  queryTableDataTimeoutId && clearTimeout(queryTableDataTimeoutId);
const queryTableData = (start: number, end: number): Promise<TableData> => {
  vscode.postMessage({
    command: "request:loadData",
    data: { start, end },
  });

  return new Promise((resolve, reject) => {
    const commandHandler = (event) => {
      const { data } = event.data;
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

let fetchColumnsTimeoutId = null;
const clearFetchColumnsTimeout = () =>
  fetchColumnsTimeoutId && clearTimeout(fetchColumnsTimeoutId);
const fetchColumns = (): Promise<Column[]> => {
  vscode.postMessage({ command: "request:loadColumns" });

  return new Promise((resolve, reject) => {
    const commandHandler = (event) => {
      const { data } = event.data;
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
        getRows: (params: IGetRowsParams) => {
          queryTableData(params.startRow, params.endRow).then(
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

      event.api.setDatasource(dataSource);
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
