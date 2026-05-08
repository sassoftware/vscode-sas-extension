// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { AgGridReact } from "ag-grid-react";

import ".";
import ColumnMenu from "./ColumnMenu";
import TableFilter from "./TableFilter";
import localize from "./localize";
import useDataViewer from "./useDataViewer";
import useSelectionRectangle from "./useSelectionRectangle";
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

const DataViewer = () => {
  const title = document
    .querySelector("[data-title]")!
    .getAttribute("data-title");
  const theme = useTheme();
  const {
    columnMenu,
    columns,
    dismissMenu,
    gridRef,
    onGridReady,
    refreshResults,
  } = useDataViewer();
  const [gridDragging, setGridDragging] = useState(false);
  const { dismissSelection, copySelection, ...selectionRectangleHooks } =
    useSelectionRectangle({
      getRowData: (rowIndex: string) =>
        gridRef.current?.api.getRowNode(rowIndex),
      enabled: !gridDragging,
      scrollContainer: ".ag-body-viewport",
      scrollBoundaries: () => ({
        bottom: document.body.clientHeight - 30,
      }),
    });

  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (columnMenu) {
          dismissMenu();
        }

        dismissSelection();
      } else if (event.key === "c" && (event.metaKey || event.ctrlKey)) {
        copySelection();
      }
    },
    [columnMenu, dismissSelection, dismissMenu, copySelection],
  );
  const dismissMenuWithoutFocus = useCallback(
    () => dismissMenu(false),
    [dismissMenu],
  );

  const focusChanged = useCallback(
    (event: MessageEvent) => {
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
    [gridRef],
  );
  useEffect(() => {
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("blur", dismissMenuWithoutFocus);
    window.addEventListener("message", focusChanged);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("blur", dismissMenuWithoutFocus);
      window.removeEventListener("message", focusChanged);
    };
  }, [handleKeydown, dismissMenuWithoutFocus, focusChanged]);

  if (columns.length === 0) {
    return null;
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
        {...selectionRectangleHooks}
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
          onDragStarted={() => setGridDragging(true)}
          onDragCancelled={() => setGridDragging(false)}
          onDragStopped={() => setGridDragging(false)}
          suppressDragLeaveHidesColumns
        />
      </div>
    </div>
  );
};

const root = createRoot(document.querySelector(".data-viewer-container"));
root.render(<DataViewer />);
