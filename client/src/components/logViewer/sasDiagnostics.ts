// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  Disposable,
  Range,
  Uri,
  commands,
  languages,
  window,
  workspace,
} from "vscode";

import { LogLine, OnLogFn } from "../../connection";
import { useRunStore } from "../../store";
import { runSelectors } from "../../store/selectors";
import { SASCodeDocument } from "../utils/SASCodeDocument";
import { isShowProblemsFromSASLogEnabled } from "../utils/settings";
import { DiagnosticCodeActionProvider } from "./DiagnosticCodeActionProvider";
import { Problem } from "./ProblemProcessor";
import { parseLog } from "./logParser";

let diagnosticCollection: DiagnosticCollection;

enum DiagnosticCommands {
  IgnoreCommand = "SAS.diagnostic.ignore",
  IgnoreAllWarningCommand = "SAS.diagnostic.ignoreAllWarning",
  IgnoreAllErrorCommand = "SAS.diagnostic.ignoreAllError",
  IgnoreAllCommand = "SAS.diagnostic.ignoreAll",
}

function ignore(diagnosticsToRemove: Diagnostic[], uri: Uri): void {
  const diagnostics = getSasDiagnosticCollection().get(uri);
  const newDiagnostics = diagnostics.filter((diagnostic) => {
    return !diagnosticsToRemove.includes(diagnostic);
  });

  getSasDiagnosticCollection().set(uri, newDiagnostics);
}

function ignoreAll(uri: Uri, severity?: DiagnosticSeverity): void {
  if (severity === undefined) {
    getSasDiagnosticCollection().delete(uri);
  } else {
    const diagnostics = getSasDiagnosticCollection().get(uri);
    const newDiagnostics = diagnostics.filter((diagnostic) => {
      return diagnostic.severity !== severity;
    });
    getSasDiagnosticCollection().set(uri, newDiagnostics);
  }
}

function updateDiagnosticUri(oldUri: Uri, newUri: Uri): void {
  const diagnosticCollection = getSasDiagnosticCollection();
  const diagnostics = diagnosticCollection.get(oldUri);
  diagnosticCollection.delete(oldUri);
  diagnosticCollection.set(newUri, diagnostics);
}

function getSasDiagnosticCollection(): DiagnosticCollection {
  if (diagnosticCollection === undefined) {
    diagnosticCollection = languages.createDiagnosticCollection("sas");
  }
  return diagnosticCollection;
}

async function updateDiagnostics(
  logs: LogLine[],
  codeDoc: SASCodeDocument,
): Promise<void> {
  if (!isShowProblemsFromSASLogEnabled()) {
    getSasDiagnosticCollection().clear();
    return;
  }

  const problems = parseLog(logs, codeDoc.wrappedCodeLineAt(0));

  if (!problems || problems.length === 0) {
    return;
  }

  updateProblemLocation(problems, codeDoc);

  const problemsWithValidLocation = problems.filter((problem) => {
    const { lineNumber, startColumn, endColumn } = problem;
    return lineNumber * startColumn * endColumn >= 0;
  });

  const diagnostics = constructDiagnostics(problemsWithValidLocation);

  getSasDiagnosticCollection().set(Uri.parse(codeDoc.getUri()), diagnostics);
}

function updateProblemLocation(problems: Problem[], codeDoc: SASCodeDocument) {
  problems.forEach((problem) => {
    const { lineNumber, startColumn, endColumn } = problem;
    const {
      lineNumber: actualLineNumber,
      startColumn: actualStartColumn,
      endColumn: actualEndColumn,
    } = codeDoc.getLocationInRawCode({
      lineNumber,
      startColumn,
      endColumn,
    });

    problem.lineNumber = actualLineNumber;
    problem.startColumn = actualStartColumn;
    problem.endColumn = actualEndColumn;
  });
}

function constructDiagnostics(problems: Problem[]): Diagnostic[] {
  const diagnostics = problems.map((problem) => {
    const { lineNumber, startColumn, endColumn, message, type } = problem;
    const range = new Range(lineNumber, startColumn, lineNumber, endColumn);
    const diagnostic = new Diagnostic(
      range,
      message,
      type === "error" ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    );
    diagnostic.source = "sas log";
    return diagnostic;
  });

  return diagnostics;
}

function generateLogFn(
  codeDoc: SASCodeDocument,
  originLogFn?: OnLogFn,
): OnLogFn {
  const uri = codeDoc.getUri();
  if (uri === undefined || uri.trim() === "") {
    return originLogFn;
  }

  const receivedLogs = [];
  const additionalLogFn: OnLogFn = (logs) => {
    receivedLogs.push(...logs);
  };

  const unsubscribe = useRunStore.subscribe(
    runSelectors.selectIsExecutingCode,
    (isExecuting) => {
      if (!isExecuting) {
        updateDiagnostics(receivedLogs, codeDoc);
        unsubscribe();
      }
    },
  );

  return (logs) => {
    originLogFn?.(logs);
    additionalLogFn(logs);
  };
}

function getSubscriptions(): Disposable[] {
  return [
    getSasDiagnosticCollection(),

    commands.registerCommand(DiagnosticCommands.IgnoreCommand, ignore),
    commands.registerCommand(
      DiagnosticCommands.IgnoreAllWarningCommand,
      ignoreAll,
    ),
    commands.registerCommand(
      DiagnosticCommands.IgnoreAllErrorCommand,
      ignoreAll,
    ),
    commands.registerCommand(DiagnosticCommands.IgnoreAllCommand, ignoreAll),
    languages.registerCodeActionsProvider(
      "sas",
      new DiagnosticCodeActionProvider(),
    ),
    workspace.onDidRenameFiles((e) => {
      e.files.forEach((file) => updateDiagnosticUri(file.oldUri, file.newUri));
    }),

    workspace.onDidDeleteFiles((e) => {
      e.files.forEach((uri) => {
        ignoreAll(uri);
      });
    }),
    workspace.onDidSaveTextDocument((e) => {
      // the new file
      const uri = window.activeTextEditor.document.uri;
      const isNewFileSaved =
        uri.scheme === "untitled" && e.languageId === "sas";
      if (isNewFileSaved) {
        // clear diagnostics on new file
        ignoreAll(uri);
        // if the new file is saved, e indicates the file which new file saved to.
        // no matter if it override a existing file, it is ok to clear its diagnostics.
        ignoreAll(e.uri);
      }
    }),
    workspace.onDidCloseTextDocument((e) => {
      const uri = e.uri;
      // if the new file is saved, the onDidSaveTextDocument is invoked, then this is invoked.
      // if the new file is not saved, only this is invoked.
      const isNewFileClosed = uri.scheme === "untitled";
      if (isNewFileClosed) {
        ignoreAll(uri);
      }
    }),
  ];
}

export const sasDiagnostic = {
  DiagnosticCommands,
  generateLogFn,
  getSubscriptions,
  updateDiagnosticUri,
  ignoreAll,
};
