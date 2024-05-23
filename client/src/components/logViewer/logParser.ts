// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { LogLine } from "../../connection";
import {
  LocationOffset,
  Problem,
  ProblemProcessor,
  decomposeCodeLogLine,
  isSourceCodeLineAfterLineWrapping,
} from "./ProblemProcessor";

export function parseLog(
  logs: LogLine[],
  logStartFlag: string,
): Problem[] | null {
  if (logs.length === 0 || logStartFlag.trim() === "") {
    return null;
  }

  // logs cleaning
  const latestLogs = getTheLatestLogs(logs, logStartFlag);
  const problemRelatedLogs = getProblemRelatedLogs(latestLogs);

  let problemProcessor: ProblemProcessor = new ProblemProcessor();
  let offset: LocationOffset;
  const problems: Problem[] = [];

  problemRelatedLogs.forEach((logLine) => {
    if (isProblemTypeLog(logLine)) {
      if (isNewProblemLogLine(logLine.line)) {
        problemProcessor.addProblemLogLine(logLine);
        return;
      }

      if (isLocationIndicatorLogLine(logLine.line)) {
        problemProcessor.addLocationIndicatorLogLine(logLine);
        return;
      }

      if (isProblemNumberLogLine(logLine.line)) {
        problemProcessor.addProblemNumberLogLine(logLine);
        return;
      }

      problemProcessor.appendProblemLogLine(logLine);
      return;
    } else {
      if (!isValidSourceCodeLog(logLine)) {
        return;
      }

      const currentSourceCodeLine = logLine.line;
      if (!offset) {
        offset = calculateLocationOffset(currentSourceCodeLine, logStartFlag);
      }

      const isWrappedLine = isSourceCodeLineAfterLineWrapping(
        currentSourceCodeLine,
      );

      const previousSourceCodeLines = problemProcessor.getSourceCodeLines();
      const isSameAsPrevious = areSameLines(
        currentSourceCodeLine,
        previousSourceCodeLines[previousSourceCodeLines.length - 1],
      );

      if (problemProcessor.isReady() && !isSameAsPrevious) {
        problems.push(...problemProcessor.processProblems(offset));
        const unclaimedLocations = problemProcessor.getUnclaimedLocations();
        problemProcessor = isWrappedLine
          ? new ProblemProcessor(previousSourceCodeLines, unclaimedLocations)
          : new ProblemProcessor(undefined, unclaimedLocations);
      }

      problemProcessor.setSourceCodeLine(currentSourceCodeLine);
    }
  });

  if (problemProcessor.isReady()) {
    problems.push(...problemProcessor.processProblems(offset));
  }

  problemProcessor = null;

  return problems;
}

function getTheLatestLogs(logs: LogLine[], firstCodeLine: string): LogLine[] {
  let beginningIndex = -1;
  logs.forEach((logLine, index) => {
    if (logLine.type !== "source") {
      return;
    }

    const code = decomposeCodeLogLine(logLine.line)?.code ?? null;
    if (code !== null && firstCodeLine === code.trim()) {
      beginningIndex = index;
    }
  });

  return beginningIndex === -1 ? [] : logs.slice(beginningIndex);
}

function getProblemRelatedLogs(logs: LogLine[]): LogLine[] {
  return logs.filter((logLine) => {
    return ["error", "warning", "source"].includes(logLine.type);
  });
}

function calculateLocationOffset(
  codeLogLine: string,
  firstCodeLine: string,
): { columnOffset: number; lineOffset: number } {
  const codeInfo = decomposeCodeLogLine(codeLogLine);

  // there may be a log kept when finishing running selected code,
  // the kept log will be sent out in following running code.
  // that log line number should not be used for calculating line offset.
  if (codeInfo === null || firstCodeLine !== codeInfo.code.trim()) {
    return { lineOffset: -1, columnOffset: -1 };
  }

  const lineOffset = codeInfo.lineNumber;
  const columnOffset = codeLogLine.indexOf(firstCodeLine);

  return { columnOffset, lineOffset };
}

function isProblemTypeLog(logLine: LogLine): boolean {
  return logLine.type === "error" || logLine.type === "warning";
}

function isSourceTypeLog(logLine: LogLine): boolean {
  return logLine.type === "source";
}

function isEmptyCodeLogLine(logLine: string): boolean {
  return /^\d+\s*$/.test(logLine);
}

/* there are two kind of beginning log lines indicating new problem
  1) problem with this kind of beginning has location indicator in one of previous log line.
    "ERROR 22-322: Syntax error, expecting one of the following: ;, CANCEL, "
  2) problem with this kind of beginning has no location indicator and it is located to the previous closest source code
    "WARNING: Variable POP_100 not found in data set WORK.UNIVOUT."
*/
function isNewProblemLogLine(line: string): boolean {
  return /^(?<logType>error|warning)(?<errorCategory>\s*\d+-\d+)?:\s(?<message>.*)/i.test(
    line,
  );
}

/*
the continuous hyphens/underscores means a location indicator. 
in below logs, the 2nd & 5th lines are location indicator log lines.
below are part of logs:
18       call call symputx('mac', quote(strip(emple)));            
                   -------                            -
                   22                                 79
                   68
              ----
              251
*/
function isLocationIndicatorLogLine(logLine: string): boolean {
  return /^(?<space>\s+)(?<indicator>[-_]+\s*)+$/.test(logLine);
}

/*
the number below the continuous hyphens/underscores means a problem number.
in below logs, the 3rd & 4th & 6th lines are problem number log lines.
below are part of logs:
18       call call symputx('mac', quote(strip(emple)));            
                   -------                            -
                   22                                 79
                   68
              ----
              251
*/
function isProblemNumberLogLine(line: string): boolean {
  return /^(?<space>\s+)(?<problemNumber>\d+\s*)+$/.test(line);
}

function isValidSourceCodeLog(logLine: LogLine): boolean {
  return isSourceTypeLog(logLine) && !isEmptyCodeLogLine(logLine.line);
}

function areSameLines(line1: string, line2: string) {
  return line1 === line2;
}
