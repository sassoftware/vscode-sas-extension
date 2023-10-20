// Copyright © 2022, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Connection,
  DidChangeConfigurationNotification,
  InitializeResult,
  SemanticTokensRequest,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { CompletionProvider } from "./sas/CompletionProvider";
import { LanguageServiceProvider, legend } from "./sas/LanguageServiceProvider";
import type { LibCompleteItem } from "./sas/SyntaxDataProvider";

const servicePool: Record<string, LanguageServiceProvider> = {};
const documentPool: Record<string, TextDocument> = {};

let completionProvider: CompletionProvider;
let connection: Connection;
let supportSASGetLibList = false;

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Add settings wanted to listen here, onInitialized(), and onDidChangeConfiguration()
interface ListenedSettings {
  editor?: {
    tabSize?: number;
    insertSpaces?: boolean;
  };
}
const cachedConfigurations: ListenedSettings = {};

// Default setting values
const DEFAULT_TAB_SIZE = 4;
const DEFAULT_INSERT_SPACES = true;

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
        documentOnTypeFormattingProvider: {
          firstTriggerCharacter: "\n",
          moreTriggerCharacter: [";"],
        },
      },
    };
    return result;
  });

  connection.onInitialized(() => {
    // Initialize listened settings
    connection.client.register(DidChangeConfigurationNotification.type, {
      section: ["editor"],
    });
    connection.workspace
      .getConfiguration([
        {
          section: "editor",
        },
      ])
      .then((data) => {
        cachedConfigurations.editor = data[0];
      });
  });

  connection.onDidChangeConfiguration((params) => {
    cachedConfigurations.editor = params.settings.editor;
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
      params.line,
      params.col,
      true,
      false,
    );
    return { ...block, outerBlock: undefined, innerBlocks: undefined };
  });

  connection.onDocumentOnTypeFormatting((params) => {
    const tabSize: number =
      cachedConfigurations.editor?.tabSize ?? DEFAULT_TAB_SIZE;
    const useSpace: boolean =
      cachedConfigurations.editor?.insertSpaces ?? DEFAULT_INSERT_SPACES;
    const languageService = getLanguageService(params.textDocument.uri);
    return languageService.formatOnTypeProvider.getIndentEdit(
      params.position.line,
      params.position.character,
      params.ch,
      tabSize,
      useSpace,
    );
  });

  documents.onDidChangeContent((event) => {
    if (servicePool[event.document.uri]) {
      documentPool[event.document.uri] = event.document;
      return;
    }
    servicePool[event.document.uri] = new LanguageServiceProvider(
      event.document,
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
          .then(resolve),
      );
    }
    delete documentPool[uri];
  }
  return servicePool[uri];
}
