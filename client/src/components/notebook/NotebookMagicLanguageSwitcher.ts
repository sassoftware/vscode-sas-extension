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

    // Debouncing so changes dont rapidly happen.
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

    // Handle markdown separately since it requires cell level change.
    if (magicResult.language === "markdown") {
      await this._convertToMarkdownCell(cell, magicResult.code);
    } else {
      await this._switchCellLanguage(
        cell,
        magicResult.language,
        magicResult.code,
      );
    }
  }

  private async _switchCellLanguage(
    cell: vscode.NotebookCell,
    newLanguage: string,
    newCode: string,
  ): Promise<void> {
    try {
      const notebook = cell.notebook;
      const cellIndex = notebook.getCells().indexOf(cell);

      if (cellIndex === -1) {
        return;
      }

      const edit = new vscode.WorkspaceEdit();

      const fullRange = new vscode.Range(0, 0, cell.document.lineCount, 0);
      edit.replace(cell.document.uri, fullRange, newCode);

      await vscode.workspace.applyEdit(edit);

      // Then change the language using VS Code's command
      await vscode.commands.executeCommand("notebook.cell.changeLanguage", {
        notebookEditor: { notebookUri: notebook.uri },
        cell,
        language: newLanguage,
      });

      // Force a refresh to update the language indicator
      await vscode.commands.executeCommand("notebook.cell.quitEdit");
      await vscode.commands.executeCommand("notebook.focusNextEditor");
      await vscode.commands.executeCommand("notebook.focusPreviousEditor");
    } catch (error) {
      console.error("Failed to switch cell language:", error);
    }
  }

  private async _convertToMarkdownCell(
    cell: vscode.NotebookCell,
    markdownContent: string,
  ): Promise<void> {
    try {
      const notebook = cell.notebook;
      const cellIndex = notebook.getCells().indexOf(cell);

      if (cellIndex === -1) {
        return;
      }

      const edit = new vscode.WorkspaceEdit();

      const markdownCellData = new vscode.NotebookCellData(
        vscode.NotebookCellKind.Markup,
        markdownContent,
        "markdown",
      );

      edit.set(notebook.uri, [
        vscode.NotebookEdit.replaceCells(
          new vscode.NotebookRange(cellIndex, cellIndex + 1),
          [markdownCellData],
        ),
      ]);

      await vscode.workspace.applyEdit(edit);
    } catch (error) {
      console.error("Failed to convert to markdown cell:", error);
    }
  }
}
