// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import type { ColumnState } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import ".";
import ColumnMenu from "./ColumnMenu";
import ManageColumns from "./ManageColumns";
import TableFilter from "./TableFilter";
import localize from "./localize";
import useDataViewer from "./useDataViewer";
import useTheme from "./useTheme";

import "./DataViewer.css";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const gridStyles = {
  "--ag-borders": "none",
  "--ag-row-border-width": "0px",
  height: "calc(100% - 9.2rem)",
  width: "100%",
};

export const DataViewer = () => {
  const title = document
    .querySelector("[data-title]")
    .getAttribute("data-title");
  const theme = useTheme();
  const [columnState, setColumnState] = useState<ColumnState[]>([]);

  const resetColumnState = useCallback(() => {
    setColumnState([]);
  }, []);

  const managedColumnState = useMemo(
    () => columnState.filter((column) => column.colId !== "#"),
    [columnState],
  );

  const allColumnsHidden =
    managedColumnState.length > 0 &&
    managedColumnState.every((column) => column.hide === true);

  const {
    columnMenu,
    columns,
    dismissMenu,
    gridRef,
    columnsLoadFailed,
    retryColumns,
    openManageColumns,
    manageColumnsOpen,
    onGridReady,
    refreshResults,
    resetColumns,
    setManageColumnsOpen,
  } = useDataViewer(setColumnState, resetColumnState);

  const handleKeydown = useCallback(
    (event) => {
      if (event.key === "Escape" && columnMenu) {
        dismissMenu();
      }
    },
    [columnMenu, dismissMenu],
  );
  const dismissMenuWithoutFocus = useCallback(
    () => dismissMenu(false),
    [dismissMenu],
  );

  const panelMessageHandler = useCallback(
    (event: MessageEvent) => {
      if (event.data.command === "panel:refreshData") {
        /*
         * useManageColumns handles closing the
         * Manage Columns dialog for the same
         * refresh message.
         *
         * Normal refresh preserves the existing
         * table query/filter.
         */
        refreshResults(undefined);
        resetColumns();
      }

      if (
        event.data.command === "panel:changeFocus" &&
        event.data.data.focused
      ) {
        const cell = gridRef.current?.api.getFocusedCell();
        if (cell) {
          gridRef.current?.api.setFocusedCell(cell.rowIndex, cell.column);
        }
      }
    },
    [gridRef, refreshResults, resetColumns],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("blur", dismissMenuWithoutFocus);
    window.addEventListener("message", panelMessageHandler);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("blur", dismissMenuWithoutFocus);
      window.removeEventListener("message", panelMessageHandler);
    };
  }, [handleKeydown, dismissMenuWithoutFocus, panelMessageHandler]);

  if (columns.length === 0) {
    return columnsLoadFailed ? (
      <div className="data-viewer">
        <h1>{title}</h1>
        <button type="button" onClick={retryColumns}>
          {localize("Retry loading table")}
        </button>
      </div>
    ) : null;
  }

  return (
    <div className="data-viewer">
      <h1>{title}</h1>
      <TableFilter
        onCommit={(value) => {
          refreshResults({ filterValue: value });
        }}
        initialValue={""}
      />
      {columnMenu && <ColumnMenu {...columnMenu} />}
      <div
        className={`ag-grid-wrapper ${theme}`}
        style={gridStyles}
        onClick={() => columnMenu && dismissMenuWithoutFocus()}
      >
        <AgGridReact
          ref={gridRef}
          cacheBlockSize={100}
          columnDefs={columns}
          defaultColDef={{
            sortable: true,
          }}
          maintainColumnOrder
          infiniteInitialRowCount={100}
          maxBlocksInCache={10}
          onGridReady={onGridReady}
          rowModelType="infinite"
          theme="legacy"
          noRowsOverlayComponent={() =>
            localize("No data matches the current filters.")
          }
          suppressDragLeaveHidesColumns
        />

        {allColumnsHidden && (
          <div className="all-columns-hidden-overlay">
            <div className="all-columns-hidden-message">
              {localize("All columns are hidden.")}
            </div>

            <button
              type="button"
              className="all-columns-hidden-button"
              onClick={() => void openManageColumns()}
            >
              {localize("Manage Columns")}
            </button>
          </div>
        )}

        {manageColumnsOpen && (
          <ManageColumns
            columnState={columnState}
            onClose={() => setManageColumnsOpen(false)}
            onApply={(updatedColumnState) => {
              const api = gridRef.current?.api;
              if (api) {
                /*
                 * Update only visibility/order.
                 *
                 * Do not replace the columns
                 * definition because row data is
                 * mapped using column index.
                 */
                api.applyColumnState({
                  state: [
                    {
                      colId: "#",
                    },
                    ...updatedColumnState.map((column) => ({
                      colId: column.colId,
                      hide: column.hide,
                    })),
                  ],
                  applyOrder: true,
                });
              }

              setColumnState(updatedColumnState);

              setManageColumnsOpen(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.querySelector(".data-viewer-container"));
root.render(<DataViewer />);
