// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { isRecord } from "./BrowserDownloadGuards";

export type BrowserDownloadResult =
  | "notStarted"
  | "inProgress"
  | "completed"
  | "canceled"
  | "failed"
  | "interrupted";

export interface BrowserDownloadWebviewState {
  tableName: string;
  fileName: string;
  result: BrowserDownloadResult;
}

const isBrowserDownloadResult = (
  value: unknown,
): value is BrowserDownloadResult =>
  value === "notStarted" ||
  value === "inProgress" ||
  value === "completed" ||
  value === "canceled" ||
  value === "failed" ||
  value === "interrupted";

export function deserializeBrowserDownloadWebviewState(
  value: unknown,
): BrowserDownloadWebviewState | undefined {
  if (
    !isRecord(value) ||
    typeof value.tableName !== "string" ||
    !value.tableName.trim() ||
    typeof value.fileName !== "string" ||
    !value.fileName.trim() ||
    !isBrowserDownloadResult(value.result)
  ) {
    return undefined;
  }

  return {
    tableName: value.tableName,
    fileName: value.fileName,
    result: value.result === "inProgress" ? "interrupted" : value.result,
  };
}
