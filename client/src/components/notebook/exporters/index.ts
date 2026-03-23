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

  // Show QuickPick for export format selection
  const formatChoices = [
    {
      label: l10n.t("HTML"),
      description: l10n.t("Export as HTML file"),
      format: "html" as const,
      extension: "html",
    },
    {
      label: l10n.t("SAS Code"),
      description: l10n.t("Export as SAS program file"),
      format: "sas" as const,
      extension: "sas",
    },
  ];

  const formatChoice = await window.showQuickPick(formatChoices, {
    placeHolder: l10n.t("Select export format"),
    ignoreFocusOut: true,
  });

  if (!formatChoice) {
    return;
  }

  // Show save dialog with appropriate file extension
  const defaultFileName =
    path.basename(notebook.uri.path, ".sasnb") + `.${formatChoice.extension}`;

  const filters: { [name: string]: string[] } = {};
  filters[formatChoice.extension.toUpperCase()] = [formatChoice.extension];

  const uri = await window.showSaveDialog({
    filters,
    defaultUri: Uri.parse(defaultFileName),
  });

  if (!uri) {
    return;
  }

  try {
    let content: string | Uint8Array;

    // Generate content based on selected format
    switch (formatChoice.format) {
      case "html":
        content = await exportToHTML(notebook, client);
        await workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        break;
      case "sas":
        content = exportToSAS(notebook);
        await workspace.fs.writeFile(uri, new TextEncoder().encode(content));
        break;
    }

    window.showInformationMessage(
      l10n.t("Notebook exported to {0}", uri.fsPath),
    );
  } catch (error) {
    window.showErrorMessage(
      l10n.t("Failed to export notebook: {0}", error.message || error),
    );
  }
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

  await workspace.fs.writeFile(uri, new TextEncoder().encode(content));

  window.showInformationMessage(l10n.t("Saved to {0}", uri.fsPath));
};
