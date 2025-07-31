import * as vscode from "vscode";

import { MagicCommandProcessor } from "./MagicCommandProcessor";

export class NotebookMagicLanguageSwitcher {
  private _disposables: vscode.Disposable[] = [];
  private _cellChangeMap = new Map<string, NodeJS.Timeout>();

  constructor() {
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument(
        this._onDidChangeTextDocument,
        this,
      ),
    );
  }

  dispose(): void {
    this._disposables.forEach((d) => d.dispose());
    this._cellChangeMap.forEach((timeout) => clearTimeout(timeout));
    this._cellChangeMap.clear();
  }

  private _onDidChangeTextDocument(
    event: vscode.TextDocumentChangeEvent,
  ): void {
    if (event.document.uri.scheme !== "vscode-notebook-cell") {
      return;
    }

    const notebook = vscode.workspace.notebookDocuments.find((nb) =>
      nb.getCells().some((cell) => cell.document === event.document),
    );

    if (!notebook) {
      return;
    }

    const cell = notebook.getCells().find((c) => c.document === event.document);
    if (!cell) {
      return;
    }

    // Debouncing so changes don't rapidly happen.
    const cellId = cell.document.uri.toString();
    const existingTimeout = this._cellChangeMap.get(cellId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this._checkAndSwitchLanguage(cell);
      this._cellChangeMap.delete(cellId);
    }, 500);

    this._cellChangeMap.set(cellId, timeout);
  }

  private async _checkAndSwitchLanguage(
    cell: vscode.NotebookCell,
  ): Promise<void> {
    const content = cell.document.getText();
    const currentLanguage = cell.document.languageId;

    const magicResult = MagicCommandProcessor.process(content, currentLanguage);

    if (!magicResult.hasMagic || magicResult.language === currentLanguage) {
      return;
    }

    const cellKind =
      magicResult.language === "markdown"
        ? vscode.NotebookCellKind.Markup
        : vscode.NotebookCellKind.Code;

    await this._replaceCell(
      cell,
      magicResult.language,
      magicResult.code,
      cellKind,
    );
  }

  private async _replaceCell(
    cell: vscode.NotebookCell,
    newLanguage: string,
    newCode: string,
    cellKind: vscode.NotebookCellKind,
  ): Promise<void> {
    try {
      const notebook = cell.notebook;
      const cellIndex = notebook.getCells().indexOf(cell);

      if (cellIndex === -1) {
        return;
      }

      const newCellData = new vscode.NotebookCellData(
        cellKind,
        newCode,
        newLanguage,
      );

      const edit = new vscode.WorkspaceEdit();
      edit.set(notebook.uri, [
        vscode.NotebookEdit.replaceCells(
          new vscode.NotebookRange(cellIndex, cellIndex + 1),
          [newCellData],
        ),
      ]);

      await vscode.workspace.applyEdit(edit);
    } catch (error) {
      console.error("Cell replacement failed:", error);
    }
  }
}
