// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextDocumentContentProvider, Uri, l10n } from "vscode";

export const DEBUG_DOCUMENT_SCHEME = "sas-debug";

class DebugDocumentProvider implements TextDocumentContentProvider {
  private readonly documents = new Map<string, string>();
  private nextId = 0;

  public create(code: string): Uri {
    const uri = Uri.from({
      scheme: DEBUG_DOCUMENT_SCHEME,
      path: "/DATA Step Debugger.sas",
      query: String(this.nextId++),
    });
    this.documents.set(uri.toString(), code);
    return uri;
  }

  public remove(uri: Uri): void {
    this.documents.delete(uri.toString());
  }

  public provideTextDocumentContent(uri: Uri): string {
    const code = this.documents.get(uri.toString());
    if (code === undefined) {
      throw new Error(l10n.t("The debug document is no longer available."));
    }
    return code;
  }
}

export const debugDocumentProvider = new DebugDocumentProvider();
