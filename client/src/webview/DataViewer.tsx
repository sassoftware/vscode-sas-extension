// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { HTMLAttributes, useCallback, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";

import { AgGridReact } from "ag-grid-react";

import ".";
import ColumnMenu from "./ColumnMenu";
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

// Copied from LibraryModel
const stringArrayToCsvString = (strings: string[]): string =>
  `"${strings
    .map((item: string | number) => (item ?? "").toString().replace(/"/g, '""'))
    .join('","')}"`;
// Randomly copied from the internet
function doRectsIntersect(rect1, rect2) {
  if (
    rect1.right < rect2.left ||
    rect1.left > rect2.right ||
    rect1.bottom < rect2.top ||
    rect1.top > rect2.bottom
  ) {
    return false;
  }
  return true;
}

const useSelectionRectangle = () => {
  const rectangleRef = useRef<HTMLDivElement>(undefined!);
  const rectDimensionsRef = useRef<
    undefined | { x: number; y: number; width: number; height: number }
  >(undefined!);
  const selectionEnabledRef = useRef<boolean>(false);

  const onMouseDown: HTMLAttributes<HTMLDivElement>["onMouseDown"] = (e) => {
    if (!e.shiftKey || !rectangleRef.current) {
      return;
    }
    rectDimensionsRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: 0,
      height: 0,
    };
    selectionEnabledRef.current = true;
    rectangleRef.current.style.display = "block";
  };

  const onMouseMove: HTMLAttributes<HTMLDivElement>["onMouseMove"] = (e) => {
    if (
      !rectDimensionsRef.current ||
      !rectangleRef.current ||
      !selectionEnabledRef.current
    ) {
      return;
    }
    const dimensions = rectDimensionsRef.current;
    dimensions.width = Math.abs(e.clientX - dimensions.x);
    dimensions.height = Math.abs(e.clientY - dimensions.y);

    rectangleRef.current.style.left = `${dimensions.x}px`;
    rectangleRef.current.style.top = `${dimensions.y}px`;
    rectangleRef.current.style.width = `${dimensions.width}px`;
    rectangleRef.current.style.height = `${dimensions.height}px`;
  };

  const onMouseUp: HTMLAttributes<HTMLDivElement>["onMouseUp"] = (e) => {
    selectionEnabledRef.current = false;
  };

  const resetStyles = () => {
    rectangleRef.current.style.display = "none";
  };

  const dimensions = () => rectDimensionsRef.current;

  return {
    dimensions,
    dismissSelection: resetStyles,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    rectangleRef,
  };
};

const DataViewer = () => {
  const title = document
    .querySelector("[data-title]")
    .getAttribute("data-title");
  const theme = useTheme();
  const {
    columnMenu,
    columns,
    dismissMenu,
    gridRef,
    onGridReady,
    refreshResults,
    viewProperties,
  } = useDataViewer();

  const handleKeydown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (columnMenu) {
          dismissMenu();
        }

        dismissSelection();
      }
      if (event.key === "c" && (event.metaKey || event.ctrlKey)) {
        const dim = dimensions();

        const headers = Array.from(
          document.querySelectorAll(".ag-header-cell"),
        ).filter((hc) => {
          if (
            (dim.x <= hc.offsetLeft + hc.clientWidth &&
              dim.x >= hc.clientLeft) ||
            (dim.x <= hc.clientLeft && dim.x + dim.width >= hc.clientLeft)
          ) {
            if (hc.offsetLeft >= dim.x + dim.width) {
              return false;
            }
            return true;
          }
          return false;
        });

        // Lets grab the first row that's part of the selection
        const efp = document.elementsFromPoint(dimensions().x, dimensions().y);
        const firstRowForSelection = efp.find((i) =>
          i.classList.contains("ag-cell"),
        ).parentElement;
        let rowIndex = parseInt(
          firstRowForSelection.getAttribute("row-index"),
          10,
        );

        // ...and add it to our selection
        const rows = [gridRef.current.api.getDisplayedRowAtIndex(rowIndex)];

        // Now, lets iterate over remaining rows and do so until a row
        // does _not_ intersect our selection rectangle.
        do {
          rowIndex += 1;
          const rowElement = document.querySelector(
            `[row-index="${rowIndex}"]`,
          );
          if (
            doRectsIntersect(
              document
                .querySelector(".selection-rectangle")
                .getBoundingClientRect(),
              rowElement.getBoundingClientRect(),
            )
          ) {
            rows.push(gridRef.current.api.getDisplayedRowAtIndex(rowIndex));
          } else {
            break;
          }
        } while (true);

        const headerKeys = headers.map((h) => h.getAttribute("col-id"));
        // Lets iterate over rows, only grabbing data that matches one of the header
        // keys
        const selectionData = rows.map((row) => {
          const rowData = [];
          headerKeys.forEach((key) => {
            rowData.push(row.data[key]);
          });
          return rowData;
        });

        // Finally, lets turn this into a CSV and copy the data
        let csv = stringArrayToCsvString(headerKeys);
        selectionData.forEach(
          (item) => (csv += "\n" + stringArrayToCsvString(item)),
        );

        navigator.clipboard.writeText(csv);
      }
    },
    [columnMenu, dismissMenu],
  );
  const dismissMenuWithoutFocus = useCallback(
    () => dismissMenu(false),
    [dismissMenu],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeydown);
    window.addEventListener("blur", dismissMenuWithoutFocus);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("blur", dismissMenuWithoutFocus);
    };
  }, [handleKeydown, dismissMenuWithoutFocus]);

  const {
    dimensions,
    dismissSelection,
    rectangleRef,
    ...selectionRectangleHooks
  } = useSelectionRectangle();

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
        initialValue={viewProperties()?.query?.filterValue ?? ""}
      />
      {columnMenu && <ColumnMenu {...columnMenu} />}
      <div
        className={`ag-grid-wrapper ${theme}`}
        style={gridStyles}
        onClick={() => columnMenu && dismissMenuWithoutFocus()}
        {...selectionRectangleHooks}
      >
        <div className="selection-rectangle" ref={rectangleRef} />
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
        />
      </div>
    </div>
  );
};

const root = createRoot(document.querySelector(".data-viewer-container"));
root.render(<DataViewer />);
