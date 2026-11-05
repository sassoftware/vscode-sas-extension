// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Disposable, TextDocument, Uri, workspace } from "vscode";

import {
  CustomMacro,
  parseMacroDefinitions,
} from "../../../../server/src/sas/MacroDefinitionParser";

const MAX_WORKSPACE_FILES = 1000;
const MAX_FILE_SIZE = 1024 * 1024;
const UPDATE_DELAY_MS = 150;
const SAS_FILE_GLOB = "**/*.sas";
const EXCLUDE_GLOB = "**/{node_modules,.git,.yarn}/**";
const EXCLUDED_PATH = /\/(node_modules|\.git|\.yarn)\//;

/**
 * Supplies macros from the current workspace to the language server.
 * Parsed macros are cached per file. A full workspace scan only runs at
 * startup and when workspace folders change; afterwards only the SAS file or
 * document that changed is parsed again. Open documents are read from their
 * buffer (including unsaved edits), so renaming a macro removes its previous
 * name from the next snapshot.
 */
export class CustomMacroProvider implements Disposable {
  private macros: CustomMacro[] = [];
  private fileMacros = new Map<string, CustomMacro[]>();
  private readonly pendingUris = new Map<string, Uri>();
  private fullScanPending = false;
  private readonly disposables: Disposable[] = [];
  private updateTimer: ReturnType<typeof setTimeout> | undefined;
  private updating = false;
  private disposed = false;

  constructor(private readonly notifyChanged: () => void) {
    this.disposables.push(
      workspace.onDidChangeTextDocument(({ document }) =>
        this.scheduleDocumentRefresh(document),
      ),
      workspace.onDidOpenTextDocument((document) =>
        this.scheduleDocumentRefresh(document),
      ),
      workspace.onDidCloseTextDocument((document) =>
        this.scheduleDocumentRefresh(document),
      ),
      workspace.onDidChangeWorkspaceFolders(() => this.scheduleFullScan()),
    );
    const watcher = workspace.createFileSystemWatcher(SAS_FILE_GLOB);
    this.disposables.push(
      watcher,
      watcher.onDidCreate((uri) => this.scheduleRefresh(uri)),
      watcher.onDidChange((uri) => this.scheduleRefresh(uri)),
      watcher.onDidDelete((uri) => this.scheduleRefresh(uri)),
    );
  }

  dispose(): void {
    this.disposed = true;
    if (this.updateTimer !== undefined) {
      clearTimeout(this.updateTimer);
    }
    this.disposables.forEach((disposable) => disposable.dispose());
  }

  getCustomMacros(): { macros: CustomMacro[] } {
    return { macros: this.macros };
  }

  start(): void {
    this.scheduleFullScan(0);
  }

  private scheduleDocumentRefresh(document: TextDocument): void {
    if (document.languageId === "sas") {
      this.scheduleRefresh(document.uri);
    }
  }

  private scheduleRefresh(uri: Uri): void {
    this.pendingUris.set(uri.toString(), uri);
    this.scheduleUpdate();
  }

  private scheduleFullScan(delay = UPDATE_DELAY_MS): void {
    this.fullScanPending = true;
    this.scheduleUpdate(delay);
  }

  private scheduleUpdate(delay = UPDATE_DELAY_MS): void {
    if (this.disposed) {
      return;
    }
    if (this.updateTimer !== undefined) {
      clearTimeout(this.updateTimer);
    }
    this.updateTimer = setTimeout(() => {
      this.updateTimer = undefined;
      void this.update();
    }, delay);
  }

  private async update(): Promise<void> {
    if (this.updating) {
      // The running loop picks up the pending work.
      return;
    }
    this.updating = true;
    try {
      while (
        !this.disposed &&
        (this.fullScanPending || this.pendingUris.size > 0)
      ) {
        if (this.fullScanPending) {
          this.fullScanPending = false;
          this.pendingUris.clear();
          await this.scanWorkspace();
        } else {
          const uris = [...this.pendingUris.values()];
          this.pendingUris.clear();
          for (const uri of uris) {
            await this.refreshFile(uri);
          }
        }
      }
      if (!this.disposed) {
        this.publish();
      }
    } finally {
      this.updating = false;
    }
  }

  private async scanWorkspace(): Promise<void> {
    const files = await workspace.findFiles(
      SAS_FILE_GLOB,
      EXCLUDE_GLOB,
      MAX_WORKSPACE_FILES,
    );
    const fileUris = new Map(files.map((uri) => [uri.toString(), uri]));
    for (const document of workspace.textDocuments) {
      if (document.languageId === "sas" && !document.isClosed) {
        fileUris.set(document.uri.toString(), document.uri);
      }
    }
    const fileMacros = new Map<string, CustomMacro[]>();
    for (const [key, uri] of fileUris) {
      if (this.disposed) {
        return;
      }
      const macros = await this.readMacros(uri, this.getOpenDocument(key));
      if (macros) {
        fileMacros.set(key, macros);
      }
    }
    this.fileMacros = fileMacros;
  }

  private async refreshFile(uri: Uri): Promise<void> {
    const key = uri.toString();
    const document = this.getOpenDocument(key);
    if (!document && !this.isWorkspaceSasFile(uri)) {
      // Closed untitled/outside documents are no longer part of the snapshot.
      this.fileMacros.delete(key);
      return;
    }
    if (
      !this.fileMacros.has(key) &&
      this.fileMacros.size >= MAX_WORKSPACE_FILES
    ) {
      return;
    }
    const macros = await this.readMacros(uri, document);
    if (macros) {
      this.fileMacros.set(key, macros);
    } else {
      this.fileMacros.delete(key);
    }
  }

  private async readMacros(
    uri: Uri,
    document: TextDocument | undefined,
  ): Promise<CustomMacro[] | undefined> {
    try {
      let text: string;
      if (document) {
        text = document.getText();
        if (Buffer.byteLength(text, "utf8") > MAX_FILE_SIZE) {
          return undefined;
        }
      } else {
        if ((await workspace.fs.stat(uri)).size > MAX_FILE_SIZE) {
          return undefined;
        }
        text = new TextDecoder("utf-8").decode(
          await workspace.fs.readFile(uri),
        );
      }
      return parseMacroDefinitions(text, this.getSourceLabel(uri));
    } catch {
      // Missing or inaccessible files are dropped; they are retried on the
      // next change event.
      return undefined;
    }
  }

  private publish(): void {
    const macros = [...this.fileMacros.keys()]
      .sort()
      .flatMap((key) => this.fileMacros.get(key) ?? []);
    if (JSON.stringify(macros) !== JSON.stringify(this.macros)) {
      this.macros = macros;
      this.notifyChanged();
    }
  }

  private getOpenDocument(key: string): TextDocument | undefined {
    return workspace.textDocuments.find(
      (document) =>
        document.uri.toString() === key &&
        document.languageId === "sas" &&
        !document.isClosed,
    );
  }

  private isWorkspaceSasFile(uri: Uri): boolean {
    return (
      workspace.getWorkspaceFolder(uri) !== undefined &&
      /\.sas$/i.test(uri.path) &&
      !EXCLUDED_PATH.test(uri.path)
    );
  }

  private getSourceLabel(uri: Uri): string {
    return workspace.asRelativePath(uri, false).replace(/\\/g, "/");
  }
}
