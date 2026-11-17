// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import localize from "../localize";
import { browserDownloadMessages } from "./BrowserDownloadMessages";
import type { BrowserDownloadMessageLocalizer } from "./BrowserDownloadMessages";
import type { BrowserDownloadViewModel } from "./BrowserDownloadState";
import { useBrowserDownload } from "./useBrowserDownload";

interface BrowserDownloadContentProps {
  state: BrowserDownloadViewModel;
  onChooseFile: () => void;
  onCancel: () => void;
  localizeMessage?: BrowserDownloadMessageLocalizer;
}

export function BrowserDownloadContent({
  state,
  onChooseFile,
  onCancel,
  localizeMessage = localize,
}: BrowserDownloadContentProps) {
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
      <h1 aria-describedby="download-instructions">
        {localizeMessage(browserDownloadMessages.saveToLocalMachine)}
      </h1>
      <p className="intro" id="download-instructions">
        {state.kind === "restored"
          ? localizeMessage(browserDownloadMessages.startNewDownload)
          : localizeMessage(browserDownloadMessages.chooseLocationIntro)}
      </p>
      {(tableName || fileName) && (
        <section
          className="file-summary"
          aria-labelledby="file-summary-heading"
        >
          <span className="file-type" aria-hidden="true">
            CSV
          </span>
          <div className="file-details">
            <h2 id="file-summary-heading" className="section-label">
              {localizeMessage(browserDownloadMessages.downloadTable)}
            </h2>
            <dl>
              <div>
                <dt>{localizeMessage(browserDownloadMessages.table)}</dt>
                <dd className="file-value">{tableName}</dd>
              </div>
              <div>
                <dt>{localizeMessage(browserDownloadMessages.fileName)}</dt>
                <dd className="file-value">{fileName}</dd>
              </div>
            </dl>
          </div>
        </section>
      )}
      {canChoose && (
        <section className="choices" aria-labelledby="destination-heading">
          <h2 id="destination-heading" className="section-label">
            {localizeMessage(browserDownloadMessages.chooseDestination)}
          </h2>
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
        </section>
      )}
      <div className="footer">
        <p id="status" role="status" aria-live="polite">
          <span className="status-label">
            {localizeMessage(browserDownloadMessages.downloadTable)}
          </span>
          <span>{status}</span>
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

export default function BrowserDownloadView() {
  const { state, chooseFile, cancel } = useBrowserDownload();
  return (
    <BrowserDownloadContent
      state={state}
      onChooseFile={() => void chooseFile()}
      onCancel={cancel}
    />
  );
}
