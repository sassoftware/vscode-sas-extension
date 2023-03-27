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
  provideVSCodeDesignSystem,
  vsCodeDataGrid,
  vsCodeDataGridCell,
  vsCodeDataGridRow,
  vsCodeDivider,
  vsCodeTag,
} from "@vscode/webview-ui-toolkit";

provideVSCodeDesignSystem().register(
  vsCodeDataGrid(),
  vsCodeDataGridCell(),
  vsCodeDataGridRow(),
  vsCodeTag(),
  vsCodeDivider()
);

let storedRowData: any = null;

const populateView = (viewId: string, data) => {
  const dataViewer = document.querySelector(`.data-view-${viewId}`);
  const rows = data.rows.map((row) => {
    return row.cells.reduce((carry, cell, idx) => {
      return { ...carry, [data.headers.columns[idx]]: cell };
    }, {});
  });

  storedRowData = rows;
  dataViewer.rowsData = rows;
};

const commandHandler = (event) => {
  switch (event.data.command) {
    case "onLoad":
      populateView(event.data.viewId, event.data.data);
      break;
    default:
      break;
  }
};

const vscode = acquireVsCodeApi();
const onLoadHandler = () => {
  vscode.postMessage({ command: "requestLoad" });
};

window.addEventListener("message", commandHandler);
window.addEventListener("load", onLoadHandler);
