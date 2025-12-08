// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CancellationToken,
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  CompletionParams,
  Connection,
  Definition,
  DefinitionLink,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  Hover,
  HoverParams,
  InitializeParams,
  InitializeResult,
  MarkupContent,
  MarkupKind,
  SignatureHelp,
  SignatureHelpParams,
  TextDocumentPositionParams,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { WebR } from "webr";

import { LanguageServiceProvider } from "../../sas/LanguageServiceProvider";
import { extractRCodes } from "../utils";

/**
 * R Language Provider for Browser environment using WebR.
 *
 * WebR allows R to run directly in the browser via WebAssembly,
 * providing basic language features like code completion and hover info.
 */
export class RLanguageProviderBrowser {
  protected sasLspProvider?: (uri: string) => LanguageServiceProvider;
  protected connection: Connection;
  protected webR?: WebR;
  protected rDocuments: Map<string, string> = new Map();
  protected isInitialized = false;

  // Common R functions for autocomplete
  private readonly commonRFunctions = [
    { label: "mean", detail: "mean(x, ...)", documentation: "Arithmetic Mean" },
    {
      label: "median",
      detail: "median(x, ...)",
      documentation: "Median Value",
    },
    {
      label: "sum",
      detail: "sum(...)",
      documentation: "Sum of Vector Elements",
    },
    {
      label: "length",
      detail: "length(x)",
      documentation: "Length of an Object",
    },
    { label: "print", detail: "print(x, ...)", documentation: "Print Values" },
    {
      label: "cat",
      detail: "cat(...)",
      documentation: "Concatenate and Print",
    },
    {
      label: "c",
      detail: "c(...)",
      documentation: "Combine Values into a Vector",
    },
    { label: "list", detail: "list(...)", documentation: "Create a List" },
    {
      label: "data.frame",
      detail: "data.frame(...)",
      documentation: "Create a Data Frame",
    },
    {
      label: "matrix",
      detail: "matrix(data, nrow, ncol)",
      documentation: "Create a Matrix",
    },
    {
      label: "plot",
      detail: "plot(x, y, ...)",
      documentation: "Generic X-Y Plotting",
    },
    {
      label: "head",
      detail: "head(x, n = 6)",
      documentation: "Return First Parts of an Object",
    },
    {
      label: "tail",
      detail: "tail(x, n = 6)",
      documentation: "Return Last Parts of an Object",
    },
    {
      label: "str",
      detail: "str(object, ...)",
      documentation: "Display Structure of an Object",
    },
    {
      label: "summary",
      detail: "summary(object, ...)",
      documentation: "Object Summary",
    },
    {
      label: "lm",
      detail: "lm(formula, data, ...)",
      documentation: "Fit Linear Model",
    },
    {
      label: "glm",
      detail: "glm(formula, family, data, ...)",
      documentation: "Fit Generalized Linear Model",
    },
    {
      label: "read.csv",
      detail: "read.csv(file, ...)",
      documentation: "Read CSV File",
    },
    {
      label: "write.csv",
      detail: "write.csv(x, file, ...)",
      documentation: "Write CSV File",
    },
  ];

  constructor(connection: Connection) {
    this.connection = connection;
  }

  public setSasLspProvider(
    provider: (uri: string) => LanguageServiceProvider,
  ): void {
    this.sasLspProvider = provider;
  }

  public async initialize(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: InitializeParams,
  ): Promise<InitializeResult> {
    return {
      capabilities: {
        hoverProvider: true,
        completionProvider: {
          triggerCharacters: [".", "$"],
        },
      },
    };
  }

  public onInitialized(): void {
    // Initialize WebR asynchronously
    this.initializeWebR().catch((err) => {
      this.connection.console.error(`Failed to initialize WebR: ${err}`);
    });
  }

  private async initializeWebR(): Promise<void> {
    try {
      this.connection.console.log("Initializing WebR...");
      this.webR = new WebR();
      await this.webR.init();
      this.isInitialized = true;
      this.connection.console.log("WebR initialized successfully");
    } catch (error) {
      this.connection.console.error(`WebR initialization failed: ${error}`);
      this.isInitialized = false;
    }
  }

  public addContentChange(doc: TextDocument): void {
    if (!this.sasLspProvider) {
      return;
    }

    const lsp = this.sasLspProvider(doc.uri);
    const rCode = extractRCodes(doc, lsp);

    if (rCode) {
      this.rDocuments.set(doc.uri, rCode);
    } else {
      this.rDocuments.delete(doc.uri);
    }
  }

  public async onDidOpenTextDocument(
    params: DidOpenTextDocumentParams,
  ): Promise<void> {
    const doc = TextDocument.create(
      params.textDocument.uri,
      params.textDocument.languageId,
      params.textDocument.version,
      params.textDocument.text,
    );
    this.addContentChange(doc);
  }

  public async onDidCloseTextDocument(
    params: DidCloseTextDocumentParams,
  ): Promise<void> {
    this.rDocuments.delete(params.textDocument.uri);
  }

  public async onHover(
    params: HoverParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<Hover | null> {
    if (!this.isInitialized || !this.webR) {
      return null;
    }

    const doc = this.getDocument(params.textDocument.uri);
    if (!doc) {
      return null;
    }

    // Get word at position
    const word = this.getWordAtPosition(
      doc,
      params.position.line,
      params.position.character,
    );
    if (!word) {
      return null;
    }

    try {
      // Try to get help for the function/object
      const helpResult = await this.webR.evalRString(
        `paste(capture.output(tryCatch(help('${word}'), error = function(e) '')), collapse = '\\n')`,
      );

      if (helpResult && helpResult.trim()) {
        const contents: MarkupContent = {
          kind: MarkupKind.Markdown,
          value: `\`\`\`r\n${word}\n\`\`\`\n\n${helpResult.substring(0, 500)}...`,
        };
        return { contents };
      }

      // Fallback: try to evaluate and show type
      const typeResult = await this.webR.evalRString(
        `tryCatch(class(${word}), error = function(e) '')`,
      );

      if (typeResult && typeResult.trim()) {
        const contents: MarkupContent = {
          kind: MarkupKind.Markdown,
          value: `\`\`\`r\n${word}\n\`\`\`\n\nType: ${typeResult}`,
        };
        return { contents };
      }
    } catch {
      // Silently fail - word might not be a valid R object
    }

    return null;
  }

  public async onCompletion(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: CompletionParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<CompletionList | null> {
    if (!this.isInitialized || !this.webR) {
      return null;
    }

    const items: CompletionItem[] = this.commonRFunctions.map((fn) => ({
      label: fn.label,
      kind: CompletionItemKind.Function,
      detail: fn.detail,
      documentation: fn.documentation,
    }));

    // Try to get installed packages for additional completions
    try {
      const packages = await this.webR.evalRString(
        `paste(.packages(), collapse = ',')`,
      );

      if (packages) {
        packages.split(",").forEach((pkg: string) => {
          if (pkg.trim()) {
            items.push({
              label: pkg.trim(),
              kind: CompletionItemKind.Module,
              detail: "Package",
            });
          }
        });
      }
    } catch {
      // Silently fail - completions still work with common functions
    }

    return {
      isIncomplete: false,
      items,
    };
  }

  public async onCompletionResolve(
    item: CompletionItem,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<CompletionItem> {
    return item;
  }

  public async onSignatureHelp(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: SignatureHelpParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<SignatureHelp | null> {
    return null;
  }

  public async onDefinition(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: TextDocumentPositionParams,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | null> {
    return null;
  }

  public async onShutdown(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken,
  ): Promise<void> {
    if (this.webR) {
      try {
        await this.webR.close();
      } catch (error) {
        this.connection.console.error(`Error closing WebR: ${error}`);
      }
    }
    this.rDocuments.clear();
  }

  private getDocument(uri: string): string | undefined {
    return this.rDocuments.get(uri);
  }

  private getWordAtPosition(
    doc: string,
    line: number,
    character: number,
  ): string | null {
    const lines = doc.split("\n");
    if (line >= lines.length) {
      return null;
    }

    const lineText = lines[line];
    if (character >= lineText.length) {
      return null;
    }

    // Find word boundaries
    let start = character;
    let end = character;

    // Move start back to beginning of word
    while (start > 0 && /[a-zA-Z0-9_.]/.test(lineText[start - 1])) {
      start--;
    }

    // Move end forward to end of word
    while (end < lineText.length && /[a-zA-Z0-9_.]/.test(lineText[end])) {
      end++;
    }

    const word = lineText.substring(start, end);
    return word.length > 0 ? word : null;
  }
}
