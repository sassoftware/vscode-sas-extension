// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, ViewColumn, commands, l10n, window, workspace } from "vscode";

import {
  DebugSession,
  InitializedEvent,
  OutputEvent,
  TerminatedEvent,
  Thread,
} from "@vscode/debugadapter";
import type { DebugProtocol } from "@vscode/debugprotocol";

import { profileConfig } from "../../commands/profile";
import { getSession } from "../../connection";
import { useRunStore } from "../../store";
import { appendSessionLogFn } from "../logViewer";

const DATA_STEP_THREAD_ID = 1;
const CONFIGURATION_DONE_TIMEOUT_MS = 1000;

export interface SasLaunchRequestArguments
  extends DebugProtocol.LaunchRequestArguments {
  program?: string;
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

  public constructor() {
    super();
    this.setDebuggerLinesStartAt1(true);
    this.setDebuggerColumnsStartAt1(true);
    this.configurationDone = new Promise<void>((resolve) => {
      this.resolveConfigurationDone = resolve;
    });
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
  ): void {
    response.body = {
      ...response.body,
      supportsConfigurationDoneRequest: true,
    };
    this.sendResponse(response);

    // Tells the client it can now send breakpoints and other configuration
    this.sendEvent(new InitializedEvent());
  }

  protected setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments,
  ): void {
    // Breakpoints are not supported yet, so report them all as unverified
    response.body = {
      breakpoints: (args.breakpoints ?? []).map((bp) => ({
        verified: false,
        line: bp.line,
        message: l10n.t("Breakpoints are not supported yet."),
      })),
    };
    this.sendResponse(response);
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
      if (!uri) {
        throw new Error(
          l10n.t(
            "Open a SAS file or set program in the debug launch configuration.",
          ),
        );
      }
      const document = await workspace.openTextDocument(uri);
      if (document.languageId !== "sas") {
        throw new Error(l10n.t("The debug program must be a SAS document."));
      }
      code = document.getText();
      if (!code.trim()) {
        throw new Error(l10n.t("The debug program is empty."));
      }
      await window.showTextDocument(document, {
        viewColumn: ViewColumn.Active,
        preview: false,
      });
    } catch (error) {
      return this.sendLaunchError(response, error?.message ?? String(error));
    }

    this.sendResponse(response);

    const { setIsExecutingCode } = useRunStore.getState();
    this.isStartingDebugger = true;
    setIsExecutingCode(true);
    commands.executeCommand("setContext", "SAS.running", true);

    try {
      session.onSessionLogFn = appendSessionLogFn;
      await session.setup();

      this.log(l10n.t("Starting DATA step debugger..."));
      const jobId = await session.executeDebuggerCode(code, (lines) => {
        for (const entry of lines) {
          this.log(entry.line, entry.type === "error" ? "stderr" : "console");
        }
      });
      this.log(l10n.t("DATA step debugger started (job {jobId}).", { jobId }));
    } catch (error) {
      this.log(
        l10n.t("Failed to start the DATA step debugger: {message}", {
          message: error?.message ?? String(error),
        }),
        "stderr",
      );
      this.sendEvent(new TerminatedEvent());
    } finally {
      this.isStartingDebugger = false;
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
    this.sendResponse(response);
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
}
