// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { BrowserDownloadResult } from "../components/LibraryNavigator/BrowserFileDownloadTarget/BrowserDownloadWebviewState";

export type BrowserDownloadViewModel =
  | { kind: "waiting" }
  | {
      kind: "choosing";
      choiceId: string;
      tableName: string;
      fileName: string;
      pickerOpening: boolean;
      notice?: string;
    }
  | {
      kind: "working";
      tableName: string;
      fileName: string;
      status: string;
    }
  | {
      kind: "result";
      tableName: string;
      fileName: string;
      result: "completed" | "canceled" | "failed";
      status: string;
    }
  | {
      kind: "restored";
      tableName?: string;
      fileName?: string;
      result?: Exclude<BrowserDownloadResult, "inProgress">;
      status: string;
    };

export type BrowserDownloadAction =
  | {
      type: "choose";
      choiceId: string;
      tableName: string;
      fileName: string;
    }
  | { type: "picker-opening" }
  | { type: "picker-notice"; message: string }
  | { type: "destination-selected"; fileName: string; status: string }
  | {
      type: "status";
      message: string;
      result?: BrowserDownloadResult;
    }
  | {
      type: "restore";
      state?: {
        tableName: string;
        fileName: string;
        result: Exclude<BrowserDownloadResult, "inProgress">;
      };
      guidance: string;
    };

export const initialBrowserDownloadState: BrowserDownloadViewModel = {
  kind: "waiting",
};

const labelsFor = (
  state: BrowserDownloadViewModel,
): { tableName: string; fileName: string } | undefined => {
  if ("tableName" in state && "fileName" in state) {
    return { tableName: state.tableName, fileName: state.fileName };
  }
  return undefined;
};

export function browserDownloadReducer(
  state: BrowserDownloadViewModel,
  action: BrowserDownloadAction,
): BrowserDownloadViewModel {
  switch (action.type) {
    case "choose":
      return {
        kind: "choosing",
        choiceId: action.choiceId,
        tableName: action.tableName,
        fileName: action.fileName,
        pickerOpening: false,
      };
    case "picker-opening":
      return state.kind === "choosing"
        ? { ...state, pickerOpening: true, notice: undefined }
        : state;
    case "picker-notice":
      return state.kind === "choosing"
        ? { ...state, pickerOpening: false, notice: action.message }
        : state;
    case "destination-selected":
      return state.kind === "choosing"
        ? {
            kind: "working",
            tableName: state.tableName,
            fileName: action.fileName,
            status: action.status,
          }
        : state;
    case "status": {
      const labels = labelsFor(state);
      if (!labels) {
        return state;
      }
      if (
        action.result === "completed" ||
        action.result === "canceled" ||
        action.result === "failed"
      ) {
        return {
          kind: "result",
          ...labels,
          result: action.result,
          status: action.message,
        };
      }
      if (action.result === "notStarted") {
        return state.kind === "choosing"
          ? { ...state, pickerOpening: false, notice: action.message }
          : state;
      }
      if (
        action.result === "inProgress" ||
        action.result === "interrupted" ||
        state.kind === "working"
      ) {
        return { kind: "working", ...labels, status: action.message };
      }
      return state;
    }
    case "restore":
      return action.state
        ? {
            kind: "restored",
            ...action.state,
            status: action.guidance,
          }
        : { kind: "restored", status: action.guidance };
  }
}
