// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { LogLine } from "../../connection";

type ProblemType = "error" | "warning";

export type Problem = {
  lineNumber: number;
  startColumn: number;
  endColumn: number;
  message: string;
  type: ProblemType;
};

type ProblemLocation = {
  startColumn: number;
  endColumn: number;
  lineNumber: number;
};

// the start column for code in log may be different with which is in source file,
// one case is the \t is converted to multiple spaces, so column offset is needed.
// the line number is different with which is in source file as well, so line offset is needed.
type LocationOffset = {
  columnOffset: number;
  lineOffset: number;
};

type ProblemMetadata = {
  codeLogLine: string;
  logLines: string[];
  location: ProblemLocation;
  // "   -----" {location indicator}
  // "   22" {problem index at same location}
  // "   76" {problem index at same location}
  problemIndicsForSameLocation: string[];
  type: ProblemType; //"error" | "warning";
};

export function parseLog(
  logs: LogLine[],
  firstCodeLine: string,
): Problem[] | null {
  if (logs.length === 0 || firstCodeLine.trim() === "") {
    return null;
  }

  const latestLogs = filterOutTheLatestLogs(logs, firstCodeLine);

  const problemRelatedLogs = filterOutProblemRelatedLogs(latestLogs);

  const problemMetadata: ProblemMetadata = {
    codeLogLine: "",
    logLines: [],
    location: { startColumn: -1, endColumn: -1, lineNumber: -1 },
    problemIndicsForSameLocation: [],
    type: "error",
  };
  let offset: LocationOffset = { columnOffset: -1, lineOffset: -1 };
  let currentCodeLogLine = "";
  const problems: Problem[] = [];

  problemRelatedLogs.forEach((logLine) => {
    if (isProblemTypeLog(logLine)) {
      if (isProblemBeginningLogLine(logLine.line)) {
        addProblem(problems, problemMetadata, currentCodeLogLine, offset);

        updateProblemMetadata(problemMetadata, [
          ["logLines", [logLine.line], "replace"],
          ["type", logLine.type === "error" ? "error" : "warning", "replace"],
        ]);

        return;
      }

      if (isProblemLocationIndicatorLogLine(logLine.line)) {
        updateProblemMetadata(problemMetadata, [
          [
            "location",
            generateLocationFromIndicator(
              logLine.line,
              currentCodeLogLine,
              offset,
            ),
            "replace",
          ],
          ["problemIndicsForSameLocation", [], "replace"],
          ["sourceCode", currentCodeLogLine, "replace"],
        ]);

        return;
      }

      if (
        isProblemIndexIndicatorLogLine(logLine.line, problemMetadata.location)
      ) {
        const problemIndex = getProblemIndexFromIndicatorLogLine(logLine.line);

        if (problemIndex !== null) {
          updateProblemMetadata(problemMetadata, [
            ["problemIndicsForSameLocation", problemIndex, "amend"],
          ]);
        }

        return;
      }

      updateProblemMetadata(problemMetadata, [
        ["logLines", logLine.line, "amend"],
      ]);

      return;
    } else {
      addProblem(problems, problemMetadata, currentCodeLogLine, offset);

      if (isSourceTypeLog(logLine) && !isEmptyCodeLogLine(logLine.line)) {
        currentCodeLogLine = logLine.line;

        if (!isValidOffset(offset)) {
          offset = calculateLocationOffset(logLine.line, firstCodeLine);
        }

        return;
      }
    }
  });

  addProblem(problems, problemMetadata, currentCodeLogLine, offset);

  return problems;
}

function filterOutTheLatestLogs(
  logs: LogLine[],
  firstCodeLine: string,
): LogLine[] {
  let beginningIndex = -1;
  logs.forEach((logLine, index) => {
    if (logLine.type !== "source") {
      return;
    }

    const code = extractCodeInfoFromCodeLogLine(logLine.line)?.code ?? null;
    if (code !== null && firstCodeLine === code.trim()) {
      beginningIndex = index;
    }
  });

  return beginningIndex === -1 ? [] : logs.slice(beginningIndex);
}

function filterOutProblemRelatedLogs(logs: LogLine[]): LogLine[] {
  return logs.filter((logLine) => {
    return ["error", "warning", "source"].includes(logLine.type);
  });
}

function updateProblemMetadata(
  problemMetadata: ProblemMetadata,
  data: [
    key: string,
    value: string | string[] | ProblemType | ProblemLocation,
    operation: "amend" | "replace",
  ][],
) {
  data.forEach((item) => {
    const [key, value, operation] = item;
    if (operation === "replace") {
      problemMetadata[key] = value;
    } else {
      problemMetadata[key].push(value);
    }
  });
}

function resetProblemMetadata(problemMetadata: ProblemMetadata) {
  removeHandledProblemIndex(problemMetadata);

  const isClear = problemMetadata.problemIndicsForSameLocation.length === 0;
  const { codeLogLine, location } = isClear
    ? {
        location: { startColumn: -1, endColumn: -1, lineNumber: -1 },
        codeLogLine: "",
      }
    : problemMetadata;

  updateProblemMetadata(problemMetadata, [
    ["location", location, "replace"],
    ["codeLogLine", codeLogLine, "replace"],
    ["logLines", [], "replace"],
    ["type", "error", "replace"],
  ]);
}

function removeHandledProblemIndex(problemMetadata: ProblemMetadata) {
  if (problemMetadata.problemIndicsForSameLocation.length === 0) {
    return;
  }

  const handledProblemIndex = getProblemIndexFromProblemBeginningLogLine(
    problemMetadata.logLines[0],
  );

  const newIndices: string[] =
    problemMetadata.problemIndicsForSameLocation.filter(
      (problemIndex) => problemIndex !== handledProblemIndex,
    );

  updateProblemMetadata(problemMetadata, [
    ["problemIndicsForSameLocation", newIndices, "replace"],
  ]);
}

function calculateLocationOffset(
  codeLogLine: string,
  firstCodeLine: string,
): { columnOffset: number; lineOffset: number } {
  const codeInfo = extractCodeInfoFromCodeLogLine(codeLogLine);

  // there may be a log kept when finishing running selected code,
  // the kept log will be sent out in following running code.
  // that log line number should not be used for calculating line offset.
  if (codeInfo === null || firstCodeLine !== codeInfo.code.trim()) {
    return { lineOffset: -1, columnOffset: -1 };
  }

  const lineOffset = codeInfo.lineNumber;
  const regexToMatchFirstNonSpaces = /\w/;
  const firstCharIndexInCode =
    firstCodeLine.match(regexToMatchFirstNonSpaces)?.index ?? -1;
  const firstCharIndexInLog =
    codeInfo.code.match(regexToMatchFirstNonSpaces)?.index ?? -1;
  const lineNumberLength = codeInfo.lineNumber.toString().length;
  const columnOffset =
    firstCharIndexInLog - firstCharIndexInCode + lineNumberLength;

  return { columnOffset, lineOffset };
}

function getFirstCharacterColumn(line: string): number {
  const regExp = /[^\s]/;
  if (line.trim() === "") {
    return -1;
  }

  const match = line.match(regExp);
  return match === null || match.index === undefined ? -1 : match.index;
}

function addProblem(
  problems: Problem[],
  problemMetadata: ProblemMetadata,
  codeLogLine: string,
  offset: LocationOffset,
) {
  if (hasNotCachedProblem(problemMetadata)) {
    return;
  }

  handleProblemLocation(problemMetadata, codeLogLine, offset);

  const problem = constructProblem(problemMetadata);
  problems.push(problem);

  resetProblemMetadata(problemMetadata);
}

function hasNotCachedProblem(problemMetadata: ProblemMetadata): boolean {
  return problemMetadata.logLines.length === 0;
}

function handleProblemLocation(
  problemMetadata: ProblemMetadata,
  codeLogLine: string,
  offset: LocationOffset,
) {
  if (!isValidProblemLocation(problemMetadata.location)) {
    problemMetadata.location = generateLocationFromCodeLogLine(
      codeLogLine,
      offset,
    );
  }
}

// Example: "      ---"
const RegExpLocationIndicatorLogLine = /^(?<space>\s*)(?<hyphen>-+)$/;

function generateLocationFromIndicator(
  logLine: string,
  codeLogLine: string,
  offset: LocationOffset,
): ProblemLocation | null {
  const regExp = RegExpLocationIndicatorLogLine;
  const found = logLine.match(regExp);
  if (found === null) {
    return null;
  }

  const codeLogLineNumber =
    extractCodeInfoFromCodeLogLine(codeLogLine).lineNumber;

  const { space, hyphen } = found.groups;
  const startColumn = space.length - offset.columnOffset;
  const endColumn = startColumn + hyphen.length;

  return {
    lineNumber: codeLogLineNumber - offset.lineOffset,
    startColumn,
    endColumn,
  };
}

function generateLocationFromCodeLogLine(
  codeLogLine: string,
  offset: LocationOffset,
): ProblemLocation {
  const { code, lineNumber: codeLogLineNumber } =
    extractCodeInfoFromCodeLogLine(codeLogLine);
  const startColumn =
    getFirstCharacterColumn(code) +
    codeLogLineNumber.toString().length -
    offset.columnOffset;
  const endColumn = startColumn + code.trim().length;
  const lineNumber = codeLogLineNumber - offset.lineOffset;

  return { lineNumber, startColumn, endColumn };
}

function isEmptyCodeLogLine(logLine: string): boolean {
  return /^\d+\s*$/.test(logLine);
}

function constructProblem(problemMetadata: ProblemMetadata): Problem {
  const {
    type,
    location: { lineNumber, startColumn, endColumn },
  } = problemMetadata;
  const message = problemMetadata.logLines
    .map((logLine) => logLine.trim())
    .join(" ");

  return { lineNumber, startColumn, endColumn, message, type };
}

function getProblemIndexFromIndicatorLogLine(logLine: string): string | null {
  const regExp = /^\s*(?<problemIndex>\d+)$/;
  const match = logLine.match(regExp);

  return match?.groups?.problemIndex ?? null;
}

function getProblemIndexFromProblemBeginningLogLine(logLine: string): string {
  const regExp = /^(error|warning)\s*(?<problemIndex>\d+)-\d+:\s.*/i;
  const match = logLine.match(regExp);
  return match?.groups?.problemIndex ?? "-1";
}

function isProblemTypeLog(logLine: LogLine): boolean {
  return logLine.type === "error" || logLine.type === "warning";
}

function isSourceTypeLog(logLine: LogLine): boolean {
  return logLine.type === "source";
}

// "ERROR 22-322: Syntax error, expecting one of the following: ;, CANCEL, "
// "WARNING: Variable POP_100 not found in data set WORK.UNIVOUT.""
function isProblemBeginningLogLine(logLine: string): boolean {
  return /^(?<logType>error|warning)(?<errorCategory>\s*\d+-\d+)?:\s(?<message>.*)/i.test(
    logLine,
  );
}

function isProblemLocationIndicatorLogLine(logLine: string): boolean {
  return RegExpLocationIndicatorLogLine.test(logLine);
}

function isProblemIndexIndicatorLogLine(
  logLine: string,
  location: ProblemLocation,
): boolean {
  return (
    /^\s*(?<problemIndex>\d+)$/.test(logLine) &&
    isValidProblemLocation(location)
  );
}

function isValidProblemLocation(location: ProblemLocation): boolean {
  return location.lineNumber > -1;
}

function isValidOffset(offset: LocationOffset): boolean {
  return offset.lineOffset > -1;
}

// extract code information in a line of log. The line is expected as
// "229  \ttitle 'Output Dataset From PROC UNIVARIATE';" or
// "232!      quit;ods html5 close;"
function extractCodeInfoFromCodeLogLine(logLine: string): {
  lineNumber: number;
  code: string;
} | null {
  const capturingRegExp = /^(?<lineNum>\d+)!?(?<code>\s*.*)/;
  const match = logLine.match(capturingRegExp);

  return match !== null && match.groups !== undefined
    ? {
        lineNumber: parseInt(match.groups.lineNum),
        code: match.groups.code,
      }
    : null;
}
