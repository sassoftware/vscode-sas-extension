// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { createRoot } from "react-dom/client";

import BrowserDownloadView from "./BrowserDownloadView";

import "./BrowserDownload.css";

const container = document.getElementById("browser-download-root");
if (!container) {
  throw new Error("Browser download webview root element is missing.");
}

createRoot(container).render(<BrowserDownloadView />);
