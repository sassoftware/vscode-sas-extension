// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, window, workspace } from "vscode";
import * as vscode from "vscode";
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

export const exportNotebookCell = async () => {
  const notebook = window.activeNotebookEditor?.notebook;
  const activeCell = window.activeNotebookEditor?.selection?.start;

  if (!notebook || activeCell === undefined) {
    return;
  }

  const cell = notebook.cellAt(activeCell);
  if (!cell) {
    return;
  }

  if (cell.outputs.length === 0) {
    window.showWarningMessage(
      vscode.l10n.t("Selected cell has no output to download."),
    );
    return;
  }

  // Check what types of output are available
  const hasOdsOutput = cell.outputs.some((output) =>
    output.items.some((item) => item.mime === "application/vnd.sas.ods.html5"),
  );
  const hasLogOutput = cell.outputs.some((output) =>
    output.items.some(
      (item) => item.mime === "application/vnd.sas.compute.log.lines",
    ),
  );

  if (!hasOdsOutput && !hasLogOutput) {
    window.showWarningMessage(
      vscode.l10n.t("Selected cell has no SAS output to download."),
    );
    return;
  }

  // Build choices based on available output types
  const choices: Array<{
    label: string;
    description: string;
    detail: string;
    outputType: "html" | "log";
  }> = [];

  if (hasOdsOutput) {
    choices.push({
      label: "Download as HTML",
      description: "Save ODS HTML output",
      detail: "Raw HTML file with tables, charts, and visualizations",
      outputType: "html",
    });
  }

  if (hasLogOutput) {
    choices.push({
      label: "Download as Log",
      description: "Save execution log",
      detail: "Text file with SAS log messages",
      outputType: "log",
    });
  }

  const exportChoice = await window.showQuickPick(choices, {
    placeHolder: "Choose output type to download",
    ignoreFocusOut: true,
  });

  if (!exportChoice) {
    return;
  }

  // Get the appropriate output data
  let content = "";
  let fileExtension = "";
  let fileName = "";

  if (exportChoice.outputType === "html") {
    // Find and extract ODS HTML content
    for (const output of cell.outputs) {
      const odsItem = output.items.find(
        (item) => item.mime === "application/vnd.sas.ods.html5",
      );
      if (odsItem) {
        content = odsItem.data.toString();
        break;
      }
    }
    fileExtension = "html";
    fileName = `${path.basename(notebook.uri.path, ".sasnb")}_cell_${
      activeCell + 1
    }_output.html`;
  } else if (exportChoice.outputType === "log") {
    // Find and extract log content
    for (const output of cell.outputs) {
      const logItem = output.items.find(
        (item) => item.mime === "application/vnd.sas.compute.log.lines",
      );
      if (logItem) {
        const logs: Array<{ line: string; type: string }> = JSON.parse(
          logItem.data.toString(),
        );
        content = logs.map((log) => log.line).join("\n");
        break;
      }
    }
    fileExtension = "log";
    fileName = `${path.basename(notebook.uri.path, ".sasnb")}_cell_${
      activeCell + 1
    }_output.log`;
  }

  if (!content) {
    window.showErrorMessage(vscode.l10n.t("Failed to extract output content."));
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

  window.showInformationMessage(
    vscode.l10n.t("Output downloaded to {0}", uri.fsPath),
  );
};
