// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useReducer, useRef } from "react";

import { isRecord } from "../components/LibraryNavigator/BrowserFileDownloadTarget/BrowserDownloadGuards";
import {
  type BrowserDownloadResult,
  deserializeBrowserDownloadWebviewState,
} from "../components/LibraryNavigator/BrowserFileDownloadTarget/BrowserDownloadWebviewState";
import {
  type BrowserDownloadClientApi,
  BrowserFileWriter,
  type BrowserFileWriterMessages,
} from "../components/LibraryNavigator/BrowserFileDownloadTarget/BrowserFileWriter";
import {
  type BrowserDownloadMessageLocalizer,
  browserDownloadMessages,
} from "./BrowserDownloadMessages";
import {
  type BrowserDownloadAction,
  type BrowserDownloadViewModel,
  browserDownloadReducer,
  initialBrowserDownloadState,
} from "./BrowserDownloadState";
import localize from "./localize";

interface VsCodeApi extends BrowserDownloadClientApi {
  setState(state: {
    tableName: string;
    fileName: string;
    result: BrowserDownloadResult;
  }): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

interface MessageEventData {
  data: unknown;
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

export const createBrowserDownloadWriterMessages = (
  localizeMessage: BrowserDownloadMessageLocalizer = localize,
): BrowserFileWriterMessages => ({
  unsupportedFilePicker: localizeMessage(
    browserDownloadMessages.unsupportedFilePicker,
  ),
  selectionCanceled: localizeMessage(browserDownloadMessages.selectionCanceled),
  selectionFailed: localizeMessage(browserDownloadMessages.selectionFailed),
  selectedFileUnavailable: localizeMessage(
    browserDownloadMessages.selectedFileUnavailable,
  ),
  permissionRevoked: localizeMessage(browserDownloadMessages.permissionRevoked),
  writerNotOpen: localizeMessage(browserDownloadMessages.writerNotOpen),
  abortFailed: localizeMessage(browserDownloadMessages.abortFailed),
  invalidBinaryChunk: localizeMessage(
    browserDownloadMessages.invalidBinaryChunk,
  ),
});

const writerMessages = createBrowserDownloadWriterMessages();

const restoreMessage = (
  result: Exclude<BrowserDownloadResult, "inProgress">,
): string => {
  switch (result) {
    case "notStarted":
      return localize(browserDownloadMessages.notStarted);
    case "interrupted":
      return localize(browserDownloadMessages.interrupted);
    case "completed":
      return localize(browserDownloadMessages.downloadComplete);
    case "canceled":
      return localize(browserDownloadMessages.canceled);
    case "failed":
      return localize(browserDownloadMessages.failed);
  }
};

const persistState = (
  vscode: VsCodeApi,
  tableName: string,
  fileName: string,
  result: BrowserDownloadResult,
): void => {
  try {
    vscode.setState({ tableName, fileName, result });
  } catch (error) {
    console.error("Could not persist browser download view state.", error);
  }
};

export function useBrowserDownload(): {
  state: BrowserDownloadViewModel;
  chooseFile: () => Promise<void>;
  cancel: () => void;
} {
  const [state, reactDispatch] = useReducer(
    browserDownloadReducer,
    initialBrowserDownloadState,
  );
  const stateRef = useRef(initialBrowserDownloadState);
  const dispatch = useCallback((action: BrowserDownloadAction) => {
    stateRef.current = browserDownloadReducer(stateRef.current, action);
    reactDispatch(action);
  }, []);
  const apiRef = useRef<VsCodeApi | undefined>(undefined);
  const writerRef = useRef<BrowserFileWriter | undefined>(undefined);

  useEffect(() => {
    const vscode = acquireVsCodeApi();
    const writer = new BrowserFileWriter(vscode, writerMessages);
    apiRef.current = vscode;
    writerRef.current = writer;

    const handleMessage = (event: MessageEventData): void => {
      const message = event.data;
      if (!isRecord(message) || typeof message.type !== "string") {
        return;
      }

      if (
        message.type === "choose" &&
        typeof message.choiceId === "string" &&
        typeof message.tableName === "string" &&
        typeof message.fileName === "string"
      ) {
        dispatch({
          type: "choose",
          choiceId: message.choiceId,
          tableName: message.tableName,
          fileName: message.fileName,
        });
        persistState(vscode, message.tableName, message.fileName, "notStarted");
        if (!writer.isPickerSupported()) {
          const error = writerMessages.unsupportedFilePicker;
          dispatch({ type: "picker-notice", message: error });
          vscode.postMessage({
            type: "destination",
            choiceId: message.choiceId,
            kind: "unsupported",
            error,
          });
        }
        return;
      }

      if (message.type === "status" && typeof message.message === "string") {
        const result = isBrowserDownloadResult(message.result)
          ? message.result
          : undefined;
        dispatch({ type: "status", message: message.message, result });
        const current = stateRef.current;
        if (
          result &&
          "tableName" in current &&
          typeof current.tableName === "string" &&
          typeof current.fileName === "string"
        ) {
          persistState(vscode, current.tableName, current.fileName, result);
        }
        return;
      }

      if (message.type === "restore") {
        const candidate = deserializeBrowserDownloadWebviewState(message.state);
        const restoredState =
          candidate && candidate.result !== "inProgress"
            ? {
                tableName: candidate.tableName,
                fileName: candidate.fileName,
                result: candidate.result,
              }
            : undefined;
        if (restoredState) {
          dispatch({
            type: "restore",
            state: restoredState,
            guidance: restoreMessage(restoredState.result),
          });
          persistState(
            vscode,
            restoredState.tableName,
            restoredState.fileName,
            restoredState.result,
          );
        } else {
          dispatch({
            type: "restore",
            guidance: localize(browserDownloadMessages.startNewDownload),
          });
        }
        return;
      }

      void writer.handleMessage(message).catch((error: unknown) => {
        console.error("Browser download writer message failed.", error);
      });
    };

    window.addEventListener("message", handleMessage);
    vscode.postMessage({ type: "ready" });
    return () => {
      window.removeEventListener("message", handleMessage);
      apiRef.current = undefined;
      writerRef.current = undefined;
    };
  }, [dispatch]);

  const chooseFile = useCallback(async () => {
    const current = stateRef.current;
    const api = apiRef.current;
    const writer = writerRef.current;
    if (current.kind !== "choosing" || !api || !writer) {
      return;
    }

    dispatch({ type: "picker-opening" });
    const choice = await writer.chooseFile(current.fileName);
    if (choice.kind === "canceled") {
      dispatch({
        type: "picker-notice",
        message: writerMessages.selectionCanceled,
      });
      return;
    }
    if (choice.kind === "failed" || choice.kind === "unsupported") {
      dispatch({ type: "picker-notice", message: choice.error });
      if (choice.kind === "unsupported") {
        api.postMessage({
          type: "destination",
          choiceId: current.choiceId,
          kind: "unsupported",
          error: choice.error,
        });
      }
      return;
    }

    const status = localize(browserDownloadMessages.preparingExport);
    dispatch({
      type: "destination-selected",
      fileName: choice.fileName,
      status,
    });
    persistState(api, current.tableName, choice.fileName, "notStarted");
    api.postMessage({
      type: "destination",
      choiceId: current.choiceId,
      kind: "local",
      token: choice.token,
      fileName: choice.fileName,
    });
  }, [dispatch]);

  const cancel = useCallback(() => {
    const current = stateRef.current;
    apiRef.current?.postMessage({
      type: "destination",
      choiceId: current.kind === "choosing" ? current.choiceId : undefined,
      kind: "cancel",
    });
  }, []);

  return { state, chooseFile, cancel };
}
