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

export function showLogOnExecutionStart(): boolean {
  return workspace.getConfiguration("SAS").get("log.showOnExecutionStart");
}

export function showLogOnExecutionFinish(): boolean {
  return workspace.getConfiguration("SAS").get("log.showOnExecutionFinish");
}

export function clearLogOnExecutionStart(): boolean {
  return workspace.getConfiguration("SAS").get("log.clearOnExecutionStart");
}

export function isShowProblemsFromSASLogEnabled(): boolean {
  return workspace.getConfiguration("SAS").get("problems.log.enabled");
}

export function includeLogInNotebookExport(): boolean {
  return workspace.getConfiguration("SAS").get("notebook.export.includeLog");
}
