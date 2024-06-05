// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CallHierarchyIncomingCallsParams,
  CallHierarchyItem,
  CallHierarchyOutgoingCall,
  CallHierarchyOutgoingCallsParams,
  CallHierarchyPrepareParams,
  CancellationToken,
  CompletionItem,
  CompletionList,
  CompletionParams,
  Connection,
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
  HoverParams,
  InitializeParams,
  InitializeResult,
  LSPAny,
  Location,
  PrepareRenameParams,
  ReferenceParams,
  RenameParams,
  ResultProgressReporter,
  SignatureHelpParams,
  SymbolInformation,
  TextDocumentPositionParams,
  WorkDoneProgressReporter,
  WorkspaceSymbol,
  WorkspaceSymbolParams,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { IPythonMode } from "pyright-internal-browser/dist/packages/pyright-internal/src/analyzer/sourceFile";
import { FileSystem } from "pyright-internal-browser/dist/packages/pyright-internal/src/common/fileSystem";
import { PyrightServer } from "pyright-internal-browser/dist/packages/pyright-internal/src/server";

import { LanguageServiceProvider } from "../../sas/LanguageServiceProvider";
import { extractPythonCodes } from "../utils";

export class PyrightLanguageProviderBrowser extends PyrightServer {
  protected sasLspProvider?: (uri: string) => LanguageServiceProvider;

  constructor(
    connection: Connection,
    maxWorkers: number,
    realFileSystem?: FileSystem,
  ) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    super({ ...connection, listen() {} } as LSPAny, maxWorkers, realFileSystem);
  }

  public setSasLspProvider(
    provider: (uri: string) => LanguageServiceProvider,
  ): void {
    this.sasLspProvider = provider;
  }

  public getClientCapabilities() {
    return this.client;
  }

  protected setupConnection(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    supportedCommands: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    supportedCodeActions: string[],
  ): void {
    return;
  }

  public onInitialized(): void {
    this.updateSettingsForAllWorkspaces();
    super.onInitialized();
  }

  public async initialize(
    params: InitializeParams,
    supportedCommands: string[],
    supportedCodeActions: string[],
  ): Promise<InitializeResult> {
    return super.initialize(params, supportedCommands, supportedCodeActions);
  }

  public addContentChange(doc: TextDocument): void {
    const languageService = this.sasLspProvider!(doc.uri);
    const pythonDoc = extractPythonCodes(doc, languageService);

    this.onDidChangeTextDocument({
      textDocument: doc,
      contentChanges: [{ text: pythonDoc }],
    });
  }

  public async onHover(params: HoverParams, token: CancellationToken) {
    return await super.onHover(params, token);
  }

  public async onDidOpenTextDocument(
    params: DidOpenTextDocumentParams,
    ipythonMode = IPythonMode.None,
  ) {
    const doc = TextDocument.create(
      params.textDocument.uri,
      "sas",
      params.textDocument.version,
      params.textDocument.text,
    );
    const languageService = this.sasLspProvider!(params.textDocument.uri);
    const pythonDocContent = extractPythonCodes(doc, languageService);
    const newParams: DidOpenTextDocumentParams = { ...params };
    newParams.textDocument = { ...params.textDocument };
    newParams.textDocument.languageId = "python";
    newParams.textDocument.text = pythonDocContent;
    await super.onDidOpenTextDocument(newParams, ipythonMode);
  }

  public async onDidCloseTextDocument(params: DidCloseTextDocumentParams) {
    await super.onDidCloseTextDocument(params);
  }

  public onDidChangeConfiguration(params: DidChangeConfigurationParams): void {
    super.onDidChangeConfiguration(params);
  }

  public async onDefinition(
    params: TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined | null> {
    return await super.onDefinition(params, token);
  }

  public async onDeclaration(
    params: TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<Declaration | DeclarationLink[] | undefined | null> {
    return await super.onDeclaration(params, token);
  }

  public async onTypeDefinition(
    params: TextDocumentPositionParams,
    token: CancellationToken,
  ): Promise<Definition | DefinitionLink[] | undefined | null> {
    return await super.onTypeDefinition(params, token);
  }

  public async onReferences(
    params: ReferenceParams,
    token: CancellationToken,
    workDoneReporter: WorkDoneProgressReporter,
    resultReporter: ResultProgressReporter<Location[]> | undefined,
  ): Promise<Location[] | null | undefined> {
    return await super.onReferences(
      params,
      token,
      workDoneReporter,
      resultReporter,
    );
  }

  public async onDocumentSymbol(
    params: DocumentSymbolParams,
    token: CancellationToken,
  ): Promise<DocumentSymbol[] | SymbolInformation[] | null | undefined> {
    return await super.onDocumentSymbol(params, token);
  }

  public async onWorkspaceSymbol(
    params: WorkspaceSymbolParams,
    token: CancellationToken,
    resultReporter: ResultProgressReporter<SymbolInformation[]> | undefined,
  ): Promise<SymbolInformation[] | WorkspaceSymbol[] | null | undefined> {
    return await super.onWorkspaceSymbol(params, token, resultReporter);
  }

  public async onDocumentHighlight(
    params: DocumentHighlightParams,
    token: CancellationToken,
  ): Promise<DocumentHighlight[] | null | undefined> {
    if (params.position.character < 0) {
      return null;
    }
    return await super.onDocumentHighlight(params, token);
  }

  public async onSignatureHelp(
    params: SignatureHelpParams,
    token: CancellationToken,
  ) {
    return await super.onSignatureHelp(params, token);
  }

  public async onCompletion(
    params: CompletionParams,
    token: CancellationToken,
  ): Promise<CompletionList | null> {
    return await super.onCompletion(params, token);
  }

  public async onCompletionResolve(
    params: CompletionItem,
    token: CancellationToken,
  ): Promise<CompletionItem> {
    return await super.onCompletionResolve(params, token);
  }

  public async onPrepareRenameRequest(
    params: PrepareRenameParams,
    token: CancellationToken,
  ) {
    return await super.onPrepareRenameRequest(params, token);
  }

  public async onRenameRequest(params: RenameParams, token: CancellationToken) {
    if (params.position.character < 0) {
      return null;
    }
    return await super.onRenameRequest(params, token);
  }

  public async onCallHierarchyPrepare(
    params: CallHierarchyPrepareParams,
    token: CancellationToken,
  ): Promise<CallHierarchyItem[] | null> {
    return await super.onCallHierarchyPrepare(params, token);
  }

  public async onCallHierarchyIncomingCalls(
    params: CallHierarchyIncomingCallsParams,
    token: CancellationToken,
  ) {
    return await super.onCallHierarchyIncomingCalls(params, token);
  }

  public async onCallHierarchyOutgoingCalls(
    params: CallHierarchyOutgoingCallsParams,
    token: CancellationToken,
  ): Promise<CallHierarchyOutgoingCall[] | null> {
    return await super.onCallHierarchyOutgoingCalls(params, token);
  }

  public onDidChangeWatchedFiles(params: DidChangeWatchedFilesParams): void {
    super.onDidChangeWatchedFiles(params);
  }

  public async onExecuteCommand(
    params: ExecuteCommandParams,
    token: CancellationToken,
    reporter: WorkDoneProgressReporter,
  ) {
    return await super.onExecuteCommand(params, token, reporter);
  }

  public async onShutdown(token: CancellationToken): Promise<void> {
    return await super.onShutdown(token);
  }
}
