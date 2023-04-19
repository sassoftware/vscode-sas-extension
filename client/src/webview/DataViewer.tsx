// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

// This declares a global type for DedicatedWorkerGlobalScope which
// doesn't exist in the DOM library. This is necessary because there are conflicts
// when including both DOM & WebWorker. See https://github.com/microsoft/TypeScript/issues/20595
// for more information.
declare global {
  type DedicatedWorkerGlobalScope = Worker;
}

import {
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import InfiniteScroll from "react-infinite-scroller";

const { useEffect, useState } = React;

const DataViewer = ({ headers, rows, loadMore }) => {
  return (
    <div>
      <InfiniteScroll pageStart={0} loadMore={loadMore} hasMore={true}>
        <VSCodeDataGrid>
          <VSCodeDataGridRow row-type="header">
            {(headers.columns || []).map((column, idx) => (
              <VSCodeDataGridCell
                cell-type="columnheader"
                key={idx}
                grid-column={idx + 1}
              >
                {column}
              </VSCodeDataGridCell>
            ))}
          </VSCodeDataGridRow>
          {rows.map((row, idx) => (
            <VSCodeDataGridRow key={idx}>
              {row.cells.map((cell, idx) => (
                <VSCodeDataGridCell key={idx} grid-column={idx + 1}>
                  {cell}
                </VSCodeDataGridCell>
              ))}
            </VSCodeDataGridRow>
          ))}
        </VSCodeDataGrid>
        {/* <button type="button" onClick={loadMore}>
      Load more
    </button> */}
      </InfiniteScroll>
    </div>
  );
};

const vscode = acquireVsCodeApi();
const DataViewerWrapper = () => {
  const [headers, setHeaders] = useState({});
  const [rows, setRows] = useState([]);

  const commandHandler = (event) => {
    switch (event.data.command) {
      case "onLoad":
        setHeaders(event.data.data.headers);
        setRows(event.data.data.rows);
        break;
      case "onResultsLoaded":
        setRows((rows) => rows.concat(event.data.data.rows));
        break;
      default:
        break;
    }
  };

  const loadMore = () => vscode.postMessage({ command: "loadMore" });

  useEffect(() => {
    vscode.postMessage({ command: "requestLoad" });
    window.addEventListener("message", commandHandler);

    return () => {
      window.removeEventListener("message", commandHandler);
    };
  }, []);

  return <DataViewer headers={headers} rows={rows} loadMore={loadMore} />;
};

const root = ReactDOMClient.createRoot(document.querySelector(".data-viewer"));
root.render(<DataViewerWrapper />);
