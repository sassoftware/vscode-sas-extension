// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Position,
  Range,
  TextDocument,
  Uri,
  ViewColumn,
  commands,
  l10n,
  languages,
  window,
  workspace,
} from "vscode";
import type { BaseLanguageClient } from "vscode-languageclient";

import {
  DebugSession,
  InitializedEvent,
  OutputEvent,
  Scope,
  Source,
  StackFrame,
  StoppedEvent,
  TerminatedEvent,
  Thread,
} from "@vscode/debugadapter";
import type { DebugProtocol } from "@vscode/debugprotocol";

import { posix } from "path";

import { profileConfig } from "../../commands/profile";
import { LogLine, OnLogFn, getSession } from "../../connection";
import { DEBUGGER_OPTIONS_STATEMENT } from "../../connection/rest/session";
import { useRunStore } from "../../store";
import { appendSessionLogFn } from "../logViewer";
import { debugDocumentProvider } from "./DebugDocumentProvider";
import {
  DebuggerStop,
  DebuggerTranscript,
  createDebuggerLogVisibilityFilter,
  parseDebuggerLog,
} from "./logParser";

const DATA_STEP_THREAD_ID = 1;
const DATA_STEP_FRAME_ID = 1;
const VARIABLES_REFERENCE = 1;
const CONFIGURATION_DONE_TIMEOUT_MS = 1000;
// server/src/sas/LexerEx.ts defines the DATA Step as 0
const DATA_STEP_BLOCK_TYPE = 0;

interface SasFoldingBlock {
  type: number;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface SasLaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  program?: string;
  position?: { line: number; character: number };
}

/**
 * Debug Adapter Protocol implementation for the SAS DATA step debugger.
 *
 * Runs inline in the extension host (see DebugAdapterInlineImplementation),
 * which lets it reuse the active SAS connection.
 */
export class SasDebugSession extends DebugSession {
  private readonly configurationDone: Promise<void>;
  private resolveConfigurationDone: () => void;
  private isStartingDebugger = false;
  private session: ReturnType<typeof getSession> | undefined;
  private program: { uri: Uri; lines: string[]; code: string } | undefined;
  private transcript: DebuggerTranscript | undefined;
  private stopLocation: { source: Source; line: number } | undefined;
  private debugDocumentUri: Uri | undefined;
  private readonly breakpointLines = new Map<string, Set<number>>();

  public constructor(private readonly languageClient?: BaseLanguageClient) {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
    this.configurationDone = new Promise<void>((resolve) => {
      this.resolveConfigurationDone = resolve;
    });
  }

  // #region Debugger Initialization
  /**
   * Functions that are called by the built in VS Code debugger to:
   * - Initialize the Debugging session
   * - Open a new Text Document to be used for debugging
   * - Run the preamble code nessessary for the debugger session
   * - Run the DATA step code the users is debugging
   */

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
  ): void {
    response.body = {
      ...response.body,
      supportsConfigurationDoneRequest: true,
      supportsRestartRequest: true,
    };
    this.sendResponse(response);

    // Tells the client it can now send breakpoints and other configuration
    this.sendEvent(new InitializedEvent());
  }

  protected configurationDoneRequest(
    response: DebugProtocol.ConfigurationDoneResponse,
  ): void {
    this.resolveConfigurationDone();
    this.sendResponse(response);
  }

  protected async launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: SasLaunchRequestArguments,
  ): Promise<void> {
    await Promise.race([
      this.configurationDone,
      new Promise((resolve) =>
        setTimeout(resolve, CONFIGURATION_DONE_TIMEOUT_MS),
      ),
    ]);

    if (useRunStore.getState().isExecutingCode) {
      return this.sendLaunchError(
        response,
        l10n.t("SAS code is already running. Try again when it completes."),
      );
    }

    if (profileConfig.getActiveProfile() === "") {
      return this.sendLaunchError(
        response,
        l10n.t(
          "No active connection profile. Add or switch to a SAS Viya profile before debugging.",
        ),
      );
    }

    let session: ReturnType<typeof getSession>;
    try {
      session = getSession();
    } catch (error) {
      return this.sendLaunchError(response, error?.message ?? String(error));
    }

    if (typeof session.executeDebuggerCode !== "function") {
      return this.sendLaunchError(
        response,
        l10n.t(
          "DATA step debugging is only supported for SAS Viya connections.",
        ),
      );
    }

    let code: string;
    try {
      const program = args.program;
      if (
        program !== undefined &&
        (typeof program !== "string" || !program.trim())
      ) {
        throw new Error(
          l10n.t("The debug program must be a file path or URI."),
        );
      }
      const uri = program
        ? /^[a-z][a-z0-9+.-]*:/i.test(program) && !/^[a-z]:[\\/]/i.test(program)
          ? Uri.parse(program)
          : Uri.file(program)
        : window.activeTextEditor?.document.uri;

      const document = await workspace.openTextDocument(uri);
      if (document.languageId !== "sas") {
        throw new Error(l10n.t("The debug program must be a SAS document."));
      }
      if (!document.getText().trim()) {
        throw new Error(l10n.t("The debug program is empty."));
      }

      code = await this.getDocumentCode(args.position ?? undefined, document);
      const displayCode = "/* DEBUGGING */\n" + code;
      const debugDocument = await this.openDebugDocument(displayCode);
      this.program = {
        uri: debugDocument.uri,
        lines: displayCode.split(/\r?\n/),
        code,
      };
      await window.showTextDocument(debugDocument, {
        viewColumn: ViewColumn.Active,
        preview: false,
      });
    } catch (error) {
      return this.sendLaunchError(response, error?.message ?? String(error));
    }

    this.sendResponse(response);
    await this.startDebugger(session, code);
  }

  private async startDebugger(
    session: ReturnType<typeof getSession>,
    code: string,
    restoreBreakpoints = false,
  ): Promise<void> {
    const { setIsExecutingCode } = useRunStore.getState();
    this.isStartingDebugger = true;
    setIsExecutingCode(true);
    commands.executeCommand("setContext", "SAS.running", true);

    try {
      session.onSessionLogFn = appendSessionLogFn;
      await session.setup();

      this.log(l10n.t("Starting DATA step debugger..."));
      const logLines: LogLine[] = [];
      const jobId = await session.executeDebuggerCode(
        code,
        this.collectLog(logLines),
      );
      this.session = session;
      this.log(l10n.t("DATA step debugger started (job {jobId}).", { jobId }));
      this.showLastStop(logLines);
      if (restoreBreakpoints && this.currentStop()) {
        await this.restoreBreakpoints(session);
      }
    } catch (error) {
      this.log(
        l10n.t("Failed to start the DATA step debugger: {message}", {
          message: error?.message ?? String(error),
        }),
        "stderr",
      );
      await this.closeDebugDocument();
      this.sendEvent(new TerminatedEvent());
    } finally {
      this.isStartingDebugger = false;
      setIsExecutingCode(false);
      commands.executeCommand("setContext", "SAS.running", false);
    }
  }

  // #endregion

  // #region SAS Commands

  /**
   * Restarts the DATA step debugger in the same debug document: quits the
   * paused debugger on the server, resubmits the DATA step, and reapplies the
   * document's breakpoints.
   */
  protected async restartRequest(
    response: DebugProtocol.RestartResponse,
  ): Promise<void> {
    const session = this.session;
    const program = this.program;

    if (this.currentStop()) {
      this.log(l10n.t("Stopping DATA step debugger..."));
      if (!(await this.runDebuggerCommand(response, "quit;", false))) {
        return;
      }
    } else if (useRunStore.getState().isExecutingCode) {
      this.sendErrorResponse(response, {
        id: 1003,
        format: l10n.t(
          "SAS code is already running. Try again when it completes.",
        ),
        showUser: true,
      });
      return;
    }

    this.transcript = undefined;
    this.stopLocation = undefined;
    this.sendResponse(response);
    await this.startDebugger(session, program.code, true);
  }

  protected async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): Promise<void> {
    const source = args.source.path ?? args.source.name ?? "";
    const previousLines = this.breakpointLines.get(source) ?? new Set<number>();
    const requestedLines = new Set(
      (args.breakpoints ?? []).map((breakpoint) => breakpoint.line),
    );
    this.breakpointLines.set(source, previousLines);

    for (const line of previousLines) {
      if (!requestedLines.has(line)) {
        if (!(await this.removeBreakpoint(response, line))) {
          return;
        }
        previousLines.delete(line);
      }
    }

    for (const breakpoint of args.breakpoints ?? []) {
      if (previousLines.has(breakpoint.line)) {
        continue;
      }
      if (
        !(await this.runDebuggerCommand(
          response,
          `break ${breakpoint.line};`,
          false,
        ))
      ) {
        return;
      }
      previousLines.add(breakpoint.line);
    }

    response.body = {
      breakpoints: (args.breakpoints ?? []).map((bp) => ({
        verified: true,
        line: bp.line,
      })),
    };
    this.sendResponse(response);
  }

  private async removeBreakpoint(
    response: DebugProtocol.SetBreakpointsResponse,
    lineNumber: number,
  ): Promise<boolean> {
    return this.runDebuggerCommand(
      response,
      `delete break ${lineNumber}`,
      false,
    );
  }

  private async restoreBreakpoints(
    session: ReturnType<typeof getSession>,
  ): Promise<void> {
    const { uri } = this.program;
    const lines = this.breakpointLines.get(
      uri.scheme === "file" ? uri.fsPath : uri.toString(),
    );
    for (const line of lines ?? []) {
      try {
        await session.executeDebuggerCommand(
          `break ${line};`,
          false,
          this.collectLog([]),
        );
      } catch (error) {
        // Forget the line so the next setBreakpoints request resubmits it
        lines.delete(line);
        this.log(
          l10n.t("Failed to restore breakpoint at line {line}: {message}", {
            line,
            message: error?.message ?? String(error),
          }),
          "stderr",
        );
      }
    }
  }

  protected async continueRequest(
    response: DebugProtocol.ContinueResponse,
  ): Promise<void> {
    response.body = { allThreadsContinued: true };
    await this.runDebuggerCommand(response, "go;");
  }

  protected async nextRequest(
    response: DebugProtocol.NextResponse,
  ): Promise<void> {
    await this.runDebuggerCommand(response, "step;");
  }

  protected async stepInRequest(
    response: DebugProtocol.StepInResponse,
  ): Promise<void> {
    await this.runDebuggerCommand(response, "step;");
  }

  private async runDebuggerCommand(
    response: DebugProtocol.Response,
    command: string,
    advancesExecution = true,
  ): Promise<boolean> {
    const { setIsExecutingCode, isExecutingCode } = useRunStore.getState();
    try {
      if (isExecutingCode) {
        throw new Error(
          l10n.t("SAS code is already running. Try again when it completes."),
        );
      }
      if (!this.currentStop() || !this.session?.executeDebuggerCommand) {
        throw new Error(l10n.t("The DATA step debugger is not paused."));
      }
    } catch (error) {
      this.sendErrorResponse(response, {
        id: 1002,
        format: error?.message ?? String(error),
        showUser: true,
      });
      return false;
    }

    setIsExecutingCode(true);
    commands.executeCommand("setContext", "SAS.running", true);
    try {
      const logLines: LogLine[] = [];
      const checkVariableChanges = ["go;", "step;"].includes(command);
      await this.session.executeDebuggerCommand(
        command,
        checkVariableChanges,
        this.collectLog(logLines),
      );
      if (advancesExecution) {
        this.sendResponse(response);
        this.showLastStop(logLines);
      }
      return true;
    } catch (error) {
      const message = l10n.t(
        "Failed to run DATA step debugger command: {message}",
        {
          message: error?.message ?? String(error),
        },
      );
      this.log(message, "stderr");
      this.sendErrorResponse(response, {
        id: 1002,
        format: message,
        showUser: true,
      });
      return false;
    } finally {
      setIsExecutingCode(false);
      commands.executeCommand("setContext", "SAS.running", false);
    }
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: [new Thread(DATA_STEP_THREAD_ID, l10n.t("DATA Step"))],
    };
    this.sendResponse(response);
  }

  // #endregion

  // #region Boilerplate DAP Functions

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
  ): void {
    const stop = this.currentStop();
    const frames = stop
      ? [
          new StackFrame(
            DATA_STEP_FRAME_ID,
            l10n.t("DATA Step"),
            this.stopLocation?.source,
            this.stopLocation?.line ?? 0,
            this.stopLocation ? stop.column : 0,
          ),
        ]
      : [];
    response.body = { stackFrames: frames, totalFrames: frames.length };
    this.sendResponse(response);
  }

  protected scopesRequest(response: DebugProtocol.ScopesResponse): void {
    response.body = {
      scopes: this.currentStop()
        ? [new Scope(l10n.t("Variables"), VARIABLES_REFERENCE, false)]
        : [],
    };
    this.sendResponse(response);
  }

  protected variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments,
  ): void {
    const stop = this.currentStop();
    const names = new Set([
      ...(this.transcript?.variables.keys() ?? []),
      ...(stop?.values.keys() ?? []),
    ]);
    response.body = {
      variables:
        stop && args.variablesReference === VARIABLES_REFERENCE
          ? [...names].map((name) => this.toDapVariable(name, stop))
          : [],
    };
    this.sendResponse(response);
  }

  protected async disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
  ): Promise<void> {
    if (this.isStartingDebugger) {
      try {
        // Interrupt the debugger job that is still running on the server
        await getSession().cancel?.();
      } catch {
        // The session may already be closed; nothing else to clean up
      }
    }
    await this.closeDebugDocument();
    this.sendResponse(response);
  }

  protected async terminateRequest(
    response: DebugProtocol.TerminateResponse,
  ): Promise<void> {
    await this.closeDebugDocument();
    this.sendResponse(response);
  }

  // #endregion

  // #region Helper functions

  /**
   * Pulls out the DATA Step code in the current document,
   * based on cursor position
   */
  private async getDocumentCode(
    position: {
      line: number;
      character: number;
    },
    document: TextDocument,
  ): Promise<string> {
    // const position = args.position ?? undefined;
    if (
      !position ||
      !Number.isInteger(position.line) ||
      !Number.isInteger(position.character) ||
      position.line < 0 ||
      position.line >= document.lineCount ||
      position.character < 0 ||
      position.character > document.lineAt(position.line).text.length
    ) {
      throw new Error(
        l10n.t("Place the cursor inside a DATA step in the debug program."),
      );
    }
    if (!this.languageClient?.isRunning()) {
      throw new Error(l10n.t("The SAS language server is not running."));
    }
    const block = await this.languageClient.sendRequest<
      SasFoldingBlock | undefined
    >("sas/getFoldingBlock", {
      textDocument: { uri: document.uri.toString() },
      line: position.line,
      col: position.character,
      ignoreCustomBlock: true,
    });
    if (!block || block.type !== DATA_STEP_BLOCK_TYPE) {
      throw new Error(
        l10n.t("Place the cursor inside a DATA step in the debug program."),
      );
    }
    const range = new Range(
      new Position(block.startLine, block.startCol),
      new Position(block.endLine, block.endCol),
    );
    if (!range.contains(new Position(position.line, position.character))) {
      throw new Error(
        l10n.t("Place the cursor inside a DATA step in the debug program."),
      );
    }
    const code = document.getText(range);
    return code;
  }

  /**
   * Opens a read-only SAS editor containing a copy of the code.
   */
  private async openDebugDocument(code: string): Promise<TextDocument> {
    await this.closeDebugDocument();
    const uri = debugDocumentProvider.create(code);
    try {
      const document = await workspace.openTextDocument(uri);
      const sasDocument = await languages.setTextDocumentLanguage(
        document,
        "sas",
      );
      this.debugDocumentUri = uri;
      return sasDocument;
    } catch (error) {
      debugDocumentProvider.remove(uri);
      throw error;
    }
  }

  /**
   * Closes the DATA Step Debugger editor and releases its contents.
   */
  private async closeDebugDocument(): Promise<void> {
    const uri = this.debugDocumentUri;
    this.debugDocumentUri = undefined;
    const document = workspace.textDocuments.find(
      (open) => uri !== undefined && open.uri.toString() === uri.toString(),
    );
    if (!document) {
      return;
    }
    await window.showTextDocument(document, { preview: false });
    await commands.executeCommand(
      "workbench.action.revertAndCloseActiveEditor",
    );

    debugDocumentProvider.remove(uri);
  }

  private sendLaunchError(
    response: DebugProtocol.LaunchResponse,
    message: string,
  ): void {
    this.sendErrorResponse(response, {
      id: 1001,
      format: message,
      showUser: true,
    });
  }

  private log(message: string, category: "console" | "stderr" = "console") {
    this.sendEvent(new OutputEvent(`${message}\n`, category));
  }

  private collectLog(logLines: LogLine[]): OnLogFn {
    const isVisible = createDebuggerLogVisibilityFilter();
    return (lines) => {
      logLines.push(...lines);
      for (const entry of lines) {
        if (isVisible(entry)) {
          this.log(entry.line, entry.type === "error" ? "stderr" : "console");
        }
      }
    };
  }

  private currentStop(): DebuggerStop | undefined {
    const stops = this.transcript?.stops ?? [];
    return stops[stops.length - 1];
  }

  /**
   * Parses the completed job's log and, if the debugger stopped, reports the
   * last stop so VS Code requests its stack, scopes and variables.
   */
  private showLastStop(logLines: LogLine[]): void {
    const transcript = parseDebuggerLog(logLines, DEBUGGER_OPTIONS_STATEMENT);
    transcript.firstCodeLogLine ??= this.transcript?.firstCodeLogLine;
    transcript.variables = new Map([
      ...(this.transcript?.variables ?? []),
      ...transcript.variables,
    ]);
    this.transcript = transcript;
    this.stopLocation = undefined;
    const stop = this.currentStop();
    if (!stop) {
      this.log(l10n.t("The DATA step debugger did not stop at a statement."));
      return;
    }

    this.stopLocation = this.resolveStopLocation(stop);
    if (!this.stopLocation) {
      this.log(
        l10n.t("Could not map debugger line {line} to the debugged document.", {
          line: stop.logLine,
        }),
        "stderr",
      );
    }
    this.sendEvent(new StoppedEvent("step", DATA_STEP_THREAD_ID));
  }

  private resolveStopLocation(
    stop: DebuggerStop,
  ): { source: Source; line: number } | undefined {
    const firstCodeLogLine = this.transcript?.firstCodeLogLine;
    if (!this.program || firstCodeLogLine === undefined) {
      return undefined;
    }

    const line = stop.logLine;
    const text = this.program.lines[line - 1];
    if (text === undefined || line < 1) {
      return undefined;
    }
    // Guard against an incorrect mapping by comparing with the echoed source
    if (
      stop.sourceText !== undefined &&
      text.trim() !== stop.sourceText.trim()
    ) {
      return undefined;
    }

    const { uri } = this.program;
    return {
      source: new Source(
        posix.basename(uri.path),
        uri.scheme === "file" ? uri.fsPath : uri.toString(),
      ),
      line,
    };
  }

  private toDapVariable(
    name: string,
    stop: DebuggerStop,
  ): DebugProtocol.Variable {
    const info = this.transcript?.variables.get(name);
    const value = stop.values.get(name);
    let displayValue: string;
    if (value === undefined) {
      displayValue = "";
    } else if (info?.type === "CHAR") {
      displayValue = `"${value}"`;
    } else {
      displayValue = value;
    }

    return {
      name,
      value: displayValue,
      type: info ? `${info.type}(${info.length})` : undefined,
      variablesReference: 0,
    };
  }
}

// #endregion
