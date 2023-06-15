// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import ".";

import {
  VSCodeDataGrid,
  VSCodeDataGridCell,
  VSCodeDataGridRow,
} from "@vscode/webview-ui-toolkit/react";
import * as React from "react";
import * as ReactDOMClient from "react-dom/client";
import InfiniteScroll from "react-infinite-scroller";
import useDataViewer from "./useDataViewer";

const DataViewer = () => {
  const { loadMoreResults, headers, rows, hasMore } = useDataViewer();

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
                style={{ minWidth: "100px" }}
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
                <VSCodeDataGridCell
                  key={idx}
                  grid-column={idx + 1}
                  style={{ minWidth: "100px" }}
                >
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

const root = ReactDOMClient.createRoot(document.querySelector(".data-viewer"));
root.render(<DataViewer />);
