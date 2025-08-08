// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, l10n, window, workspace } from "vscode";
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

export const saveOutput = async () => {
  const notebook = window.activeNotebookEditor?.notebook;
  const activeCell = window.activeNotebookEditor?.selection?.start;

  if (!notebook || activeCell === undefined) {
    return;
  }

  const cell = notebook.cellAt(activeCell);
  if (!cell) {
    return;
  }

  let odsItem = null;
  let logItem = null;

  for (const output of cell.outputs) {
    if (!odsItem) {
      odsItem = output.items.find(
        (item) => item.mime === "application/vnd.sas.ods.html5",
      );
    }
    if (!logItem) {
      logItem = output.items.find(
        (item) => item.mime === "application/vnd.sas.compute.log.lines",
      );
    }

    if (odsItem && logItem) {
      break;
    }
  }

  const choices: Array<{
    label: string;
    outputType: "html" | "log";
  }> = [];

  if (odsItem) {
    choices.push({
      label: l10n.t("Save ODS HTML"),
      outputType: "html",
    });
  }

  if (logItem) {
    choices.push({
      label: l10n.t("Save Log"),
      outputType: "log",
    });
  }

  const exportChoice = await window.showQuickPick(choices, {
    placeHolder: l10n.t("Choose output type to save"),
    ignoreFocusOut: true,
  });

  if (!exportChoice) {
    return;
  }

  let content = "";
  let fileExtension = "";
  let fileName = "";
  try {
    if (exportChoice.outputType === "html" && odsItem) {
      content = odsItem.data.toString();
      fileExtension = "html";
      fileName = `${path.basename(notebook.uri.path, ".sasnb")}_${l10n.t("output")}_${
        activeCell + 1
      }.html`;
    } else if (exportChoice.outputType === "log" && logItem) {
      const logs: Array<{ line: string; type: string }> = JSON.parse(
        logItem.data.toString(),
      );
      content = logs.map((log) => log.line).join("\n");
      fileExtension = "log";
      fileName = `${path.basename(notebook.uri.path, ".sasnb")}_${l10n.t("output")}_${
        activeCell + 1
      }.log`;
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

  await workspace.fs.writeFile(uri, Buffer.from(content));

  window.showInformationMessage(l10n.t("Saved to {0}", uri.fsPath));
};
