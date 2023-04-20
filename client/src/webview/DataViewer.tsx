import ".";

import {
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import InfiniteScroll from "react-infinite-scroller";

const { useEffect, useState } = React;

const DataViewer = ({ headers, rows, loadMoreResults, hasMore }) => {
  return (
    <div>
      <InfiniteScroll
        pageStart={0}
        loadMore={loadMoreResults}
        hasMore={hasMore}
      >
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
      </InfiniteScroll>
    </div>
  );
};

declare const acquireVsCodeApi;
const vscode = acquireVsCodeApi();
const DataViewerWrapper = () => {
  const [headers, setHeaders] = useState({});
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);

  const commandHandler = (event) => {
    switch (event.data.command) {
      case "response:loadData":
        setHeaders(event.data.data.headers);
        setRows(event.data.data.rows);
        setHasMore(event.data.data.hasMore);
        break;
      case "response:loadMoreResults":
        setRows((rows) => rows.concat(event.data.data.rows));
        setHasMore(event.data.data.hasMore);
        break;
      default:
        break;
    }
  };

  const loadMoreResults = () =>
    vscode.postMessage({ command: "request:loadMoreResults" });

  useEffect(() => {
    vscode.postMessage({ command: "request:loadData" });
    window.addEventListener("message", commandHandler);

    return () => {
      window.removeEventListener("message", commandHandler);
    };
  }, []);

  return (
    <DataViewer
      hasMore={hasMore}
      headers={headers}
      rows={rows}
      loadMoreResults={loadMoreResults}
    />
  );
};

const root = ReactDOMClient.createRoot(document.querySelector(".data-viewer"));
root.render(<DataViewerWrapper />);
