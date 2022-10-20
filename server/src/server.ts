// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  TextDocuments,
  TextDocumentSyncKind,
  InitializeResult,
  SemanticTokensRequest,
  Connection,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { LanguageServiceProvider, legend } from "./sas/LanguageServiceProvider";
import { CompletionProvider } from "./sas/CompletionProvider";
import type { LibCompleteItem } from "./sas/SyntaxDataProvider";

const servicePool: Record<string, LanguageServiceProvider> = {};
const documentPool: Record<string, TextDocument> = {};

let completionProvider: CompletionProvider;
let connection: Connection;
let supportSASGetLibList = false;

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

export const init = (conn: Connection): void => {
  connection = conn;
  connection.onInitialize((params) => {
    if (
      params.initializationOptions &&
      params.initializationOptions.supportSASGetLibList
    ) {
      supportSASGetLibList = true;
    }
    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        semanticTokensProvider: {
          legend,
          full: true,
        },
        documentSymbolProvider: true,
        foldingRangeProvider: true,
        hoverProvider: true,
        completionProvider: {
          triggerCharacters: [" "],
          resolveProvider: true,
        },
      },
    };
    return result;
  });

  connection.onRequest(SemanticTokensRequest.type, (params) => {
    const languageService = getLanguageService(params.textDocument.uri);

    return { data: languageService.getTokens() };
  });

  connection.onHover((params) => {
    const languageService = getLanguageService(params.textDocument.uri);

    return languageService.completionProvider.getHelp(params.position);
  });

  connection.onCompletion((params) => {
    const languageService = getLanguageService(params.textDocument.uri);
    completionProvider = languageService.completionProvider;

    return completionProvider.getCompleteItems(params.position);
  });

  connection.onCompletionResolve((params) => {
    return completionProvider.getCompleteItemHelp(params);
  });

  connection.onDocumentSymbol((params) => {
    const languageService = getLanguageService(params.textDocument.uri);
    return languageService
      .getFoldingBlocks()
      .filter((symbol) => symbol.name !== "custom");
  });

  connection.onFoldingRanges((params) => {
    const languageService = getLanguageService(params.textDocument.uri);
    return languageService.getFoldingBlocks().map((block) => ({
      startLine: block.range.start.line,
      endLine: block.range.end.line,
    }));
  });

  documents.onDidChangeContent((event) => {
    if (servicePool[event.document.uri]) {
      documentPool[event.document.uri] = event.document;
      return;
    }
    servicePool[event.document.uri] = new LanguageServiceProvider(
      event.document
    );
  });

  // Make the text document manager listen on the connection
  // for open, change and close text document events
  documents.listen(connection);

  // Listen on the connection
  connection.listen();
};

function getLanguageService(uri: string) {
  if (documentPool[uri]) {
    // re-create LanguageServer if document changed
    servicePool[uri] = new LanguageServiceProvider(documentPool[uri]);

    if (supportSASGetLibList) {
      servicePool[uri].setLibService((libId, resolve) =>
        connection
          .sendRequest<LibCompleteItem[]>("sas/getLibList", { libId: libId })
          .then(resolve)
      );
    }
    delete documentPool[uri];
  }
  return servicePool[uri];
}
