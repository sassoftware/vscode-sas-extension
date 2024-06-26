// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type {
  CallHierarchyIncomingCall,
  CallHierarchyIncomingCallsParams,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyPrepareParams,
  CancellationToken,
  CompletionItem,
  CompletionList,
  CompletionParams,
  Declaration,
  DeclarationLink,
  Definition,
  DefinitionLink,
  DidChangeConfigurationParams,
  DidChangeWatchedFilesParams,
  DidCloseTextDocumentParams,
  DidOpenTextDocumentParams,
  DocumentHighlight,
  DocumentHighlightParams,
  DocumentSymbol,
  DocumentSymbolParams,
  ExecuteCommandParams,
  Hover,
  HoverParams,
  InitializeParams,
  InitializeResult,
  Location,
  PrepareRenameParams,
  Range,
  ReferenceParams,
  RenameParams,
  ResultProgressReporter,
  SignatureHelp,
  SignatureHelpParams,
  SymbolInformation,
  TextDocument,
  TextDocumentPositionParams,
  WorkDoneProgressReporter,
  WorkspaceEdit,
  WorkspaceSymbol,
  WorkspaceSymbolParams,
} from "vscode-languageserver";

import type { IPythonMode } from "pyright-internal-node/dist/packages/pyright-internal/src/analyzer/sourceFile";
import type { ReadOnlyFileSystem } from "pyright-internal-node/dist/packages/pyright-internal/src/common/fileSystem";
import type { ClientCapabilities } from "pyright-internal-node/dist/packages/pyright-internal/src/common/languageServerInterface";
import type { DocumentRange } from "pyright-internal-node/dist/packages/pyright-internal/src/common/textRange";
import type { Uri } from "pyright-internal-node/dist/packages/pyright-internal/src/common/uri/uri";
import type { CollectionResult } from "pyright-internal-node/dist/packages/pyright-internal/src/languageService/documentSymbolCollector";
import type { ParseFileResults } from "pyright-internal-node/dist/packages/pyright-internal/src/parser/parser";

import { LanguageServiceProvider } from "../sas/LanguageServiceProvider";

export interface PyrightLanguageProvider {
  setSasLspProvider(provider: (uri: string) => LanguageServiceProvider): void;
  initialize(
    params: InitializeParams,
    supportedCommands: string[],
    supportedCodeActions: string[],
  ): Promise<InitializeResult>;
  onInitialized(): void;
  getClientCapabilities(): ClientCapabilities;
  onDidChangeConfiguration(params: DidChangeConfigurationParams): void;
  onDefinition(
    params: TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined | null>;
  onDeclaration(
    params: TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<Declaration | DeclarationLink[] | undefined | null>;
  onTypeDefinition(
    params: TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined | null>;
  onReferences(
    params: ReferenceParams,
    token: CancellationToken,
    workDoneReporter: WorkDoneProgressReporter,
    resultReporter: ResultProgressReporter<Location[]> | undefined,
    createDocumentRange?: (
      uri: Uri,
      result: CollectionResult,
      parseResults: ParseFileResults,
    ) => DocumentRange,
    convertToLocation?: (
      fs: ReadOnlyFileSystem,
      ranges: DocumentRange,
    ) => Location | undefined,
  ): Promise<Location[] | null | undefined>;
  onDocumentSymbol(
    params: DocumentSymbolParams,
    token: CancellationToken,
  ): Promise<DocumentSymbol[] | SymbolInformation[] | null | undefined>;
  onWorkspaceSymbol(
    params: WorkspaceSymbolParams,
    token: CancellationToken,
    resultReporter: ResultProgressReporter<SymbolInformation[]> | undefined,
  ): Promise<SymbolInformation[] | WorkspaceSymbol[] | null | undefined>;
  onHover(params: HoverParams, token: CancellationToken): Promise<Hover | null>;
  onDocumentHighlight(
    params: DocumentHighlightParams,
    token: CancellationToken,
  ): Promise<DocumentHighlight[] | null | undefined>;
  onSignatureHelp(
    params: SignatureHelpParams,
    token: CancellationToken,
  ): Promise<SignatureHelp | undefined | null>;
  onCompletion(
    params: CompletionParams,
    token: CancellationToken,
  ): Promise<CompletionList | null>;
  onCompletionResolve(
    params: CompletionItem,
    token: CancellationToken,
  ): Promise<CompletionItem>;
  onPrepareRenameRequest(
    params: PrepareRenameParams,
    token: CancellationToken,
  ): Promise<
    | Range
    | {
        range: Range;
        placeholder: string;
      }
    | null
  >;
  onRenameRequest(
    params: RenameParams,
    token: CancellationToken,
  ): Promise<WorkspaceEdit | null | undefined>;
  onCallHierarchyPrepare(
    params: CallHierarchyPrepareParams,
    token: CancellationToken,
  ): Promise<CallHierarchyItem[] | null>;
  onCallHierarchyIncomingCalls(
    params: CallHierarchyIncomingCallsParams,
    token: CancellationToken,
  ): Promise<CallHierarchyIncomingCall[] | null>;
  onCallHierarchyOutgoingCalls(
    params: CallHierarchyOutgoingCallsParams,
    token: CancellationToken,
  ): Promise<CallHierarchyOutgoingCall[] | null>;
  onDidOpenTextDocument(
    params: DidOpenTextDocumentParams,
    ipythonMode?: IPythonMode,
  ): Promise<void>;
  onDidCloseTextDocument(params: DidCloseTextDocumentParams): Promise<void>;
  onDidChangeWatchedFiles(params: DidChangeWatchedFilesParams): void;
  onShutdown(token: CancellationToken): Promise<void>;
  onExecuteCommand(
    params: ExecuteCommandParams,
    token: CancellationToken,
    reporter: WorkDoneProgressReporter,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any>;
  addContentChange(doc: TextDocument): void;
}
