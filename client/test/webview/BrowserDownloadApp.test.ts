// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { expect } from "chai";

import {
  type BrowserDownloadClientApi,
  type BrowserFileBrowser,
  BrowserFileWriter,
  type BrowserFileWriterMessages,
  type BrowserWritableFile,
} from "../../src/components/LibraryNavigator/BrowserFileDownloadTarget/BrowserFileWriter";
import { BrowserDownloadView } from "../../src/webview/BrowserDownloadApp";
import {
  type BrowserDownloadMessageLocalizer,
  browserDownloadMessages,
  createBrowserDownloadLocalizedMessages,
} from "../../src/webview/BrowserDownloadMessages";
import {
  browserDownloadReducer,
  initialBrowserDownloadState,
} from "../../src/webview/BrowserDownloadState";
import { createBrowserDownloadWriterMessages } from "../../src/webview/useBrowserDownload";

const writerMessages: BrowserFileWriterMessages = {
  unsupportedFilePicker: "Unsupported",
  selectionCanceled: "Picker canceled",
  selectionFailed: "Picker failed: {error}",
  selectedFileUnavailable: "File unavailable",
  permissionRevoked: "Permission revoked",
  writerNotOpen: "Writer not open",
  abortFailed: "Abort failed: {error}",
  invalidBinaryChunk: "Invalid binary browser download chunk.",
};

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

const browser = (
  showSaveFilePicker?: BrowserFileBrowser["showSaveFilePicker"],
): BrowserFileBrowser => ({
  crypto: { randomUUID: () => "00000000-0000-0000-0000-000000000001" },
  showSaveFilePicker,
});

describe("BrowserDownload React view", () => {
  it("renders shared localized labels and accessible status without markup", () => {
    const state = browserDownloadReducer(initialBrowserDownloadState, {
      type: "choose",
      choiceId: "choice",
      tableName: "<img src=x onerror=alert(1)>",
      fileName: "table.csv",
    });
    const html = renderToStaticMarkup(
      createElement(BrowserDownloadView, {
        state,
        onChooseFile: () => undefined,
        onCancel: () => undefined,
        localizeMessage: localizeBrowserDownloadMessage,
      }),
    );

    expect(html).to.include("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).to.include('role="status" aria-live="polite"');
    expect(html).to.include('class="destination-choice"');
    expect(html).to.include(
      `${localizedMessages[browserDownloadMessages.cancel]}</button>`,
    );
    expect(html).to.include(
      localizedMessages[browserDownloadMessages.downloadTable],
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
        createElement(BrowserDownloadView, {
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

describe("BrowserFileWriter", () => {
  let postedMessages: Record<string, unknown>[];
  let clientApi: BrowserDownloadClientApi;

  beforeEach(() => {
    postedMessages = [];
    clientApi = {
      postMessage: (message) => postedMessages.push(message),
    };
  });

  it("uses values from the shared localized message map", async () => {
    const messages = createBrowserDownloadWriterMessages(
      localizeBrowserDownloadMessage,
    );
    const unsupportedWriter = new BrowserFileWriter(
      clientApi,
      messages,
      browser(),
    );
    expect(await unsupportedWriter.chooseFile("table.csv")).to.deep.equal({
      kind: "unsupported",
      error: localizedMessages[browserDownloadMessages.unsupportedFilePicker],
    });

    const failedWriter = new BrowserFileWriter(
      clientApi,
      messages,
      browser(async () => {
        throw new Error("Denied");
      }),
    );
    expect(await failedWriter.chooseFile("table.csv")).to.deep.equal({
      kind: "failed",
      error: localizedMessages[browserDownloadMessages.selectionFailed].replace(
        "{error}",
        "Denied",
      ),
    });
  });

  it("selects a browser file and retains its handle for transfer setup", async () => {
    const fileHandle = {
      name: "selected.csv",
      queryPermission: async () => "granted" as PermissionState,
      createWritable: async () => ({
        write: async () => undefined,
        close: async () => undefined,
        abort: async () => undefined,
      }),
    };
    const writer = new BrowserFileWriter(
      clientApi,
      writerMessages,
      browser(async () => fileHandle),
    );

    const choice = await writer.chooseFile("suggested.csv");

    expect(choice).to.deep.equal({
      kind: "local",
      token: "00000000-0000-0000-0000-000000000001",
      fileName: "selected.csv",
    });
  });

  it("reports unsupported, canceled, and failed picker outcomes distinctly", async () => {
    const unsupportedWriter = new BrowserFileWriter(
      clientApi,
      writerMessages,
      browser(),
    );
    expect(await unsupportedWriter.chooseFile("table.csv")).to.deep.equal({
      kind: "unsupported",
      error: "Unsupported",
    });

    const canceledWriter = new BrowserFileWriter(
      clientApi,
      writerMessages,
      browser(async () => {
        throw { name: "AbortError" };
      }),
    );
    expect(await canceledWriter.chooseFile("table.csv")).to.deep.equal({
      kind: "canceled",
    });

    const failedWriter = new BrowserFileWriter(
      clientApi,
      writerMessages,
      browser(async () => {
        throw new Error("Denied");
      }),
    );
    expect(await failedWriter.chooseFile("table.csv")).to.deep.equal({
      kind: "failed",
      error: "Picker failed: Denied",
    });
  });

  it("writes acknowledged binary chunks and closes the selected file", async () => {
    const writes: Uint8Array[] = [];
    let closed = false;
    const fileHandle = {
      name: "selected.csv",
      queryPermission: async () => "granted" as PermissionState,
      createWritable: async (): Promise<BrowserWritableFile> => ({
        write: async (data) => {
          writes.push(data);
        },
        close: async () => {
          closed = true;
        },
        abort: async () => undefined,
      }),
    };
    const writer = new BrowserFileWriter(
      clientApi,
      writerMessages,
      browser(async () => fileHandle),
    );
    const choice = await writer.chooseFile("table.csv");
    if (choice.kind !== "local") {
      throw new Error("Expected the browser file picker to succeed.");
    }

    await writer.handleMessage({
      type: "open",
      requestId: "open",
      transferId: "transfer",
      token: choice.token,
    });
    await writer.handleMessage({
      type: "write",
      requestId: "write",
      transferId: "transfer",
      data: new Uint8Array([1, 2]),
      byteLength: 2,
    });
    await writer.handleMessage({
      type: "finish",
      requestId: "finish",
      transferId: "transfer",
      commit: true,
    });

    expect([...writes[0]]).to.deep.equal([1, 2]);
    expect(closed).to.equal(true);
    expect(postedMessages.map((message) => message.ok)).to.deep.equal([
      true,
      true,
      true,
    ]);
  });

  it("rejects malformed binary chunks and aborts their writer", async () => {
    let aborted = false;
    const fileHandle = {
      name: "selected.csv",
      queryPermission: async () => "granted" as PermissionState,
      createWritable: async (): Promise<BrowserWritableFile> => ({
        write: async () => {
          throw new Error("Malformed chunk was written.");
        },
        close: async () => undefined,
        abort: async () => {
          aborted = true;
        },
      }),
    };
    const writer = new BrowserFileWriter(
      clientApi,
      writerMessages,
      browser(async () => fileHandle),
    );
    const choice = await writer.chooseFile("table.csv");
    if (choice.kind !== "local") {
      throw new Error("Expected the browser file picker to succeed.");
    }
    await writer.handleMessage({
      type: "open",
      requestId: "open",
      transferId: "transfer",
      token: choice.token,
    });
    await writer.handleMessage({
      type: "write",
      requestId: "write",
      transferId: "transfer",
      data: new ArrayBuffer(1),
      byteLength: 1,
    });

    expect(aborted).to.equal(true);
    expect(postedMessages.at(-1)).to.include({
      requestId: "write",
      ok: false,
    });
    expect(postedMessages.at(-1)?.error).to.include(
      "Invalid binary browser download chunk.",
    );
  });
});
