// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CancellationToken,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  CompletionParams,
  Connection,
  Hover,
  HoverParams,
  MarkupKind,
  ParameterInformation,
  SignatureHelp,
  SignatureHelpParams,
  SignatureInformation,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { extractRCodes, getWordAtPosition } from "../../r/utils";
import { LanguageServiceProvider } from "../../sas/LanguageServiceProvider";
import { RHelpService } from "../RLanguageService";

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
  protected rHelpService: RHelpService;
  protected useRRuntime: boolean = false; // Default to false until we check
  protected currentRPath: string = "R";
  protected initialized: boolean = false;

  constructor(connection: Connection, rPath: string = "R") {
    this.connection = connection;
    this.currentRPath = rPath;
    this.rHelpService = new RHelpService(rPath);
  }

  public setSasLspProvider(
    provider: (uri: string) => LanguageServiceProvider,
  ): void {
    this.sasLspProvider = provider;
  }

  /**
   * Initialize the R language provider and check R availability
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      const available = await this.rHelpService.isRAvailable();
      this.useRRuntime = available;
      if (!available) {
        this.connection.console.warn(
          `R runtime not found at '${this.currentRPath}'. Hover support disabled. Please install R or set SAS.r.runtimePath in VS Code settings.`,
        );
      } else {
        this.connection.console.log(
          `R runtime detected at '${this.currentRPath}'. R hover support enabled.`,
        );
      }
    } catch (error) {
      this.useRRuntime = false;
      this.connection.console.warn(
        `Failed to check R runtime at '${this.currentRPath}': ${error}. Hover support disabled.`,
      );
    }

    this.initialized = true;
  }

  /**
   * Update the R runtime path. This will create a new RHelpService
   * and check if the new R runtime is available.
   */
  public async setRPath(rPath: string): Promise<void> {
    if (rPath === this.currentRPath) {
      return; // No change
    }

    this.currentRPath = rPath;
    this.rHelpService = new RHelpService(rPath);
    this.initialized = false; // Force re-initialization

    // Re-initialize with new R path
    await this.initialize();
  }

  public async onHover(
    params: HoverParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: CancellationToken,
  ): Promise<Hover | null> {
    // Ensure we're initialized
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.sasLspProvider || !this.useRRuntime) {
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

    // Extract R code blocks to search for local variable definitions
    const rCode = extractRCodes(doc, languageService);

    // Get help from R runtime or parse local definitions
    try {
      const rHelp = await this.rHelpService.getHelp(word, rCode);
      if (rHelp) {
        const markdown = this.rHelpService.formatAsMarkdown(rHelp);
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: markdown,
          },
        };
      }
    } catch (error) {
      this.connection.console.warn(
        `Failed to get R structure for '${word}': ${error}`,
      );
    }

    return null;
  }

  public async onSignatureHelp(
    params: SignatureHelpParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: CancellationToken,
  ): Promise<SignatureHelp | null> {
    if (!this.useRRuntime || !this.sasLspProvider) {
      return null;
    }

    try {
      const languageService = this.sasLspProvider(params.textDocument.uri);
      const lineCount = languageService.model.getLineCount();
      const fullText = languageService.model.getText({
        start: { line: 0, column: 0 },
        end: {
          line: lineCount - 1,
          column: languageService.model.getColumnCount(lineCount - 1),
        },
      });
      const doc = TextDocument.create(
        params.textDocument.uri,
        "sas",
        1,
        fullText,
      );

      // Find the function being called
      const line = doc.getText({
        start: { line: params.position.line, character: 0 },
        end: params.position,
      });

      // Look for function name before '('
      const match = line.match(/([a-zA-Z][a-zA-Z0-9._]*)\s*\([^)]*$/);
      if (!match) {
        return null;
      }

      const functionName = match[1];
      const sigHelp = await this.rHelpService.getSignatureHelp(functionName);

      if (sigHelp.parameters.length === 0) {
        return null;
      }

      const signature: SignatureInformation = {
        label: sigHelp.label,
        documentation: sigHelp.documentation
          ? {
              kind: MarkupKind.Markdown,
              value: sigHelp.documentation,
            }
          : undefined,
        parameters: sigHelp.parameters.map((param) => {
          const paramInfo: ParameterInformation = {
            label: param,
          };
          return paramInfo;
        }),
      };

      // Calculate active parameter based on comma count
      const beforeCursor = line.substring(line.lastIndexOf("(") + 1);
      const activeParameter = (beforeCursor.match(/,/g) || []).length;

      return {
        signatures: [signature],
        activeSignature: 0,
        activeParameter: Math.min(
          activeParameter,
          sigHelp.parameters.length - 1,
        ),
      };
    } catch (error) {
      this.connection.console.warn(`Failed to get signature help: ${error}`);
      return null;
    }
  }

  public async onCompletion(
    params: CompletionParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: CancellationToken,
  ): Promise<CompletionList | null> {
    if (!this.useRRuntime || !this.sasLspProvider) {
      return null;
    }

    try {
      const languageService = this.sasLspProvider(params.textDocument.uri);
      const lineCount = languageService.model.getLineCount();
      const fullText = languageService.model.getText({
        start: { line: 0, column: 0 },
        end: {
          line: lineCount - 1,
          column: languageService.model.getColumnCount(lineCount - 1),
        },
      });
      const doc = TextDocument.create(
        params.textDocument.uri,
        "sas",
        1,
        fullText,
      );
      const rDocContent = extractRCodes(doc, languageService);

      // Get the word being typed
      const word = getWordAtPosition(doc, params.position);
      if (!word || word.length < 1) {
        return null;
      }

      const completions = await this.rHelpService.getCompletions(
        word,
        rDocContent,
      );

      const items: CompletionItem[] = completions.map((comp) => ({
        label: comp.label,
        kind:
          comp.kind === "Function"
            ? CompletionItemKind.Function
            : CompletionItemKind.Variable,
        detail: comp.detail,
        data: {
          _languageService: "r",
          _uri: params.textDocument.uri,
        },
      }));

      return {
        isIncomplete: false,
        items,
      };
    } catch (error) {
      this.connection.console.warn(`Failed to get completions: ${error}`);
      return null;
    }
  }
}
