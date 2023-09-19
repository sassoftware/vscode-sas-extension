// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { workspace } from "vscode";

export function isOutputHtmlEnabled(): boolean {
  return !!workspace.getConfiguration("SAS").get("results.html.enabled");
}

export function getHtmlStyle(): string {
  return workspace.getConfiguration("SAS").get("results.html.style");
}
