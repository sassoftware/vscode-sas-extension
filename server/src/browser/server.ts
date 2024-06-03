// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Connection,
  InitializeResult,
  SemanticTokensRequest,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from "vscode-languageserver/browser";

import { CompletionProvider } from "../sas/CompletionProvider";
import {
  LanguageServiceProvider,
  legend,
} from "../sas/LanguageServiceProvider";
import type { LibCompleteItem } from "../sas/SyntaxDataProvider";

/* browser specific setup code */

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection: Connection = createConnection(messageReader, messageWriter);

const servicePool: Record<string, LanguageServiceProvider> = {};
const documentPool: Record<string, TextDocument> = {};

let completionProvider: CompletionProvider;
let supportSASGetLibList = false;

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

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
      documentFormattingProvider: true,
      foldingRangeProvider: true,
      hoverProvider: true,
      completionProvider: {
        triggerCharacters: [" "],
        resolveProvider: true,
      },
      documentOnTypeFormattingProvider: {
        firstTriggerCharacter: "\n",
        moreTriggerCharacter: [";"],
      },
      signatureHelpProvider: {
        triggerCharacters: ["(", ","],
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
  return languageService.getDocumentSymbols();
});

connection.onFoldingRanges((params) => {
  const languageService = getLanguageService(params.textDocument.uri);
  return languageService.getFoldingRanges();
});

connection.onRequest("sas/getFoldingBlock", (params) => {
  const languageService = getLanguageService(params.textDocument.uri);
  const block = languageService.getFoldingBlock(
    params.position.line,
    params.position.col,
    params.strict ?? true,
    params.ignoreCustomBlock,
    params.ignoreGlobalBlock,
  );
  if (!block) {
    return undefined;
  } else {
    return { ...block, outerBlock: undefined, innerBlocks: undefined };
  }
});

connection.onDocumentOnTypeFormatting((params) => {
  const languageService = getLanguageService(params.textDocument.uri);
  return languageService.formatOnTypeProvider.getIndentEdit(
    params.position.line,
    params.position.character,
    params.ch,
    params.options.tabSize,
    params.options.insertSpaces,
  );
});

connection.onSignatureHelp((params) => {
  const languageService = getLanguageService(params.textDocument.uri);
  completionProvider = languageService.completionProvider;
  return completionProvider.getSignatureHelp(
    params.position,
    params.context?.activeSignatureHelp?.activeSignature,
  );
});

connection.onDocumentFormatting((params) => {
  const languageService = getLanguageService(params.textDocument.uri);
  return languageService.formatter.format({
    tabWidth: params.options.tabSize,
    useTabs: params.options.insertSpaces === false,
  });
});

documents.onDidChangeContent((event) => {
  if (servicePool[event.document.uri]) {
    documentPool[event.document.uri] = event.document;
    return;
  }
  servicePool[event.document.uri] = new LanguageServiceProvider(event.document);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();

function getLanguageService(uri: string) {
  if (documentPool[uri]) {
    // re-create LanguageServer if document changed
    servicePool[uri] = new LanguageServiceProvider(documentPool[uri]);

    if (supportSASGetLibList) {
      servicePool[uri].setLibService((libId, resolve) =>
        connection
          .sendRequest<LibCompleteItem[]>("sas/getLibList", { libId: libId })
          .then(resolve),
      );
    }
    delete documentPool[uri];
  }
  return servicePool[uri];
}
