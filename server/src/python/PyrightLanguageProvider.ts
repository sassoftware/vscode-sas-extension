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

import { IPythonMode } from "pyright-internal-lsp/dist/packages/pyright-internal/src/analyzer/sourceFile";
import {
  FileSystem,
  ReadOnlyFileSystem,
} from "pyright-internal-lsp/dist/packages/pyright-internal/src/common/fileSystem";
import { DocumentRange } from "pyright-internal-lsp/dist/packages/pyright-internal/src/common/textRange";
import { Uri } from "pyright-internal-lsp/dist/packages/pyright-internal/src/common/uri/uri";
import { ClientCapabilities } from "pyright-internal-lsp/dist/packages/pyright-internal/src/languageServerBase";
import { CollectionResult } from "pyright-internal-lsp/dist/packages/pyright-internal/src/languageService/documentSymbolCollector";
import { ParseFileResults } from "pyright-internal-lsp/dist/packages/pyright-internal/src/parser/parser";
import { PyrightServer } from "pyright-internal-lsp/dist/packages/pyright-internal/src/server";

import { CodeZoneManager } from "../sas/CodeZoneManager";
import { LanguageServiceProvider } from "../sas/LanguageServiceProvider";

export class PyrightLanguageProvider extends PyrightServer {
  protected docChangeRecords: Record<string, TextDocument>;
  protected sasLspProvider: (uri: string) => LanguageServiceProvider;

  constructor(
    connection: Connection,
    maxWorkers: number,
    sasLspProvider: (uri: string) => LanguageServiceProvider,
    realFileSystem?: FileSystem,
  ) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    super({ ...connection, listen() {} } as LSPAny, maxWorkers, realFileSystem);
    this.sasLspProvider = sasLspProvider;
    this.docChangeRecords = {};
    this.startDocSynchronizer();
  }

  public getClientCapabilities(): ClientCapabilities {
    return this.client;
  }

  protected startDocSynchronizer() {
    setInterval(() => {
      const changes = this.docChangeRecords;
      this.docChangeRecords = {};
      for (const uri in changes) {
        const doc = changes[uri];
        const pythonDoc = this.extractPythonCodes(doc);

        this.onDidChangeTextDocument({
          textDocument: doc,
          contentChanges: [{ text: pythonDoc }],
        });
      }
    }, 1000);
  }

  protected extractPythonCodes(doc: TextDocument): string {
    const uri = doc.uri;
    const languageService = this.sasLspProvider(uri);
    const codeZoneManager = languageService.getCodeZoneManager();
    const pythonDocLines = [];
    const symbols: DocumentSymbol[] = languageService.getDocumentSymbols();
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      if (symbol.name?.toUpperCase() === "PROC PYTHON") {
        let pythonCodeStart = undefined;
        let pythonCodeEnd = undefined;
        const pos = { ...symbol.range.start };
        while (pos.line <= symbol.range.end.line) {
          if (
            !pythonCodeStart &&
            codeZoneManager.getCurrentZone(pos.line, pos.character) ===
              CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG &&
            // a codezone bug
            pos.line >= symbol.range.start.line + 2
          ) {
            pythonCodeStart = { ...pos };
          }
          if (
            pythonCodeStart &&
            codeZoneManager.getCurrentZone(pos.line, pos.character) !==
              CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG
          ) {
            pythonCodeEnd = { ...pos };
            if (pythonCodeEnd.character === 0) {
              pythonCodeEnd.line--;
              pythonCodeEnd.character =
                languageService.model.getColumnCount(pythonCodeEnd.line) - 1;
              if (pythonCodeEnd.character < 0) {
                pythonCodeEnd.character = 0;
              }
            }
            break;
          }
          pos.character++;
          if (pos.character >= languageService.model.getLine(pos.line).length) {
            pos.line++;
            pos.character = 0;
          }
        }
        if (!pythonCodeStart) {
          continue;
        }
        const pythonCodeLines = doc
          .getText({
            start: pythonCodeStart,
            end: pythonCodeEnd ?? symbol.range.end,
          })
          .split("\n");
        let firstNotEmptyLine: string | undefined = undefined;
        for (const line of pythonCodeLines) {
          if (line.trim().length > 0 && !line.startsWith("#")) {
            firstNotEmptyLine = line;
            break;
          }
        }
        const shouldAddDummyBlock: boolean =
          !!firstNotEmptyLine && [" ", "\t"].includes(firstNotEmptyLine[0]);
        const lineGap = pythonCodeStart.line - pythonDocLines.length;
        for (let i = 0; i < lineGap; i++) {
          if (shouldAddDummyBlock && i === lineGap - 1) {
            pythonDocLines.push("if True:");
          } else {
            pythonDocLines.push("");
          }
        }
        for (const line of pythonCodeLines) {
          pythonDocLines.push(line);
        }
        pythonDocLines.push("pass");
      }
    }
    const pythonDoc = pythonDocLines.join("\n");
    return pythonDoc;
  }

  protected calculateMaxCommentIndent(docLines: string[]): number {
    let minIndent: number = -1;
    for (const line of docLines) {
      if (line.trim().length === 0) {
        continue;
      }
      let curIndent = 0;
      for (let i = 0; i < line.length; i++) {
        if (line[i] === " " || line[i] === "\t") {
          curIndent++;
        } else {
          break;
        }
      }
      if (minIndent === -1 || curIndent < minIndent) {
        minIndent = curIndent;
      }
    }
    return minIndent;
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
    super.onInitialized();
  }

  public initialize(
    params: InitializeParams,
    supportedCommands: string[],
    supportedCodeActions: string[],
  ): InitializeResult {
    return super.initialize(params, supportedCommands, supportedCodeActions);
  }

  public addContentChange(doc: TextDocument): void {
    this.docChangeRecords[doc.uri] = doc;
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
    const pythonDocContent = this.extractPythonCodes(doc);
    const newParams: DidOpenTextDocumentParams = { ...params };
    newParams.textDocument = { ...params.textDocument };
    newParams.textDocument.languageId = "python";
    newParams.textDocument.text = pythonDocContent;
    await super.onDidOpenTextDocument(newParams, ipythonMode);
  }

  public async onDidCloseTextDocument(params: DidCloseTextDocumentParams) {
    // delete this.docOffsetMap[params.textDocument.uri];
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
    createDocumentRange?: (
      uri: Uri,
      result: CollectionResult,
      parseResults: ParseFileResults,
    ) => DocumentRange,
    convertToLocation?: (
      fs: ReadOnlyFileSystem,
      ranges: DocumentRange,
    ) => Location | undefined,
  ): Promise<Location[] | null | undefined> {
    return await super.onReferences(
      params,
      token,
      workDoneReporter,
      resultReporter,
      createDocumentRange,
      convertToLocation,
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
