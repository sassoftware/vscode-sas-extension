// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { expect } from "chai";

import {
  type BrowserDownloadMessageLocalizer,
  browserDownloadMessages,
  createBrowserDownloadLocalizedMessages,
} from "../../../src/webview/BrowserDownload/BrowserDownloadMessages";
import {
  browserDownloadReducer,
  initialBrowserDownloadState,
} from "../../../src/webview/BrowserDownload/BrowserDownloadState";
import { BrowserDownloadContent } from "../../../src/webview/BrowserDownload/BrowserDownloadView";

const localizedMessages = createBrowserDownloadLocalizedMessages(
  (message, args) => {
    let translatedMessage = `localized:${message}`;
    for (const [key, value] of Object.entries(args ?? {})) {
      translatedMessage = translatedMessage.replace(`{${key}}`, String(value));
    }
    return translatedMessage;
  },
);
const localizeBrowserDownloadMessage: BrowserDownloadMessageLocalizer = (
  message,
) => localizedMessages[message];

describe("BrowserDownload content view", () => {
  it("renders shared localized labels and accessible status without markup", () => {
    const state = browserDownloadReducer(initialBrowserDownloadState, {
      type: "choose",
      choiceId: "choice",
      tableName: "<img src=x onerror=alert(1)>",
      fileName: "table.csv",
    });
    const html = renderToStaticMarkup(
      createElement(BrowserDownloadContent, {
        state,
        onChooseFile: () => undefined,
        onCancel: () => undefined,
        localizeMessage: localizeBrowserDownloadMessage,
      }),
    );

    expect(html).to.include("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).to.include('role="status" aria-live="polite"');
    expect(html).to.include('aria-describedby="download-instructions"');
    expect(html).to.include('class="destination-choice"');
    expect(html).to.include('aria-labelledby="destination-heading"');
    expect(html).to.include('aria-labelledby="file-summary-heading"');
    expect(html).to.include("<dt>");
    expect(html).to.include(
      `${localizedMessages[browserDownloadMessages.cancel]}</button>`,
    );
    expect(html).to.include(
      localizedMessages[browserDownloadMessages.downloadTable],
    );
    expect(html).to.include(
      localizedMessages[browserDownloadMessages.saveToLocalMachine],
    );
    expect(html).to.include(
      localizedMessages[browserDownloadMessages.chooseFileLocation],
    );
  });

  it("keeps picker cancellation in the chooser and moves selected files to working", () => {
    const choosing = browserDownloadReducer(initialBrowserDownloadState, {
      type: "choose",
      choiceId: "choice",
      tableName: "WORK.TABLE",
      fileName: "work.table.csv",
    });
    const canceled = browserDownloadReducer(choosing, {
      type: "picker-notice",
      message: "Picker canceled",
    });
    expect(canceled.kind).to.equal("choosing");
    if (canceled.kind !== "choosing") {
      throw new Error("Picker cancellation must leave the chooser available.");
    }
    expect(canceled.notice).to.equal("Picker canceled");

    const working = browserDownloadReducer(canceled, {
      type: "destination-selected",
      fileName: "selected.csv",
      status: "Preparing",
    });
    expect(working).to.deep.equal({
      kind: "working",
      tableName: "WORK.TABLE",
      fileName: "selected.csv",
      status: "Preparing",
    });
  });

  it("renders restored outcomes as informational and inert", () => {
    const outcomes = [
      ["notStarted", "Not started"],
      ["interrupted", "Interrupted"],
      ["completed", "Complete"],
      ["canceled", "Canceled"],
      ["failed", "Failed"],
    ] as const;

    for (const [result, status] of outcomes) {
      const state = browserDownloadReducer(initialBrowserDownloadState, {
        type: "restore",
        state: {
          tableName: "WORK.TABLE",
          fileName: "work.table.csv",
          result,
        },
        guidance: status,
      });
      const html = renderToStaticMarkup(
        createElement(BrowserDownloadContent, {
          state,
          onChooseFile: () => undefined,
          onCancel: () => undefined,
        }),
      );

      expect(html).to.include('role="status" aria-live="polite"');
      expect(html).to.include(status);
      expect(html).to.include("WORK.TABLE");
      expect(html).not.to.include("<button");
    }
  });

  it("turns live terminal status messages into result states", () => {
    const choosing = browserDownloadReducer(initialBrowserDownloadState, {
      type: "choose",
      choiceId: "choice",
      tableName: "WORK.TABLE",
      fileName: "work.table.csv",
    });
    const working = browserDownloadReducer(choosing, {
      type: "destination-selected",
      fileName: "work.table.csv",
      status: "Preparing",
    });
    const completed = browserDownloadReducer(working, {
      type: "status",
      message: "Download complete.",
      result: "completed",
    });

    expect(completed).to.deep.equal({
      kind: "result",
      tableName: "WORK.TABLE",
      fileName: "work.table.csv",
      result: "completed",
      status: "Download complete.",
    });
  });
});
