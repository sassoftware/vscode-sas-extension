// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import ".";

import {
  BodyScrollEndEvent,
  GridReadyEvent,
  IGetRowsParams,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import { TableData } from "../components/LibraryNavigator/types";
import { queryTableData, vscode } from "./useDataViewer";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const { useCallback, useState, useEffect, useRef } = React;

const DataViewer = () => {
  const [columns, setColumns] = useState([]);
  const [persistData, setPersistData] = useState<boolean>(false);
  const gridRef = useRef<AgGridReact>(null);

  const persistChanges = (event: BodyScrollEndEvent) => {
    if (!persistData) {
      return;
    }

    const displayedRow = event.api.getFirstDisplayedRow();
    console.log("displayedRow", displayedRow);
    vscode.setState({ displayedRow });
  };

  const startPersistingData = () => {
    console.log("starting to persist data");
    setPersistData(true);
  };

  const onGridReady = useCallback(
    (event: GridReadyEvent) => {
      const dataSource = {
        rowCount: undefined,
        getRows: (params: IGetRowsParams) => {
          queryTableData(params.startRow, params.endRow).then(
            ({ rows, headers, count }: TableData) => {
              const rowData = rows.map(({ cells }) =>
                cells.reduce(
                  (carry, cell, index) => ({
                    ...carry,
                    [headers.columns[index]]: cell,
                  }),
                  {}
                )
              );

              params.successCallback(rowData, count);
              !persistData && startPersistingData();
            }
          );
        },
      };

      event.api.setDatasource(dataSource);
      const { displayedRow = 0 } = vscode.getState() || {};
      if (displayedRow !== 0) {
        console.log("setting displayed row to ", displayedRow);
        if ((event.api.getInfiniteRowCount() || 0) < displayedRow + 1) {
          console.log("setting row count");
          event.api.setRowCount(displayedRow + 1, false);
        }

        console.log("ensuring things");
        event.api.ensureIndexVisible(displayedRow, "top");
      }
    },
    [persistData]
  );

  // const updateFocusedCell = useCallback(() => {
  //   const { displayedRow = 0 } = vscode.getState() || {};
  //   if (displayedRow !== 0) {
  //     console.log("setting displayed row to ", displayedRow);
  //     gridRef.current.api.setFocusedCell(displayedRow, columns[0].field);
  //   }
  // }, [columns]);

  useEffect(() => {
    if (columns.length > 0) {
      return;
    }

    queryTableData(0, 100).then((data: TableData) => {
      setColumns(
        (data.headers.columns || []).map((field) => ({
          field,
        }))
      );
    });
  }, [columns.length]);

  if (columns.length === 0) {
    return null;
  }

  return (
    <AgGridReact
      cacheBlockSize={100}
      columnDefs={columns}
      infiniteInitialRowCount={100}
      maxBlocksInCache={10}
      onBodyScrollEnd={persistChanges}
      onGridReady={onGridReady}
      ref={gridRef}
      rowModelType="infinite"
    />
  );
};

const root = ReactDOMClient.createRoot(document.querySelector(".data-viewer"));
root.render(<DataViewer />);
