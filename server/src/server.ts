// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CancellationToken,
  CodeActionKind,
  CompletionItemKind,
  CompletionTriggerKind,
  Connection,
  DidChangeConfigurationParams,
  DidChangeWatchedFilesParams,
  DocumentHighlightParams,
  DocumentSymbol,
  ExecuteCommandParams,
  InitializeResult,
  Location,
  Position,
  PrepareRenameParams,
  Range,
  ReferenceParams,
  Registration,
  RegistrationRequest,
  RenameParams,
  ResultProgressReporter,
  SemanticTokensRequest,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  Unregistration,
  UnregistrationRequest,
  WorkDoneProgressReporter,
  WorkspaceSymbolParams,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ReadOnlyFileSystem } from "pyright-internal-node/dist/packages/pyright-internal/src/common/fileSystem";
import { DocumentRange } from "pyright-internal-node/dist/packages/pyright-internal/src/common/textRange";
import { Uri } from "pyright-internal-node/dist/packages/pyright-internal/src/common/uri/uri";
import { CollectionResult } from "pyright-internal-node/dist/packages/pyright-internal/src/languageService/documentSymbolCollector";
import { ParseFileResults } from "pyright-internal-node/dist/packages/pyright-internal/src/parser/parser";

import { PyrightLanguageProvider } from "./python/PyrightLanguageProvider";
import { CodeZoneManager } from "./sas/CodeZoneManager";
import { LanguageServiceProvider, legend } from "./sas/LanguageServiceProvider";
import type { LibCompleteItem } from "./sas/SyntaxDataProvider";
import { isCustomRegionStartComment } from "./sas/utils";

interface DocumentInfo {
  document: TextDocument;
  changed: boolean;
  service?: LanguageServiceProvider;
}

export const runServer = (
  connection: Connection,
  _pyrightLanguageProvider: PyrightLanguageProvider,
) => {
  const documentPool: Record<string, DocumentInfo> = {};

  let supportSASGetLibList = false;
  let registeredAdvancedCapabilities = false;

  _pyrightLanguageProvider.setSasLspProvider(getLanguageService);

  connection.onInitialize((params) => {
    if (
      params.initializationOptions &&
      params.initializationOptions.supportSASGetLibList
    ) {
      supportSASGetLibList = true;
    }
    _pyrightLanguageProvider.initialize(params, [], []);

    const result: InitializeResult = {
      capabilities: {
        textDocumentSync: TextDocumentSyncKind.Incremental,
        semanticTokensProvider: {
          legend,
          full: true,
        },
        documentFormattingProvider: true,
        foldingRangeProvider: true,
        documentOnTypeFormattingProvider: {
          firstTriggerCharacter: "\n",
          moreTriggerCharacter: [";"],
        },
        documentSymbolProvider: { workDoneProgress: true },
        workspaceSymbolProvider: { workDoneProgress: true },
        hoverProvider: { workDoneProgress: true },
        completionProvider: {
          triggerCharacters: _pyrightLanguageProvider.getClientCapabilities()
            .hasVisualStudioExtensionsCapability
            ? [".", "[", "@", '"', "'", " "]
            : [".", "[", '"', "'", " "],
          resolveProvider: true,
          workDoneProgress: true,
          completionItem: {
            labelDetailsSupport: true,
          },
        },
        signatureHelpProvider: {
          triggerCharacters: ["(", ",", ")"],
          workDoneProgress: true,
        },
        workspace: {
          workspaceFolders: {
            supported: true,
            changeNotifications: true,
          },
        },
        codeActionProvider: {
          codeActionKinds: [
            CodeActionKind.QuickFix,
            CodeActionKind.SourceOrganizeImports,
          ],
        },
      },
    };
    return result;
  });

  connection.onInitialized(() => _pyrightLanguageProvider.onInitialized());

  connection.onRequest(SemanticTokensRequest.type, (params) => {
    syncIfDocChange(params.textDocument.uri);
    const languageService = getLanguageService(params.textDocument.uri);

    return { data: languageService.getTokens() };
  });

  connection.onHover(async (params, token) => {
    return await dispatch(params, {
      async sas(languageService) {
        return await languageService.completionProvider.getHelp(
          params.position,
        );
      },
      async python(pyrightLanguageService) {
        return await pyrightLanguageService.onHover(params, token);
      },
    });
  });

  connection.onCompletion(async (params, token) => {
    return await dispatch(params, {
      async sas(languageService) {
        if (
          params.context?.triggerCharacter &&
          params.context.triggerCharacter !== " "
        ) {
          return undefined;
        }
        const completionList =
          await languageService.completionProvider.getCompleteItems(
            params.position,
          );
        if (completionList) {
          for (const item of completionList.items) {
            if (!item.data) {
              item.data = {};
            }
            item.data._languageService = "sas";
            item.data._uri = params.textDocument.uri;
          }
        }
        return completionList;
      },
      async python(pyrightLanguageService) {
        const completionList = await pyrightLanguageService.onCompletion(
          params,
          token,
        );
        if (completionList) {
          for (const item of completionList.items) {
            if (!item.data) {
              item.data = {};
            }
            item.data._languageService = "python";
            item.data._uri = params.textDocument.uri;
          }

          if (
            params.context?.triggerKind === CompletionTriggerKind.Invoked ||
            params.context?.triggerKind ===
              CompletionTriggerKind.TriggerForIncompleteCompletions
          ) {
            const doc = documentPool[params.textDocument.uri].document;
            const line = doc.getText({
              start: {
                line: params.position.line,
                character: 0,
              },
              end: params.position,
            });
            if (!/\W/.test(line.trimStart())) {
              const item = {
                kind: CompletionItemKind.Keyword,
                data: {
                  _languageService: "sas",
                  _uri: params.textDocument.uri,
                },
              };
              if (
                completionList.items.findIndex(
                  (item) => item.label === "endsubmit",
                ) === -1
              ) {
                completionList.items.push({ ...item, label: "endsubmit" });
              }
              if (
                completionList.items.findIndex(
                  (item) => item.label === "endinteractive",
                ) === -1
              ) {
                completionList.items.push({ ...item, label: "endinteractive" });
              }
            }
          }
        }
        return completionList;
      },
    });
  });

  connection.onCompletionResolve(async (completionItem, token) => {
    const lang = completionItem.data._languageService;
    if (lang === "sas") {
      const languageService = getLanguageService(completionItem.data._uri);
      return await languageService.completionProvider.getCompleteItemHelp(
        completionItem,
      );
    } else if (lang === "python") {
      return await _pyrightLanguageProvider.onCompletionResolve(
        completionItem,
        token,
      );
    }
    return completionItem;
  });

  connection.onDocumentSymbol(async (params, token) => {
    syncIfDocChange(params.textDocument.uri);
    const languageService = getLanguageService(params.textDocument.uri);
    const sasSymbols = languageService.getDocumentSymbols();
    const pythonSymbols =
      (await _pyrightLanguageProvider.onDocumentSymbol(params, token)) ?? [];
    let hasPythonCode = false;
    const symbolList = [...sasSymbols];
    for (let i = 0; i < symbolList.length; i++) {
      const curSymbol = symbolList[i];
      if (isCustomRegionStartComment(curSymbol.name)) {
        symbolList.splice(i + 1, 0, ...(curSymbol.children ?? []));
      } else if (curSymbol.name?.toUpperCase() === "PROC PYTHON") {
        hasPythonCode = true;
        for (const pythonSymbol of pythonSymbols) {
          if (!("range" in pythonSymbol)) {
            continue;
          }
          if (isRangeIncluded(curSymbol.range, pythonSymbol.range)) {
            curSymbol.children?.push(pythonSymbol);
          }
        }
      }
    }
    if (registeredAdvancedCapabilities) {
      if (!hasPythonCode) {
        unregisterAdvancedCapabilities(connection);
      }
    } else {
      if (hasPythonCode) {
        registerAdvancedCapabilities(connection);
      }
    }
    return sasSymbols;
  });

  // todo
  connection.onFoldingRanges((params) => {
    syncIfDocChange(params.textDocument.uri);
    const languageService = getLanguageService(params.textDocument.uri);
    return languageService.getFoldingRanges();
  });

  connection.onRequest("sas/getFoldingBlock", async (params) => {
    return await dispatch(params, {
      async default(languageServices) {
        const block = languageServices.sasLanguageService.getFoldingBlock(
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
      },
    });
  });

  connection.onDocumentOnTypeFormatting(async (params) => {
    return await dispatch(params, {
      async sas(languageService) {
        return languageService.formatOnTypeProvider.getIndentEdit(
          params.position.line,
          params.position.character,
          params.ch,
          params.options.tabSize,
          params.options.insertSpaces,
        );
      },
    });
  });

  connection.onSignatureHelp(async (params, token) => {
    return await dispatch(params, {
      async sas(languageService) {
        return await languageService.completionProvider.getSignatureHelp(
          params.position,
          params.context?.activeSignatureHelp?.activeSignature,
        );
      },
      async python(pyrightLanguageService) {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return (await pyrightLanguageService.onSignatureHelp(
          params,
          token,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        )) as any;
      },
    });
  });

  connection.onDocumentFormatting((params) => {
    syncIfDocChange(params.textDocument.uri);
    const languageService = getLanguageService(params.textDocument.uri);
    return languageService.formatter.format({
      tabWidth: params.options.tabSize,
      useTabs: params.options.insertSpaces === false,
    });
  });

  connection.onDidOpenTextDocument(async (params) => {
    const doc = TextDocument.create(
      params.textDocument.uri,
      "sas",
      params.textDocument.version,
      params.textDocument.text,
    );
    documentPool[doc.uri] = { document: doc, changed: false };
    await _pyrightLanguageProvider.onDidOpenTextDocument(params);
  });

  connection.onDidCloseTextDocument(async (params) => {
    const uri = params.textDocument.uri;
    delete documentPool[uri];
    await _pyrightLanguageProvider.onDidCloseTextDocument(params);
  });

  connection.onDidChangeTextDocument((params) => {
    const uri = params.textDocument.uri;
    const docInfo = documentPool[uri];
    TextDocument.update(
      docInfo.document,
      params.contentChanges,
      params.textDocument.version,
    );
    docInfo.changed = true;
    docInfo.service = undefined;
  });

  connection.onDidChangeConfiguration(
    async (params: DidChangeConfigurationParams) => {
      return await _pyrightLanguageProvider.onDidChangeConfiguration(params);
    },
  );

  connection.onDefinition(
    async (params: TextDocumentPositionParams, token: CancellationToken) => {
      return await dispatch(params, {
        async python(pyrightLanguageService) {
          return await pyrightLanguageService.onDefinition(params, token);
        },
      });
    },
  );

  connection.onDeclaration(
    async (params: TextDocumentPositionParams, token: CancellationToken) => {
      return await dispatch(params, {
        async python(pyrightLanguageService) {
          return await pyrightLanguageService.onDeclaration(params, token);
        },
      });
    },
  );

  connection.onTypeDefinition(
    async (params: TextDocumentPositionParams, token: CancellationToken) => {
      return await dispatch(params, {
        async python(pyrightLanguageService) {
          return await pyrightLanguageService.onTypeDefinition(params, token);
        },
      });
    },
  );

  connection.onReferences(
    async (
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
    ) => {
      return await dispatch(params, {
        async python(pyrightLanguageService) {
          return await pyrightLanguageService.onReferences(
            params,
            token,
            workDoneReporter,
            resultReporter,
            createDocumentRange,
            convertToLocation,
          );
        },
      });
    },
  );

  connection.onWorkspaceSymbol(
    async (
      params: WorkspaceSymbolParams,
      token: CancellationToken,
      workDoneProgress,
      resultProgress,
    ) => {
      syncAllChangedDoc();
      return await _pyrightLanguageProvider.onWorkspaceSymbol(
        params,
        token,
        resultProgress,
      );
    },
  );

  connection.onDocumentHighlight(
    async (params: DocumentHighlightParams, token: CancellationToken) => {
      return await dispatch(params, {
        async python(pyrightLanguageService) {
          return await pyrightLanguageService.onDocumentHighlight(
            params,
            token,
          );
        },
      });
    },
  );

  connection.onPrepareRename(
    async (params: PrepareRenameParams, token: CancellationToken) => {
      return await dispatch(params, {
        async python(pyrightLanguageService) {
          return await pyrightLanguageService.onPrepareRenameRequest(
            params,
            token,
          );
        },
      });
    },
  );

  connection.onRenameRequest(
    async (params: RenameParams, token: CancellationToken) => {
      return await dispatch(params, {
        async python(pyrightLanguageService) {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          return (await pyrightLanguageService.onRenameRequest(
            params,
            token,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          )) as any;
        },
      });
    },
  );

  connection.onDidChangeWatchedFiles(
    async (params: DidChangeWatchedFilesParams) => {
      params.changes.forEach((item) => {
        if (item.uri in documentPool) {
          syncIfDocChange(item.uri);
        }
      });
      _pyrightLanguageProvider.onDidChangeWatchedFiles(params);
    },
  );

  connection.onExecuteCommand(
    async (
      params: ExecuteCommandParams,
      token: CancellationToken,
      reporter: WorkDoneProgressReporter,
    ) => {
      syncAllChangedDoc();
      return await _pyrightLanguageProvider.onExecuteCommand(
        params,
        token,
        reporter,
      );
    },
  );

  const callHierarchy = connection.languages.callHierarchy;

  callHierarchy.onPrepare(async (params, token) => {
    return (
      (await dispatch(params, {
        async python(pyrightLanguageService) {
          return await pyrightLanguageService.onCallHierarchyPrepare(
            params,
            token,
          );
        },
      })) ?? []
    );
  });

  callHierarchy.onIncomingCalls(async (params, token) => {
    return await _pyrightLanguageProvider.onCallHierarchyIncomingCalls(
      params,
      token,
    );
  });

  callHierarchy.onOutgoingCalls(async (params, token) => {
    return await _pyrightLanguageProvider.onCallHierarchyOutgoingCalls(
      params,
      token,
    );
  });

  connection.onCodeAction(async (params, token) => {
    return await dispatch(
      { textDocument: params.textDocument, position: params.range.start },
      {
        async python(pyrightLanguageService) {
          return await pyrightLanguageService.executeCodeAction(params, token);
        },
      },
    );
  });

  connection.onShutdown(async (token) => {
    await _pyrightLanguageProvider.onShutdown(token);
  });

  // Listen on the connection
  connection.listen();

  function getLanguageService(uri: string) {
    const docInfo = documentPool[uri];
    // re-create LanguageServer if document changed
    if (!docInfo.service) {
      docInfo.service = new LanguageServiceProvider(docInfo.document);

      if (supportSASGetLibList) {
        docInfo.service.setLibService((libId, resolve) =>
          connection
            .sendRequest<LibCompleteItem[]>("sas/getLibList", { libId: libId })
            .then(resolve),
        );
      }
    }
    return docInfo.service!;
  }

  const dispatch = async <Ret>(
    params: { textDocument: { uri: string }; position: Position },
    callbacks: {
      sas?: (languageService: LanguageServiceProvider) => Promise<Ret>;
      python?: (
        pyrightLanguageService: PyrightLanguageProvider,
      ) => Promise<Ret>;
      default?: (languageServices: {
        sasLanguageService: LanguageServiceProvider;
        pythonLanguageService?: PyrightLanguageProvider;
      }) => Promise<Ret>;
    },
  ) => {
    syncIfDocChange(params.textDocument.uri);
    const languageService = getLanguageService(params.textDocument.uri);
    const codeZoneManager = languageService.getCodeZoneManager();
    const pos = params.position;
    const symbols: DocumentSymbol[] = languageService.getDocumentSymbols();
    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i];
      if (isCustomRegionStartComment(symbol.name)) {
        symbols.splice(i + 1, 0, ...(symbol.children ?? []));
        continue;
      }
      const start = symbol.range.start;
      const end = symbol.range.end;
      if (
        (start.line < pos.line ||
          (start.line === pos.line && start.character <= pos.character)) &&
        (end.line > pos.line ||
          (end.line === pos.line && end.character >= pos.character))
      ) {
        if (
          symbol.name?.toUpperCase() === "PROC PYTHON" &&
          codeZoneManager.getCurrentZone(pos.line, pos.character) ===
            CodeZoneManager.ZONE_TYPE.EMBEDDED_LANG
        ) {
          if (callbacks.python) {
            return await callbacks.python(_pyrightLanguageProvider);
          } else if (callbacks.default) {
            return await callbacks.default({
              sasLanguageService: languageService,
              pythonLanguageService: _pyrightLanguageProvider,
            });
          } else {
            return undefined;
          }
        }
      }
    }
    if (callbacks.sas) {
      return await callbacks.sas(languageService);
    } else if (callbacks.default) {
      return await callbacks.default({
        sasLanguageService: languageService,
        pythonLanguageService: _pyrightLanguageProvider,
      });
    }
    {
      return undefined;
    }
  };

  const isRangeIncluded = (a: Range, b: Range) => {
    if (
      b.start.line > a.start.line &&
      (b.end.line < a.end.line ||
        (b.end.line === a.end.line && b.end.character <= a.end.character))
    ) {
      return true;
    }
    return false;
  };

  const syncIfDocChange = (uri: string) => {
    const docInfo = documentPool[uri];
    if (!docInfo.changed) {
      return;
    }
    docInfo.changed = false;
    _pyrightLanguageProvider.addContentChange(docInfo.document);
  };

  const syncAllChangedDoc = () => {
    for (const uri in documentPool) {
      syncIfDocChange(uri);
    }
  };

  const advancedCapabilities = [
    "textDocument/declaration",
    "textDocument/definition",
    "textDocument/typeDefinition",
    "textDocument/references",
    "textDocument/rename",
    "textDocument/documentHighlight",
    "textDocument/prepareCallHierarchy",
  ];

  const registerAdvancedCapabilities = async (conn: Connection) => {
    if (registeredAdvancedCapabilities) {
      return;
    }
    registeredAdvancedCapabilities = true;
    const registerOptions = {
      documentSelector: [{ language: "sas" }],
    };
    const registrations: Registration[] = [];
    for (const capability of advancedCapabilities) {
      registrations.push({
        id: capability,
        method: capability,
        registerOptions,
      });
    }
    await conn.sendRequest(RegistrationRequest.type, { registrations });
  };

  const unregisterAdvancedCapabilities = async (conn: Connection) => {
    if (!registeredAdvancedCapabilities) {
      return;
    }
    registeredAdvancedCapabilities = false;
    const unregisterations: Unregistration[] = [];
    for (const capability of advancedCapabilities) {
      unregisterations.push({ id: capability, method: capability });
    }
    await conn.sendRequest(UnregistrationRequest.type, {
      unregisterations: unregisterations,
    });
  };
};
