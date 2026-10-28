// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
export const browserDownloadMessages = {
  panelTitle: "Download SAS Table to This Computer",
  downloadTable: "Download Table",
  saveToLocalMachine: "Save to Local Machine",
  chooseLocationIntro:
    "Choose a location for the CSV file. Keep this tab open while the download is in progress.",
  fileName: "File name",
  chooseFileLocation: "Choose a file location",
  chooseFileLocationDescription: "Select where this CSV should be saved.",
  chooseDestination: "Choose a destination.",
  cancel: "Cancel",
  table: "Table",
  unsupportedFilePicker:
    "This browser does not support choosing a local file from this webview.",
  preparingExport: "Preparing the CSV export...",
  selectionCanceled: "File selection canceled. Choose a location to try again.",
  selectionFailed: "Local file selection failed: {error}",
  chooseLocation: "Choose a location for the CSV file.",
  selectedFileUnavailable:
    "The selected browser file handle is no longer available.",
  permissionRevoked:
    "Permission for the selected file was revoked; select the destination again.",
  writerNotOpen: "The browser write handle is not open.",
  abortFailed: "Abort also failed: {error}",
  invalidBinaryChunk: "Invalid binary browser download chunk.",
  notStarted:
    "This download was not started. Start a new download from Library Navigator.",
  interrupted:
    "This export was interrupted. Start a new download from Library Navigator.",
  canceled:
    "The download was canceled. Start a new download from Library Navigator.",
  failed:
    "The export did not complete. Start a new download from Library Navigator.",
  startNewDownload: "Start a new download from Library Navigator.",
  downloadComplete: "Download complete. You can close this tab.",
} as const;

export type BrowserDownloadMessage =
  (typeof browserDownloadMessages)[keyof typeof browserDownloadMessages];

export type BrowserDownloadMessageLocalizer = (
  message: BrowserDownloadMessage,
) => string;

export type BrowserDownloadLocalizedMessages = Record<
  BrowserDownloadMessage,
  string
>;

export function createBrowserDownloadLocalizedMessages(
  localize: (message: string, args?: Record<string, string>) => string,
): BrowserDownloadLocalizedMessages {
  const localizeMessage = (message: BrowserDownloadMessage): string =>
    message.includes("{error}")
      ? localize(message, { error: "{error}" })
      : localize(message);

  return {
    [browserDownloadMessages.panelTitle]: localizeMessage(
      browserDownloadMessages.panelTitle,
    ),
    [browserDownloadMessages.downloadTable]: localizeMessage(
      browserDownloadMessages.downloadTable,
    ),
    [browserDownloadMessages.saveToLocalMachine]: localizeMessage(
      browserDownloadMessages.saveToLocalMachine,
    ),
    [browserDownloadMessages.chooseLocationIntro]: localizeMessage(
      browserDownloadMessages.chooseLocationIntro,
    ),
    [browserDownloadMessages.fileName]: localizeMessage(
      browserDownloadMessages.fileName,
    ),
    [browserDownloadMessages.chooseFileLocation]: localizeMessage(
      browserDownloadMessages.chooseFileLocation,
    ),
    [browserDownloadMessages.chooseFileLocationDescription]: localizeMessage(
      browserDownloadMessages.chooseFileLocationDescription,
    ),
    [browserDownloadMessages.chooseDestination]: localizeMessage(
      browserDownloadMessages.chooseDestination,
    ),
    [browserDownloadMessages.cancel]: localizeMessage(
      browserDownloadMessages.cancel,
    ),
    [browserDownloadMessages.table]: localizeMessage(
      browserDownloadMessages.table,
    ),
    [browserDownloadMessages.unsupportedFilePicker]: localizeMessage(
      browserDownloadMessages.unsupportedFilePicker,
    ),
    [browserDownloadMessages.preparingExport]: localizeMessage(
      browserDownloadMessages.preparingExport,
    ),
    [browserDownloadMessages.selectionCanceled]: localizeMessage(
      browserDownloadMessages.selectionCanceled,
    ),
    [browserDownloadMessages.selectionFailed]: localizeMessage(
      browserDownloadMessages.selectionFailed,
    ),
    [browserDownloadMessages.chooseLocation]: localizeMessage(
      browserDownloadMessages.chooseLocation,
    ),
    [browserDownloadMessages.selectedFileUnavailable]: localizeMessage(
      browserDownloadMessages.selectedFileUnavailable,
    ),
    [browserDownloadMessages.permissionRevoked]: localizeMessage(
      browserDownloadMessages.permissionRevoked,
    ),
    [browserDownloadMessages.writerNotOpen]: localizeMessage(
      browserDownloadMessages.writerNotOpen,
    ),
    [browserDownloadMessages.abortFailed]: localizeMessage(
      browserDownloadMessages.abortFailed,
    ),
    [browserDownloadMessages.invalidBinaryChunk]: localizeMessage(
      browserDownloadMessages.invalidBinaryChunk,
    ),
    [browserDownloadMessages.notStarted]: localizeMessage(
      browserDownloadMessages.notStarted,
    ),
    [browserDownloadMessages.interrupted]: localizeMessage(
      browserDownloadMessages.interrupted,
    ),
    [browserDownloadMessages.canceled]: localizeMessage(
      browserDownloadMessages.canceled,
    ),
    [browserDownloadMessages.failed]: localizeMessage(
      browserDownloadMessages.failed,
    ),
    [browserDownloadMessages.startNewDownload]: localizeMessage(
      browserDownloadMessages.startNewDownload,
    ),
    [browserDownloadMessages.downloadComplete]: localizeMessage(
      browserDownloadMessages.downloadComplete,
    ),
  };
}
