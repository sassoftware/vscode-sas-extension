// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Webview entry-point for the "better" table viewer. esbuild bundles this
// file plus its CSS imports into `client/dist/webview/BetterDataViewer.{js,css}`.
// The host (`panels/BetterDataViewer.ts`) references those output paths.
import { StrictMode } from "react";
import "react-data-grid/lib/styles.css";
import { createRoot } from "react-dom/client";

import { App } from "./App";

import "./DataViewer.css";

const mount = document.querySelector(".data-viewer-container");
if (mount instanceof HTMLElement) {
  createRoot(mount).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
