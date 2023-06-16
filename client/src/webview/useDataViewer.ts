// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useState } from "react";

declare const acquireVsCodeApi;
const vscode = acquireVsCodeApi();

const contextMenuHandler = (e) => {
  e.stopImmediatePropagation();
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

  return { loadMoreResults, headers, rows, hasMore };
};

export default useDataViewer;
