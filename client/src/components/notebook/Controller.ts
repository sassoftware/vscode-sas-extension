// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import * as vscode from "vscode";
import type { BaseLanguageClient } from "vscode-languageclient";

import { LogLine, RunResult } from "../../connection";
import { getSession } from "../../connection";
import { SASCodeDocument } from "../utils/SASCodeDocument";
import { getCodeDocumentConstructionParameters } from "../utils/SASCodeDocumentHelper";
import { Deferred, deferred } from "../utils/deferred";
import { getNotebookCleanOutput } from "../utils/settings";
import { buildPythonError, processPythonLog } from "./PythonOutputProcessor";

export class NotebookController {
  readonly controllerId = "sas-notebook-controller-id";
  readonly notebookType = "sas-notebook";
  readonly label = "SAS Notebook";
  readonly supportedLanguages = ["sas", "sql", "python", "r"];

  private readonly _controller: vscode.NotebookController;
  private _executionOrder = 0;
  private _interrupted: Deferred<void> | undefined;
  private _executionQueue: Promise<void> = Promise.resolve();
  private _generation = 0;
  private _disposed = false;
  private _cancellation: vscode.CancellationTokenSource | undefined;
  private _running = false;

  constructor(private readonly client?: BaseLanguageClient) {
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
    this._disposed = true;
    this._interrupt();
    this._controller.dispose();
  }

  private _execute(cells: vscode.NotebookCell[]): Promise<void> {
    const generation = this._generation;
    const pending = this._executionQueue.then(async () => {
      if (this._disposed || generation !== this._generation) {
        return;
      }
      await this._executeCells(cells);
    });
    this._executionQueue = pending.catch(() => {});
    return pending;
  }

  private async _executeCells(cells: vscode.NotebookCell[]): Promise<void> {
    this._interrupted = undefined;
    const cancellation = new vscode.CancellationTokenSource();
    this._cancellation = cancellation;

    try {
      const session = getSession();
      await session.setup();
      for (const cell of cells) {
        await this._doExecution(cell);
      }
    } catch (err) {
      if (!this._disposed && !cancellation.token.isCancellationRequested) {
        vscode.window.showErrorMessage(
          err.response?.data ? JSON.stringify(err.response.data) : err.message,
        );
      }
    } finally {
      this._interrupted?.resolve();
      this._cancellation = undefined;
      cancellation.dispose();
    }
  }

  private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
    if (this._interrupted || this._disposed) {
      return;
    }

    const execution = this._controller.createNotebookCellExecution(cell);
    execution.executionOrder = ++this._executionOrder;
    execution.start(Date.now()); // Keep track of elapsed time to execute cell.
    execution.clearOutput();

    const session = getSession();
    let logs: LogLine[] = [];
    let collecting = false;
    const cellCancellation = execution.token?.onCancellationRequested(() =>
      this._interrupt(),
    );

    const parameters = getCodeDocumentConstructionParameters(cell.document);
    const codeDoc = new SASCodeDocument(parameters);

    const isPythonCell = cell.document.languageId === "python";
    const cleanOutput = getNotebookCleanOutput();

    try {
      const code =
        isPythonCell && cleanOutput
          ? await codeDoc.getWrappedNotebookCode(
              this.client,
              this._cancellation?.token,
            )
          : codeDoc.getWrappedCode();
      if (this.endInterruptedExecution(execution)) {
        return;
      }
      collecting = true;
      session.onExecutionLogFn = (logLines) => {
        if (collecting) {
          logs = logs.concat(logLines);
        }
      };
      this._running = true;
      let result: RunResult;
      try {
        result = await session.run(code, {
          baseDirectory: codeDoc.getBaseDirectory(),
        });
      } finally {
        this._running = false;
        collecting = false;
      }
      if (this.endInterruptedExecution(execution)) {
        return;
      }

      const outputItems: vscode.NotebookCellOutputItem[] = [];
      let success = true;

      if (isPythonCell && cleanOutput) {
        // Existing Python cleanup logic

        const pythonOutput = processPythonLog(
          logs,
          codeDoc.getPythonAutodisplayId(),
        );

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
          if (pythonOutput.outputLines.length > 0) {
            outputItems.push(
              vscode.NotebookCellOutputItem.json(
                pythonOutput.outputLines,
                "application/vnd.sas.compute.log.lines",
              ),
            );
          }
        }
      } else {
        // Existing SAS / SQL / R behavior
        this.appendRawOutput(result, logs, outputItems);
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
      if (this.endInterruptedExecution(execution)) {
        return;
      }
      execution.replaceOutput([
        new vscode.NotebookCellOutput([
          vscode.NotebookCellOutputItem.error(error),
        ]),
      ]);
      execution.end(false, Date.now());
      if (!this._interrupted) {
        this._interrupted = deferred();
      }
    } finally {
      collecting = false;
      cellCancellation?.dispose();
    }
    if (this._interrupted) {
      this._interrupted.resolve();
    }
  }

  private endInterruptedExecution(
    execution: vscode.NotebookCellExecution,
  ): boolean {
    const interruption = this._interrupted;
    if (!interruption && !this._disposed) {
      return false;
    }
    execution.end(undefined, Date.now());
    interruption?.resolve();
    return true;
  }

  private appendRawOutput(
    result: RunResult,
    logs: LogLine[],
    outputItems: vscode.NotebookCellOutputItem[],
  ): void {
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

  private _interrupt() {
    ++this._generation;
    this._cancellation?.cancel();
    if (this._interrupted) {
      return;
    }
    this._interrupted = deferred();
    const interruption = this._interrupted;
    if (!this._cancellation) {
      interruption.resolve();
      return;
    }
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: vscode.l10n.t("Cancelling job..."),
      },
      () => interruption.promise,
    );
    if (this._running) {
      const session = getSession();
      session.cancel?.();
    }
  }
}
