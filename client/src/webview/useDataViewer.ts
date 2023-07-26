// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react";
import { TableData } from "../components/LibraryNavigator/types";

declare const acquireVsCodeApi;
export const vscode = acquireVsCodeApi();

const contextMenuHandler = (e) => {
  e.stopImmediatePropagation();
};

const queryTableTimeout = 60 * 1000; // 60 seconds (accounting for compute session expiration)
let queryTableDataTimeoutId = null;
const clearQueryTimeout = () =>
  queryTableDataTimeoutId && clearTimeout(queryTableDataTimeoutId);

export const queryTableData = (
  start: number,
  end: number
): Promise<TableData> => {
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
    }, queryTableTimeout);

    window.addEventListener("message", commandHandler);
  });
};

const useDataViewer = () => {
  const [headers, setHeaders] = useState({});
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [start, setStart] = useState(0);

  useEffect(() => {
    if (rows.length === 0) {
      return;
    }
    vscode.setState({ headers, rows, hasMore, start });
  }, [headers, rows, hasMore, start]);

  const commandHandler = (event) => {
    const { data } = event.data;
    switch (event.data.command) {
      case "response:loadData":
        setHeaders(data.headers);
        setRows(data.rows);
        setHasMore(data.hasMore);
        setStart(data.start);
        break;
      case "response:loadMoreResults": {
        setRows((rows) => rows.concat(event.data.data.rows));
        setHasMore(data.hasMore);
        setStart(data.start);
        break;
      }
      default:
        break;
    }
  };

  const loadMoreResults = () =>
    vscode.postMessage({ command: "request:loadMoreResults" });

  useEffect(() => {
    const serializedState = vscode.getState();
    // If we have serialized data, lets initialize our component with that
    // data and update the start offset so the paginator knows the next data
    // to pull in.
    if (serializedState) {
      const { headers, rows, hasMore, start } = serializedState;
      setHeaders(headers);
      setRows(rows);
      setHasMore(hasMore);
      setStart(start);
      vscode.postMessage({ command: "request:updateStart", data: { start } });
    } else {
      vscode.postMessage({ command: "request:loadData" });
    }

    window.addEventListener("message", commandHandler);

    window.addEventListener("contextmenu", contextMenuHandler, true);

    return () => {
      window.removeEventListener("message", commandHandler);
      window.removeEventListener("contextmenu", contextMenuHandler);
    };
  }, []);

  const getRowsOrWhatever = () => {
    return rows;
  };

  return { loadMoreResults, headers, rows, hasMore, getRowsOrWhatever };
};

export default useDataViewer;
