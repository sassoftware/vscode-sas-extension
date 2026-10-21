// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface BrowserFileWriterMessages {
  unsupportedFilePicker: string;
  preparingExport: string;
  selectionCanceled: string;
  selectionFailed: string;
  chooseLocation: string;
  selectedFileUnavailable: string;
  permissionRevoked: string;
  writerNotOpen: string;
  abortFailed: string;
}

export function createBrowserFileWriterScript(
  nonce: string,
  messages: BrowserFileWriterMessages,
): string {
  const serializedMessages = JSON.stringify(messages)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return `          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const messages = ${serializedMessages};
            const writers = new Map();
            const fileHandles = new Map();
            let currentChoiceId;
            let currentFileName;
            const status = document.getElementById("status");
            const fileNameLabel = document.getElementById("file-name");
            const chooseFileButton = document.getElementById("choose-file");
            const cancelButton = document.getElementById("cancel");

            function showStatus(message) {
              status.textContent = message;
            }

            function acknowledge(requestId, error) {
              vscode.postMessage({
                type: "ack",
                requestId,
                ok: !error,
                error: error ? String(error) : undefined
              });
            }

            chooseFileButton.addEventListener("click", async () => {
              chooseFileButton.disabled = true;
              try {
                if (typeof window.showSaveFilePicker !== "function") {
                  reportUnsupportedFilePicker();
                  return;
                }
                const selection = window.showSaveFilePicker({
                  suggestedName: currentFileName
                });
                const fileHandle = await selection;
                const token = crypto.randomUUID();
                fileHandles.set(token, fileHandle);
                fileNameLabel.textContent = fileHandle.name;
                vscode.postMessage({
                  type: "destination",
                  choiceId: currentChoiceId,
                  kind: "local",
                  token,
                  fileName: fileHandle.name
                });
                showStatus(messages.preparingExport);
                cancelButton.hidden = true;
                chooseFileButton.hidden = true;
              } catch (error) {
                chooseFileButton.disabled = false;
                if (error.name === "AbortError") {
                  showStatus(messages.selectionCanceled);
                } else {
                  showStatus(
                    messages.selectionFailed.replace(
                      "{error}",
                      () => String(error)
                    )
                  );
                }
              }
            });

            function reportUnsupportedFilePicker() {
              const error = messages.unsupportedFilePicker;
              showStatus(error);
              vscode.postMessage({
                type: "destination",
                choiceId: currentChoiceId,
                kind: "unsupported",
                error
              });
            }

            document.getElementById("cancel").addEventListener("click", () => {
              vscode.postMessage({
                type: "destination",
                choiceId: currentChoiceId,
                kind: "cancel"
              });
            });

            window.addEventListener("message", async (event) => {
              const message = event.data;
              if (message.type === "choose") {
                currentChoiceId = message.choiceId;
                currentFileName = message.fileName;
                fileNameLabel.textContent = currentFileName;
                chooseFileButton.hidden = false;
                chooseFileButton.disabled = false;
                cancelButton.hidden = false;
                if (typeof window.showSaveFilePicker !== "function") {
                  reportUnsupportedFilePicker();
                  return;
                }
                showStatus(messages.chooseLocation);
                return;
              }

              if (message.type === "status") {
                showStatus(message.message);
                return;
              }

              let writer;
              try {
                if (message.type === "open") {
                  const fileHandle = fileHandles.get(message.token);
                  if (!fileHandle) {
                    throw new Error(messages.selectedFileUnavailable);
                  }
                  const permission = await fileHandle.queryPermission({ mode: "readwrite" });
                  if (permission !== "granted") {
                    throw new Error(messages.permissionRevoked);
                  }
                  writer = await fileHandle.createWritable();
                  writers.set(message.transferId, {
                    writer,
                    token: message.token
                  });
                } else if (message.type === "write") {
                  const transfer = writers.get(message.transferId);
                  if (!transfer) {
                    throw new Error(messages.writerNotOpen);
                  }
                  if (
                    !(message.data instanceof Uint8Array) ||
                    message.byteLength !== message.data.byteLength ||
                    message.data.byteLength === 0 ||
                    message.data.byteLength > 192 * 1024 ||
                    message.data.byteOffset !== 0 ||
                    message.data.buffer.byteLength !== message.data.byteLength
                  ) {
                    throw new Error("Invalid binary browser download chunk.");
                  }
                  await transfer.writer.write(message.data);
                } else if (message.type === "abort") {
                  const transfer = writers.get(message.transferId);
                  if (transfer) {
                    writers.delete(message.transferId);
                    fileHandles.delete(transfer.token);
                    await transfer.writer.abort();
                  }
                } else if (message.type === "finish") {
                  const transfer = writers.get(message.transferId);
                  if (!transfer) {
                    if (!message.commit) {
                      acknowledge(message.requestId);
                      return;
                    }
                    throw new Error(messages.writerNotOpen);
                  }
                  if (message.commit) {
                    await transfer.writer.close();
                  } else {
                    await transfer.writer.abort();
                  }
                  writers.delete(message.transferId);
                  fileHandles.delete(transfer.token);
                  writer = undefined;
                } else if (message.type === "discard") {
                  const transfer = [...writers.entries()].find(
                    ([, value]) => value.token === message.token
                  );
                  if (transfer) {
                    await transfer[1].writer.abort();
                    writers.delete(transfer[0]);
                  }
                  fileHandles.delete(message.token);
                }
                acknowledge(message.requestId);
              } catch (error) {
                let messageText = String(error);
                const transfer = writers.get(message.transferId);
                const openWriter = transfer ? transfer.writer : writer;
                if (openWriter) {
                  writers.delete(message.transferId);
                  try {
                    await openWriter.abort();
                  } catch (abortError) {
                    messageText +=
                      "; " +
                      messages.abortFailed.replace(
                        "{error}",
                        () => String(abortError)
                      );
                  }
                }
                if (transfer) {
                  fileHandles.delete(transfer.token);
                }
                acknowledge(message.requestId, messageText);
              }
            });

            vscode.postMessage({ type: "ready" });
          </script>`;
}
