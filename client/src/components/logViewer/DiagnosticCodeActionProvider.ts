// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CodeAction,
  CodeActionContext,
  CodeActionKind,
  CodeActionProvider,
  Command,
  Diagnostic,
  DiagnosticSeverity,
  ProviderResult,
  Range,
  Selection,
  TextDocument,
  l10n,
} from "vscode";

import { diagnosticSource, sasDiagnostic } from "./sasDiagnostics";

export class DiagnosticCodeActionProvider implements CodeActionProvider {
  public static readonly providedCodeActionKinds = [CodeActionKind.QuickFix];
  provideCodeActions(
    document: TextDocument,
    _range: Range | Selection,
    context: CodeActionContext,
  ): ProviderResult<(CodeAction | Command)[]> {
    const diagnostics = context.diagnostics.filter(
      (diagnostic) => diagnostic.source === diagnosticSource,
    );
    if (diagnostics.length === 0) {
      return [];
    }

    return [
      this.createCodeAction(
        document,
        diagnostics,
        sasDiagnostic.DiagnosticCommands.IgnoreCommand,
      ),
      this.createCodeAction(
        document,
        diagnostics,
        sasDiagnostic.DiagnosticCommands.IgnoreAllWarningCommand,
      ),
      this.createCodeAction(
        document,
        diagnostics,
        sasDiagnostic.DiagnosticCommands.IgnoreAllErrorCommand,
      ),
      this.createCodeAction(
        document,
        diagnostics,
        sasDiagnostic.DiagnosticCommands.IgnoreAllCommand,
      ),
    ];
  }

  private createCodeAction(
    document: TextDocument,
    diagnostics: Diagnostic[],
    command: string,
  ): CodeAction {
    const action = new CodeAction("", CodeActionKind.QuickFix);

    switch (command) {
      case sasDiagnostic.DiagnosticCommands.IgnoreCommand:
        action.title = l10n.t("Ignore: current position");
        action.command = {
          command: command,
          title: l10n.t("Ignore: current position"),
          arguments: [diagnostics, document.uri],
        };
        break;
      case sasDiagnostic.DiagnosticCommands.IgnoreAllWarningCommand:
        action.title = l10n.t("Ignore: warning");
        action.command = {
          command: command,
          title: l10n.t("Ignore: warning"),
          arguments: [document.uri, DiagnosticSeverity.Warning],
        };
        break;
      case sasDiagnostic.DiagnosticCommands.IgnoreAllErrorCommand:
        action.title = l10n.t("Ignore: error");
        action.command = {
          command: command,
          title: l10n.t("Ignore: error"),
          arguments: [document.uri, DiagnosticSeverity.Error],
        };
        break;
      case sasDiagnostic.DiagnosticCommands.IgnoreAllCommand:
        action.title = l10n.t("Ignore: all");
        action.command = {
          command: command,
          title: l10n.t("Ignore: all"),
          arguments: [document.uri],
        };
        break;
    }
    return action;
  }
}
