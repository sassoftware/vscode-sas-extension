// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as vscode from "vscode";

import { LogLine } from "../../connection";
import { getSession } from "../../connection";
import { SASCodeDocument } from "../utils/SASCodeDocument";
import { getCodeDocumentConstructionParameters } from "../utils/SASCodeDocumentHelper";
import { Deferred, deferred } from "../utils/deferred";
import { buildPythonError, processPythonLog } from "./PythonOutputProcessor";

/**
 * Wraps a bare HTML fragment (e.g. from `_repr_html_()`) in a minimal HTML
 * document
 *
 * sklearn models embed their own `<style>` tags and render correctly as-is.
 */
function wrapHtmlFragment(fragment: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
body {
  margin: 0;
  padding: 4px;
  background: transparent;
  color: var(--vscode-editor-foreground);
  font-size: var(--vscode-editor-font-size);
  font-family: var(--vscode-editor-font-family);
}

table {
  border-collapse: collapse;
  border-spacing: 0;
  border: none;
  color: var(--vscode-editor-foreground);
  font-size: var(--vscode-editor-font-size);
  table-layout: fixed;
  /* outputarea/base.css: margin-left/right 0 for output-area tables */
  margin-left: 0;
  margin-right: 0;
  margin-bottom: 1em;
}

thead {
  border-bottom: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  vertical-align: bottom;
}

td,
th,
tr {
  vertical-align: middle;
  padding: 0.5em;
  line-height: normal;
  white-space: normal;
  max-width: none;
  border: none;
  text-align: right;
}

th {
  font-weight: bold;
}

tbody tr:nth-child(odd) {
  background: transparent;
}

tbody tr:nth-child(even) {
  background: var(
    --vscode-list-inactiveSelectionBackground,
    rgba(128, 128, 128, 0.08)
  );
}

tbody tr:hover {
  background: var(--vscode-list-hoverBackground, rgba(128, 128, 128, 0.12));
}
</style>
</head>
<body>${fragment}</body>
</html>`;
}

export class NotebookController {
  readonly controllerId = "sas-notebook-controller-id";
  readonly notebookType = "sas-notebook";
  readonly label = "SAS Notebook";
  readonly supportedLanguages = ["sas", "sql", "python", "r"];

  private readonly _controller: vscode.NotebookController;
  private _executionOrder = 0;
  private _interrupted: Deferred<void> | undefined;

  constructor() {
    this._controller = vscode.notebooks.createNotebookController(
      this.controllerId,
      this.notebookType,
      this.label,
    );

    this._controller.supportedLanguages = this.supportedLanguages;
    this._controller.supportsExecutionOrder = true;
    this._controller.executeHandler = this._execute.bind(this);
    this._controller.interruptHandler = this._interrupt.bind(this);
  }

  dispose(): void {
    this._controller.dispose();
  }

  private async _execute(cells: vscode.NotebookCell[]): Promise<void> {
    this._interrupted = undefined;

    try {
      const session = getSession();
      await session.setup();
    } catch (err) {
      vscode.window.showErrorMessage(
        err.response?.data ? JSON.stringify(err.response.data) : err.message,
      );
      return;
    }

    for (const cell of cells) {
      await this._doExecution(cell);
    }
  }

  private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
    if (this._interrupted) {
      return;
    }

    const execution = this._controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this._executionOrder;
    execution.start(Date.now()); // Keep track of elapsed time to execute cell.
    execution.clearOutput();

    const session = getSession();
    let logs: LogLine[] = [];
    session.onExecutionLogFn = (logLines) => {
      logs = logs.concat(logLines);
    };

    const parameters = getCodeDocumentConstructionParameters(cell.document);
    const codeDoc = new SASCodeDocument(parameters);

    const isPythonCell = cell.document.languageId === "python";

    try {
      const result = await session.run(codeDoc.getWrappedCode(), {
        baseDirectory: codeDoc.getBaseDirectory(),
      });

      const outputItems: vscode.NotebookCellOutputItem[] = [];
      let success = true;

      if (isPythonCell) {
        const pythonOutput = processPythonLog(logs);

        // ODS output (from SAS.show(), SAS.pyplot(), etc.) is always shown
        if (result.html5?.length) {
          outputItems.push(
            vscode.NotebookCellOutputItem.text(
              result.html5,
              "application/vnd.sas.ods.html5",
            ),
          );
        }

        if (pythonOutput.isPythonError) {
          success = false;
          // Use VS Code's built-in error renderer (application/vnd.code.notebook.error)
          // with ANSI-coded stack
          const pyErr = buildPythonError(pythonOutput.errorLines);
          outputItems.push(
            vscode.NotebookCellOutputItem.error({
              name: pyErr.name,
              message: pyErr.message,
              stack: pyErr.stack,
            }),
          );
        } else if (pythonOutput.isSASError) {
          success = false;
          outputItems.push(
            vscode.NotebookCellOutputItem.json(
              pythonOutput.outputLines,
              "application/vnd.sas.compute.log.lines",
            ),
          );
        } else {
          // Show _repr_html_() output (DataFrames, sklearn models, etc.)
          if (pythonOutput.htmlRepr) {
            outputItems.push(
              vscode.NotebookCellOutputItem.text(
                wrapHtmlFragment(pythonOutput.htmlRepr),
                "application/vnd.sas.ods.html5",
              ),
            );
          }
          // Show any remaining plain-text stdout
          if (pythonOutput.outputLines.length > 0) {
            outputItems.push(
              vscode.NotebookCellOutputItem.json(
                pythonOutput.outputLines,
                "application/vnd.sas.compute.log.lines",
              ),
            );
          }
        }
        // When success === true and no outputItems were added (beyond HTML),
        // the cell renders with just the green checkmark – no log noise.
      } else {
        // Original behavior for SAS / SQL / R cells
        if (result.html5?.length) {
          outputItems.push(
            vscode.NotebookCellOutputItem.text(
              result.html5,
              "application/vnd.sas.ods.html5",
            ),
          );
        }
        outputItems.push(
          vscode.NotebookCellOutputItem.json(
            logs,
            "application/vnd.sas.compute.log.lines",
          ),
        );
      }

      // Only create a NotebookCellOutput when there is something to show.
      // Passing an empty array to replaceOutput removes all output and avoids
      // the blank gap that VS Code renders when a cell has an empty output item.
      if (outputItems.length > 0) {
        execution.replaceOutput([new vscode.NotebookCellOutput(outputItems)]);
      } else {
        execution.replaceOutput([]);
      }
      execution.end(success, Date.now());
    } catch (error) {
      execution.replaceOutput([
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.error(error),
        ]),
      ]);
      execution.end(false, Date.now());
      if (!this._interrupted) {
        this._interrupted = deferred();
      }
    }
    if (this._interrupted) {
      this._interrupted.resolve();
    }
  }

  private _interrupt() {
    if (this._interrupted) {
      return;
    }
    this._interrupted = deferred();
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("Cancelling job..."),
      },
      () => this._interrupted.promise,
    );
    const session = getSession();
    session.cancel?.();
  }
}
