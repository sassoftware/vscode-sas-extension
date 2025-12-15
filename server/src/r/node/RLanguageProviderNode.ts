// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CancellationToken,
  Connection,
  DocumentHighlight,
  DocumentHighlightParams,
  Hover,
  HoverParams,
  MarkupKind,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { formatRDocAsMarkdown, getRDocumentation } from "../../r/documentation";
import { extractRCodes, getWordAtPosition } from "../../r/utils";
import { LanguageServiceProvider } from "../../sas/LanguageServiceProvider";

/**
 * Basic R Language Provider for handling R code embedded in SAS files.
 *
 * This provider extracts and processes R code from PROC RLANG blocks within SAS documents,
 * similar to how PyrightLanguageProvider handles Python code from PROC PYTHON blocks.
 *
 * Key Features:
 * - Extracts R code from PROC RLANG blocks
 * - Provides hooks for language service capabilities (hover, highlights, etc.)
 * - Integrates with the SAS language service provider
 *
 * Usage:
 * The provider is instantiated in server/src/node/server.ts and passed to runServer().
 * It integrates with the dispatch mechanism in server.ts to handle R-specific requests
 * when the cursor is within a PROC RLANG block.
 *
 * Example SAS code with PROC RLANG:
 * ```sas
 * proc rlang;
 * submit;
 *   # R code here
 *   x <- c(1, 2, 3, 4, 5)
 *   mean(x)
 * endsubmit;
 * run;
 * ```
 *
 * @remarks
 * This is a basic implementation that can be extended with full R language server
 * capabilities (e.g., using the R language server protocol) if needed in the future.
 */
export class RLanguageProviderNode {
  protected sasLspProvider?: (uri: string) => LanguageServiceProvider;
  protected connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public setSasLspProvider(
    provider: (uri: string) => LanguageServiceProvider,
  ): void {
    this.sasLspProvider = provider;
  }

  public addContentChange(doc: TextDocument): void {
    // Extract R code from the document
    if (!this.sasLspProvider) {
      return;
    }
    const languageService = this.sasLspProvider(doc.uri);
    const rDoc = extractRCodes(doc, languageService);

    // In a full implementation, this would update an R language server
    // For now, we just extract the R code for potential future use
    this.connection.console.log(`R code extracted: ${rDoc.length} characters`);
  }

  public async onHover(
    params: HoverParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: CancellationToken,
  ): Promise<Hover | null> {
    if (!this.sasLspProvider) {
      return null;
    }

    // Get the language service
    const uri = params.textDocument.uri;
    const languageService = this.sasLspProvider(uri);

    // Get the full document text from the language service model
    const lineCount = languageService.model.getLineCount();
    const fullText = languageService.model.getText({
      start: { line: 0, column: 0 },
      end: {
        line: lineCount - 1,
        column: languageService.model.getColumnCount(lineCount - 1),
      },
    });

    // Create a TextDocument for word extraction
    const doc = TextDocument.create(uri, "sas", 1, fullText);

    // Get the word at the cursor position
    const word = getWordAtPosition(doc, params.position);
    if (!word) {
      return null;
    }

    // Look up the documentation for the R symbol
    const docInfo = getRDocumentation(word);
    if (!docInfo) {
      return null;
    }

    // Format and return the hover information
    const markdown = formatRDocAsMarkdown(docInfo);
    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: markdown,
      },
    };
  }

  public async onDocumentHighlight(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    params: DocumentHighlightParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: CancellationToken,
  ): Promise<DocumentHighlight[] | null | undefined> {
    // Basic document highlight support
    return null;
  }

  public async onDidOpenTextDocument(doc: TextDocument): Promise<void> {
    if (!this.sasLspProvider) {
      return;
    }
    const languageService = this.sasLspProvider(doc.uri);
    const rDocContent = extractRCodes(doc, languageService);

    // Log that we've opened an R document
    this.connection.console.log(
      `Opened R document with ${rDocContent.length} characters`,
    );
  }

  public async onDidCloseTextDocument(doc: TextDocument): Promise<void> {
    // Clean up any resources
    this.connection.console.log(`Closed R document: ${doc.uri}`);
  }

  public async onShutdown(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: CancellationToken,
  ): Promise<void> {
    // Clean up resources on shutdown
  }
}
