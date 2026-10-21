// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

import { createBrowserFileWriterScript } from "./BrowserFileWriter";

type BrowserDownloadMessage =
  | "Download SAS Table to This Computer"
  | "Download Table"
  | "Save to Local Machine"
  | "Choose a location for the CSV file. Keep this tab open while the download is in progress."
  | "File name"
  | "Choose a file location"
  | "Select where this CSV should be saved."
  | "Choose a destination."
  | "Cancel"
  | "This browser does not support choosing a local file from this webview."
  | "Preparing the CSV export..."
  | "File selection canceled. Choose a location to try again."
  | "Local file selection failed: {error}"
  | "Choose a location for the CSV file."
  | "The selected browser file handle is no longer available."
  | "Permission for the selected file was revoked; select the destination again."
  | "The browser write handle is not open."
  | "Abort also failed: {error}";

export function createBrowserDownloadWebview(nonce: string): string {
  const localizedMessages: Record<BrowserDownloadMessage, string> = {
    "Download SAS Table to This Computer": l10n.t(
      "Download SAS Table to This Computer",
    ),
    "Download Table": l10n.t("Download Table"),
    "Save to Local Machine": l10n.t("Save to Local Machine"),
    "Choose a location for the CSV file. Keep this tab open while the download is in progress.":
      l10n.t(
        "Choose a location for the CSV file. Keep this tab open while the download is in progress.",
      ),
    "File name": l10n.t("File name"),
    "Choose a file location": l10n.t("Choose a file location"),
    "Select where this CSV should be saved.": l10n.t(
      "Select where this CSV should be saved.",
    ),
    "Choose a destination.": l10n.t("Choose a destination."),
    Cancel: l10n.t("Cancel"),
    "This browser does not support choosing a local file from this webview.":
      l10n.t(
        "This browser does not support choosing a local file from this webview.",
      ),
    "Preparing the CSV export...": l10n.t("Preparing the CSV export..."),
    "File selection canceled. Choose a location to try again.": l10n.t(
      "File selection canceled. Choose a location to try again.",
    ),
    "Local file selection failed: {error}": l10n.t(
      "Local file selection failed: {error}",
      { error: "{error}" },
    ),
    "Choose a location for the CSV file.": l10n.t(
      "Choose a location for the CSV file.",
    ),
    "The selected browser file handle is no longer available.": l10n.t(
      "The selected browser file handle is no longer available.",
    ),
    "Permission for the selected file was revoked; select the destination again.":
      l10n.t(
        "Permission for the selected file was revoked; select the destination again.",
      ),
    "The browser write handle is not open.": l10n.t(
      "The browser write handle is not open.",
    ),
    "Abort also failed: {error}": l10n.t("Abort also failed: {error}", {
      error: "{error}",
    }),
  };
  const text = (message: BrowserDownloadMessage) =>
    localizedMessages[message].replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  const writerMessages = {
    unsupportedFilePicker:
      localizedMessages[
        "This browser does not support choosing a local file from this webview."
      ],
    preparingExport: localizedMessages["Preparing the CSV export..."],
    selectionCanceled:
      localizedMessages[
        "File selection canceled. Choose a location to try again."
      ],
    selectionFailed: localizedMessages["Local file selection failed: {error}"],
    chooseLocation: localizedMessages["Choose a location for the CSV file."],
    selectedFileUnavailable:
      localizedMessages[
        "The selected browser file handle is no longer available."
      ],
    permissionRevoked:
      localizedMessages[
        "Permission for the selected file was revoked; select the destination again."
      ],
    writerNotOpen: localizedMessages["The browser write handle is not open."],
    abortFailed: localizedMessages["Abort also failed: {error}"],
  };

  return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}';">
          <title>${text("Download SAS Table to This Computer")}</title>
          <style nonce="${nonce}">
            :root {
              color-scheme: light dark;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 32px 24px;
              color: var(--vscode-foreground);
              background: var(--vscode-editor-background);
              font-family: var(--vscode-font-family);
              font-size: var(--vscode-font-size);
            }

            main {
              width: 100%;
              max-width: 560px;
              margin: 0 auto;
            }

            .eyebrow {
              margin: 0 0 8px;
              color: var(--vscode-descriptionForeground);
              font-size: 0.85em;
              font-weight: 600;
              letter-spacing: 0.08em;
              text-transform: uppercase;
            }

            h1 {
              margin: 0;
              font-size: 1.6em;
              font-weight: 600;
            }

            .intro {
              margin: 8px 0 24px;
              color: var(--vscode-descriptionForeground);
            }

            .file {
              display: flex;
              align-items: center;
              gap: 12px;
              margin-bottom: 20px;
              padding: 12px 14px;
              border: 1px solid var(--vscode-panel-border);
              border-radius: 6px;
              background: var(--vscode-sideBar-background, transparent);
            }

            .file-type {
              display: grid;
              width: 36px;
              height: 36px;
              flex: 0 0 auto;
              place-items: center;
              border-radius: 4px;
              color: var(--vscode-badge-foreground);
              background: var(--vscode-badge-background);
              font-size: 0.75em;
              font-weight: 700;
            }

            .file-label {
              display: block;
              color: var(--vscode-descriptionForeground);
              font-size: 0.85em;
            }

            #file-name {
              overflow-wrap: anywhere;
              font-weight: 600;
            }

            .choices {
              display: grid;
              gap: 10px;
            }

            .destination-choice {
              display: flex;
              width: 100%;
              align-items: center;
              gap: 14px;
              padding: 14px;
              border: 1px solid var(--vscode-panel-border);
              border-radius: 6px;
              color: var(--vscode-foreground);
              background: transparent;
              font: inherit;
              text-align: left;
              cursor: pointer;
            }

            .destination-choice:hover {
              background: var(--vscode-list-hoverBackground);
            }

            .destination-choice:focus-visible,
            .cancel:focus-visible {
              outline: 1px solid var(--vscode-focusBorder);
              outline-offset: 2px;
            }

            .choice-icon {
              display: grid;
              width: 36px;
              height: 36px;
              flex: 0 0 auto;
              place-items: center;
              border-radius: 4px;
              color: var(--vscode-button-foreground);
              background: var(--vscode-button-background);
              font-size: 1.1em;
              font-weight: 600;
            }

            .choice-copy {
              display: grid;
              flex: 1;
              gap: 3px;
            }

            .choice-description {
              color: var(--vscode-descriptionForeground);
              font-size: 0.9em;
            }

            .choice-arrow {
              color: var(--vscode-descriptionForeground);
              font-size: 1.2em;
            }

            .footer {
              display: flex;
              min-height: 40px;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              margin-top: 12px;
            }

            #status {
              margin: 0;
              color: var(--vscode-descriptionForeground);
              font-size: 0.9em;
            }

            .cancel {
              padding: 6px 10px;
              border: 0;
              color: var(--vscode-textLink-foreground);
              background: transparent;
              font: inherit;
              cursor: pointer;
            }

            [hidden] {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <main>
            <p class="eyebrow">${text("Download Table")}</p>
            <h1>${text("Save to Local Machine")}</h1>
            <p class="intro">${text("Choose a location for the CSV file. Keep this tab open while the download is in progress.")}</p>
            <div class="file">
              <span class="file-type" aria-hidden="true">CSV</span>
              <span>
                <span class="file-label">${text("File name")}</span>
                <span id="file-name"></span>
              </span>
            </div>
            <div class="choices">
              <button class="destination-choice" id="choose-file" disabled>
                <span class="choice-icon" aria-hidden="true">PC</span>
                <span class="choice-copy">
                  <strong>${text("Choose a file location")}</strong>
                  <span class="choice-description">${text("Select where this CSV should be saved.")}</span>
                </span>
                <span class="choice-arrow" aria-hidden="true">&rsaquo;</span>
              </button>
            </div>
            <div class="footer">
              <p id="status" role="status" aria-live="polite">${text("Choose a destination.")}</p>
              <button class="cancel" id="cancel">${text("Cancel")}</button>
            </div>
          </main>
${createBrowserFileWriterScript(nonce, writerMessages)}
        </body>
      </html>`;
}
