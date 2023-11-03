// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  Range,
  Uri,
  languages,
} from "vscode";

import { LogLine, OnLogFn } from "../../connection";
import { useRunStore } from "../../store";
import { runSelectors } from "../../store/selectors";
import { SASCodeDocument } from "../utils/SASCodeDocument";
import { isShowProblemsFromSASLogEnabled } from "../utils/settings";
import { Problem, parseLog } from "./logParser";

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

  updateProblemLocation(problems, codeDoc);

  const diagnostics = constructDiagnostics(problems);

  getSasDiagnosticCollection().set(Uri.parse(codeDoc.getUri()), diagnostics);
}

function updateProblemLocation(problems: Problem[], codeDoc: SASCodeDocument) {
  let lastAvailableOffset: { lineOffset: number; columnOffset: number } = {
    lineOffset: 0,
    columnOffset: 0,
  };
  problems.forEach((problem) => {
    const offsets =
      codeDoc.rawCodeOffsetFor(problem.lineNumber) ?? lastAvailableOffset;
    lastAvailableOffset = offsets;

    problem.lineNumber += offsets.lineOffset;
    problem.startColumn += offsets.columnOffset;
    problem.endColumn += offsets.columnOffset;
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

export const SASDiagnostic = {
  DiagnosticCommands,
  ignore,
  ignoreAll,
  getSasDiagnosticCollection,
  updateDiagnostics,
  generateLogFn,
};
