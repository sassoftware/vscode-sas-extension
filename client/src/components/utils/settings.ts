// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { workspace } from "vscode";

export function isOutputHtmlEnabled(): boolean {
  return !!workspace.getConfiguration("SAS").get("results.html.enabled");
}

export function getHtmlStyle(): string {
  return workspace.getConfiguration("SAS").get("results.html.style");
}

export function isSideResultEnabled(): string {
  return workspace.getConfiguration("SAS").get("results.sideBySide");
}

export function isSinglePanelEnabled(): string {
  return workspace.getConfiguration("SAS").get("results.singlePanel");
}

export function isFocusLogOnExecutionStart(): boolean {
  return workspace.getConfiguration("SAS").get("logFocus.onExecutionStart");
}

export function isFocusLogOnExecutionFinish(): boolean {
  return workspace.getConfiguration("SAS").get("logFocus.onExecutionFinish");
}
