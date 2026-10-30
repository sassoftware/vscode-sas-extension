// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import type { GridApi } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import ".";
import ColumnMenu from "./ColumnMenu";
import ManageColumns from "./ManageColumns";
import TableFilter from "./TableFilter";
import localize from "./localize";
import useDataViewer, { requestRefreshData } from "./useDataViewer";
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
  const [allColumnsHidden, setAllColumnsHidden] = useState(false);

  const updateAllColumnsHidden = useCallback((api: GridApi) => {
    const columns = api
      .getColumnState()
      .filter((column) => column.colId !== "#");

    setAllColumnsHidden(
      columns.length > 0 && columns.every((column) => column.hide === true),
    );
  }, []);

  const {
    columnMenu,
    columns,
    dismissMenu,
    gridRef,
    initialColumnState,
    openManageColumns,
    manageColumnsOpen,
    onGridReady,
    refreshResults,
    setColumns,
    setManageColumnsOpen,
    resetViewerState,
  } = useDataViewer();

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
        const { hasChanged } = event.data.data;

        if (hasChanged) {
          resetViewerState();
          setAllColumnsHidden(false);
          setColumns([]);
        }
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
    [gridRef, resetViewerState, setColumns],
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
    return null;
  }

  return (
    <div className="data-viewer">
      <h1>{title}</h1>
      <div className="filter-refresh-container">
        <TableFilter
          onCommit={(value) => {
            refreshResults({ filterValue: value });
          }}
          initialValue=""
        />
        <button
          type="button"
          className="refresh-data-button"
          title={localize("Refresh Data")}
          aria-label={localize("Refresh Data")}
          onClick={requestRefreshData}
        />
      </div>
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
          onColumnVisible={(event) => updateAllColumnsHidden(event.api)}
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
            columnState={initialColumnState}
            onClose={() => setManageColumnsOpen(false)}
            onApply={(updatedColumnState) => {
              const api = gridRef.current?.api;
              if (api) {
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
                updateAllColumnsHidden(api);
              }

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
