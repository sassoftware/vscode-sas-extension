import { useEffect, useState } from "react";

declare const acquireVsCodeApi;
const vscode = acquireVsCodeApi();

const useDataViewer = () => {
  const [headers, setHeaders] = useState({});
  const [rows, setRows] = useState([]);
  const [hasMore, setHasMore] = useState(false);

  const commandHandler = (event) => {
    const { data } = event.data;
    switch (event.data.command) {
      case "response:loadData":
        setHeaders(data.headers);
        setRows(data.rows);
        setHasMore(data.hasMore);
        break;
      case "response:loadMoreResults": {
        setRows((rows) => rows.concat(event.data.data.rows));
        setHasMore(data.hasMore);
        break;
      }
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

  return { loadMoreResults, headers, rows, hasMore };
};

export default useDataViewer;
