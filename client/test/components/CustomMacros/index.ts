// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Disposable, Uri, workspace } from "vscode";

import {
  CustomMacro,
  parseMacroDefinitions,
} from "../../../../server/src/sas/MacroDefinitionParser";

const MAX_WORKSPACE_FILES = 1000;
const MAX_FILE_SIZE = 1024 * 1024;
const SCAN_DELAY_MS = 150;

/**
 * Supplies macros from the current workspace to the language server.
 * Rescanning uses open document text (including unsaved edits), so renaming a
 * macro removes its previous name from the next complete workspace snapshot.
 */
export class CustomMacroProvider implements Disposable {
  private macros: CustomMacro[] = [];
  private readonly disposables: Disposable[] = [];
  private scanTimer: ReturnType<typeof setTimeout> | undefined;
  private scanning = false;
  private scanRequested = false;
  private disposed = false;

  constructor(private readonly notifyChanged: () => void) {
    this.disposables.push(
      workspace.onDidChangeTextDocument(() => this.scheduleScan()),
      workspace.onDidSaveTextDocument(() => this.scheduleScan()),
      workspace.onDidOpenTextDocument(() => this.scheduleScan()),
      workspace.onDidCloseTextDocument(() => this.scheduleScan()),
      workspace.onDidChangeWorkspaceFolders(() => this.scheduleScan()),
    );
    const watcher = workspace.createFileSystemWatcher("**/*.sas");
    this.disposables.push(
      watcher,
      watcher.onDidCreate(() => this.scheduleScan()),
      watcher.onDidChange(() => this.scheduleScan()),
      watcher.onDidDelete(() => this.scheduleScan()),
    );
  }

  dispose(): void {
    this.disposed = true;
    if (this.scanTimer !== undefined) {
      clearTimeout(this.scanTimer);
    }
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  getCustomMacros(): { macros: CustomMacro[] } {
    return { macros: this.macros };
  }

  start(): void {
    this.scheduleScan(0);
  }

  private scheduleScan(delay = SCAN_DELAY_MS): void {
    if (this.disposed) {
      return;
    }
    if (this.scanTimer !== undefined) {
      clearTimeout(this.scanTimer);
    }
    this.scanTimer = setTimeout(() => {
      this.scanTimer = undefined;
      void this.scan();
    }, delay);
  }

  private async scan(): Promise<void> {
    if (this.scanning) {
      this.scanRequested = true;
      return;
    }
    this.scanning = true;
    try {
      do {
        this.scanRequested = false;
        await this.scanOnce();
      } while (this.scanRequested && !this.disposed);
    } finally {
      this.scanning = false;
    }
  }

  private async scanOnce(): Promise<void> {
    const files = await workspace.findFiles(
      "**/*.sas",
      "**/{node_modules,.git,.yarn}/**",
      MAX_WORKSPACE_FILES,
    );
    const openDocuments = new Map(
      workspace.textDocuments.map((document) => [
        document.uri.toString(),
        document,
      ]),
    );
    const fileUris = new Map(files.map((uri) => [uri.toString(), uri]));
    for (const document of openDocuments.values()) {
      if (document.languageId === "sas") {
        fileUris.set(document.uri.toString(), document.uri);
      }
    }
    const macros: CustomMacro[] = [];

    for (const uri of fileUris.values()) {
      if (this.disposed) {
        return;
      }
      try {
        const document = openDocuments.get(uri.toString());
        const text = document
          ? document.getText()
          : new TextDecoder("utf-8").decode(await workspace.fs.readFile(uri));
        if (Buffer.byteLength(text, "utf8") > MAX_FILE_SIZE) {
          continue;
        }
        macros.push(...parseMacroDefinitions(text, this.getSourceLabel(uri)));
      } catch {
        // Ignore inaccessible files; they will be retried on the next change.
      }
    }

    if (this.disposed) {
      return;
    }
    const next = JSON.stringify(macros);
    if (next !== JSON.stringify(this.macros)) {
      this.macros = macros;
      this.notifyChanged();
    }
  }

  private getSourceLabel(uri: Uri): string {
    return workspace.asRelativePath(uri, false).replace(/\\/g, "/");
  }
}
