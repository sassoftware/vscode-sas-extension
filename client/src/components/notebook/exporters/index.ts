// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { NotebookDocument, Uri, l10n, window, workspace } from "vscode";
import type { LanguageClient } from "vscode-languageclient/node";

import path from "path";

import { exportToHTML } from "./toHTML";
import { exportToSAS } from "./toSAS";

export const exportNotebook = async (client: LanguageClient) => {
  const notebook = window.activeNotebookEditor?.notebook;

  if (!notebook) {
    return;
  }

  const uri = await window.showSaveDialog({
    filters: { SAS: ["sas"], HTML: ["html"] },
    defaultUri: Uri.parse(path.basename(notebook.uri.path, ".sasnb")),
  });

  if (!uri) {
    return;
  }

  const content = uri.path.endsWith(".html")
    ? await exportToHTML(notebook, client)
    : exportToSAS(notebook);

  workspace.fs.writeFile(uri, Buffer.from(content));
};

let timesOutputSaved = 0;

export const saveOutputFromRenderer = async (
  message: {
    outputType: "html" | "log";
    content: unknown;
    mime: string;
    cellIndex?: number;
  },
  notebook: NotebookDocument,
) => {
  const { outputType, content } = message;

  let fileContent = "";
  let fileExtension = "";
  let fileName = "";

  try {
    if (outputType === "html" && typeof content === "string") {
      fileContent = content;
      fileExtension = "html";
      fileName = `${path.basename(notebook.uri.path, ".sasnb")}_${l10n.t("output")}_${timesOutputSaved + 1}.html`;
    } else if (outputType === "log" && Array.isArray(content)) {
      fileContent = content.map((log: { line: string }) => log.line).join("\n");
      fileExtension = "log";
      fileName = `${path.basename(notebook.uri.path, ".sasnb")}_${l10n.t("output")}_${timesOutputSaved + 1}.log`;
    }
  } catch (error) {
    window.showErrorMessage(
      l10n.t("Failed to extract output content." + error),
    );
    return;
  }

  const filters: { [name: string]: string[] } = {};
  filters[fileExtension.toUpperCase()] = [fileExtension];

  const uri = await window.showSaveDialog({
    filters,
    defaultUri: Uri.parse(fileName),
  });

  if (!uri) {
    return;
  }

  await workspace.fs.writeFile(uri, Buffer.from(fileContent));
  timesOutputSaved++;

  window.showInformationMessage(l10n.t("Saved to {0}", uri.fsPath));
};
