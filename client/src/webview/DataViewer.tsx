// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useMemo } from "react";
import { createRoot } from "react-dom/client";

import { AgGridReact } from "ag-grid-react";

import ".";
import ColumnMenu from "./ColumnMenu";
import useDataViewer from "./useDataViewer";

import "./DataViewer.css";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";

const gridStyles = {
  "--ag-borders": "none",
  "--ag-row-border-width": "0px",
  height: "100%",
  width: "100%",
};

const DataViewer = () => {
  const theme = useMemo(() => {
    const themeKind = document
      .querySelector("[data-vscode-theme-kind]")
      .getAttribute("data-vscode-theme-kind");

    switch (themeKind) {
      case "vscode-high-contrast-light":
      case "vscode-light":
        return "ag-theme-alpine";
      case "vscode-high-contrast":
      case "vscode-dark":
        return "ag-theme-alpine-dark";
    }
  }, []);
  const { columns, onGridReady, columnMenu, dismissMenu } =
    useDataViewer(theme);

  const handleKeydown = useCallback(
    (event) => {
      if (event.key === "Escape" && columnMenu) {
        dismissMenu();
      }
    },
    [columnMenu, dismissMenu],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [handleKeydown]);

  if (columns.length === 0) {
    return null;
  }

  return (
    <div className="data-viewer">
      {columnMenu && <ColumnMenu {...columnMenu} />}
      <div
        className={`ag-grid-wrapper ${theme}`}
        style={gridStyles}
        onClick={() => columnMenu && dismissMenu()}
      >
        <AgGridReact
          cacheBlockSize={100}
          columnDefs={columns}
          defaultColDef={{
            sortable: true,
          }}
          infiniteInitialRowCount={100}
          maxBlocksInCache={10}
          onGridReady={onGridReady}
          rowModelType="infinite"
          theme="legacy"
        />
      </div>
    </div>
  );
};

const root = createRoot(document.querySelector(".data-viewer"));
root.render(<DataViewer />);
