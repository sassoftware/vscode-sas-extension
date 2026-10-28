// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { browserDownloadMessages } from "./BrowserDownloadMessages";
import type { BrowserDownloadMessageLocalizer } from "./BrowserDownloadMessages";
import type { BrowserDownloadViewModel } from "./BrowserDownloadState";
import localize from "./localize";
import { useBrowserDownload } from "./useBrowserDownload";

interface BrowserDownloadViewProps {
  state: BrowserDownloadViewModel;
  onChooseFile: () => void;
  onCancel: () => void;
  localizeMessage?: BrowserDownloadMessageLocalizer;
}

export function BrowserDownloadView({
  state,
  onChooseFile,
  onCancel,
  localizeMessage = localize,
}: BrowserDownloadViewProps) {
  const tableName = "tableName" in state ? state.tableName : undefined;
  const fileName = "fileName" in state ? state.fileName : undefined;
  const status =
    state.kind === "choosing"
      ? (state.notice ??
        localizeMessage(browserDownloadMessages.chooseLocation))
      : state.kind === "working" ||
          state.kind === "result" ||
          state.kind === "restored"
        ? state.status
        : localizeMessage(browserDownloadMessages.chooseDestination);
  const canChoose = state.kind === "choosing";

  return (
    <main>
      <p className="eyebrow">
        {localizeMessage(browserDownloadMessages.downloadTable)}
      </p>
      <h1>{localizeMessage(browserDownloadMessages.saveToLocalMachine)}</h1>
      <p className="intro">
        {state.kind === "restored"
          ? localizeMessage(browserDownloadMessages.startNewDownload)
          : localizeMessage(browserDownloadMessages.chooseLocationIntro)}
      </p>
      {(tableName || fileName) && (
        <div className="file-summary">
          <span className="file-type" aria-hidden="true">
            CSV
          </span>
          <div>
            <span className="file-label">
              {localizeMessage(browserDownloadMessages.table)}
            </span>
            <strong className="file-value">{tableName}</strong>
            <span className="file-label">
              {localizeMessage(browserDownloadMessages.fileName)}
            </span>
            <strong className="file-value">{fileName}</strong>
          </div>
        </div>
      )}
      {canChoose && (
        <div className="choices">
          <button
            className="destination-choice"
            type="button"
            disabled={state.pickerOpening}
            onClick={onChooseFile}
          >
            <span className="choice-icon" aria-hidden="true">
              PC
            </span>
            <span className="choice-copy">
              <strong>
                {localizeMessage(browserDownloadMessages.chooseFileLocation)}
              </strong>
              <span className="choice-description">
                {localizeMessage(
                  browserDownloadMessages.chooseFileLocationDescription,
                )}
              </span>
            </span>
            <span className="choice-arrow" aria-hidden="true">
              ›
            </span>
          </button>
        </div>
      )}
      <div className="footer">
        <p id="status" role="status" aria-live="polite">
          {status}
        </p>
        {canChoose && (
          <button className="cancel" type="button" onClick={onCancel}>
            {localizeMessage(browserDownloadMessages.cancel)}
          </button>
        )}
      </div>
    </main>
  );
}

export default function BrowserDownloadApp() {
  const { state, chooseFile, cancel } = useBrowserDownload();
  return (
    <BrowserDownloadView
      state={state}
      onChooseFile={() => void chooseFile()}
      onCancel={cancel}
    />
  );
}
