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

export type ProblemLocation = {
  startColumn: number;
  endColumn: number;
  lineNumber: number;
  problemIndex?: string;
};

// the start column for code in log may be different with which is in source file,
// one case is the \t is converted to multiple spaces, so column offset is needed.
// the line number is different with which is in source file as well, so line offset is needed.
type LocationOffset = {
  columnOffset: number;
  lineOffset: number;
};

type ProblemMetadata = {
  lines: string[];
  location: ProblemLocation;
  type: ProblemType; //"error" | "warning";
};

export function parseLog(
  logs: LogLine[],
  firstCodeLine: string,
): Problem[] | null {
  if (logs.length === 0 || firstCodeLine.trim() === "") {
    return null;
  }

  // logs cleaning
  const latestLogs = filterOutTheLatestLogs(logs, firstCodeLine);
  const problemRelatedLogs = filterOutProblemRelatedLogs(latestLogs);

  /* 
    it provide parsed available locations for creating problem
    when to add:
      1. encounter a valid (not blank) source type log line:
        -- a common problem location will be added in this case, which indicates the problem occurred at a whole source code line.
          -- the lineNumber field is the line number of this source code in source file.
          -- the startColumn field is the index of the first character in source file.
          -- the endColumn field is the startColumn plus the length of the source code in source file.
          -- the problemIndex is undefined, it means the problem is located in whole source code line.
          ** the common problem location will be updated when encountering next valid source type log line
      2. encounter a error/warning type log line which includes location indicators only:
        -- a pinpoint problem location will be added, which indicates the problem occurred at a symbol in a source code line.
          -- the lineNumber field is the line number of the closest previous source code.
          -- the startColumn field is the index of the first hyphen/underscore of a continuous hyphen/underscore string
          -- the endColumn field is the index of the last hyphen/underscore of a continuous hyphen/underscore string.
          -- the problemIndex is -1 and will be updated later.
      3. there are more than 1 problem indices existed at same location:
        -- the lineNumber, startColumn and endColumn are same between those problem indices
        -- the problemIndex will be assigned to different actual problem index.
    when to update problemIndex in a problem location:
      1. encounter a error/warning type log line which includes problem indices only:
        -- can find the location which has same lineNumber and startColumn?
          -- yes: is the problemIndex -1?
            -- yes: update it with the actual problem index gained from this log line.
            -- no: see #3 in "when to add" section.
          -- no: discard.
    when to remove:
      1. encounter a error/warning type log line which indicates a new problem begin:
        -- can the problem index in this log line be parsed?
          -- yes: get this problem index and generate problem metadata then remove this location with this problem index.
          -- no: get the common problem location in which problem index is undefined, but this location WILL NOT be removed.
  */
  const availableLocations: Set<ProblemLocation> = new Set();
  /* 
  due to exist such case that a problem index may occur more than one time in same source code line
  but the relevant problem message only occur once. 
  So when encounter such problem message, there should be actual amount of problem metadata created.
  Consider the problem index 200 in follow log snippet
  
  275        connect to &dbms as mydb (&CONNOPT);
                        _              _
                        22             79
                        200            200
  WARNING: Apparent symbolic reference DBMS not resolved.
  WARNING: Apparent symbolic reference CONNOPT not resolved.
  ERROR 22-322: Expecting a name.  "
  ERROR 79-322: Expecting a )."
  ERROR 200-322: The symbol is not recognized and will be ignored."
  NOTE: PROC SQL set option NOEXEC and will continue to check the syntax of statements."
  */
  let problemMetadataList: ProblemMetadata[];
  let offset: LocationOffset;
  let currentCodeLogLine = "";
  const problems: Problem[] = [];

  problemRelatedLogs.forEach((logLine) => {
    if (isProblemTypeLog(logLine)) {
      // if this log line indicates a new problem,
      // then construct problems from existing problem metadata list,
      // and create a new problem metadata list for the new problems.
      if (isNewProblemLogLine(logLine.line)) {
        addProblem(problems, problemMetadataList);

        problemMetadataList = createNewProblemMetadataList(
          logLine,
          availableLocations,
        );

        removeUsedProblemLocation(
          availableLocations,
          problemMetadataList[0].location.problemIndex,
        );

        return;
      }

      // if this log line includes location indicators only,
      // add available problem locations with problem index is -1,
      // which will be updated when processing log line which includes problem indices.
      if (isLocationIndicatorLogLine(logLine.line)) {
        const newLocations = generatePinpointProblemLocations(
          logLine.line,
          currentCodeLogLine,
          offset,
        );
        addPinpointProblemLocations(availableLocations, newLocations);

        return;
      }

      // if this log line includes problem indices only,
      // extract problem indices and update available locations list
      if (isProblemIndexLogLine(logLine.line /* problemMetadata.location */)) {
        const problemIndices = extractProblemIndicesFromProblemIndexLogLine(
          logLine.line,
          currentCodeLogLine,
          offset,
        );
        updatePinpointProblemLocations(availableLocations, problemIndices);

        return;
      }

      // if not above case, append line in current problem metadata
      problemMetadataList.forEach((problemMetadata) =>
        problemMetadata.lines.push(logLine.line),
      );

      return;
    } else {
      addProblem(problems, problemMetadataList);
      problemMetadataList = undefined;

      if (isValidSourceCodeLog(logLine)) {
        currentCodeLogLine = logLine.line;

        if (!offset) {
          offset = calculateLocationOffset(logLine.line, firstCodeLine);
        }

        const commonProblemLocation = generateCommonProblemLocation(
          logLine.line,
          offset,
        );
        updateCommonProblemLocation(availableLocations, commonProblemLocation);

        return;
      }
    }
  });

  addProblem(problems, problemMetadataList);
  problemMetadataList = undefined;

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
  const regexToMatchFirstNonSpaces = /\S/;
  const firstCharIndexInCode =
    firstCodeLine.match(regexToMatchFirstNonSpaces)?.index ?? -1;
  const firstCharIndexInLog =
    codeInfo.code.match(regexToMatchFirstNonSpaces)?.index ?? -1;
  const lineNumberLength = codeInfo.lineNumber.toString().length;
  const columnOffset =
    firstCharIndexInLog - firstCharIndexInCode + lineNumberLength;

  return { columnOffset, lineOffset };
}

function getFirstCharacterIndex(logLine: string): number {
  if (logLine.trim() === "") {
    return -1;
  }

  /* 
  below are 3 cases that source code may be presented in log lines.
  8  ...

  8 !      ...

  12!      ...
  */
  const regExp = /(?<=^\d+\s*!?\s+)[^\s!]/;
  const match = logLine.match(regExp);

  return match === null ? -1 : match.index;
}

function createNewProblemMetadataList(
  logLine: LogLine,
  availableLocations: Set<ProblemLocation>,
): ProblemMetadata[] {
  const problemIndex = extractProblemIndexFromNewProblemLogLine(logLine.line);
  const locations = getProblemLocations(availableLocations, problemIndex);
  const problemMetadataList: ProblemMetadata[] = [];
  const { line, type } = logLine;
  locations.forEach((location) => {
    problemMetadataList.push({
      lines: [line],
      type: type === "error" ? "error" : "warning",
      location,
    });
  });

  return problemMetadataList;
}

function constructProblem(problemMetadata: ProblemMetadata): Problem {
  const {
    type,
    location: { lineNumber, startColumn, endColumn },
  } = problemMetadata;
  const message = problemMetadata.lines
    .map((logLine) => logLine.trim())
    .join(" ");

  return { lineNumber, startColumn, endColumn, message, type };
}

function addProblem(
  problems: Problem[],
  problemMetadataList: ProblemMetadata[] | undefined,
) {
  if (!problemMetadataList) {
    return;
  }

  problemMetadataList.forEach((problemMetadata) => {
    const problem = constructProblem(problemMetadata);
    problems.push(problem);
    problemMetadata = undefined;
  });

  problemMetadataList = undefined;
}

function generatePinpointProblemLocations(
  indicatorLogLine: string,
  codeLogLine: string,
  offset: LocationOffset,
): ProblemLocation[] | null {
  // example: "    ----     ---      --"
  const regExp = /[-_]+/g;
  const matches = Array.from(
    indicatorLogLine.matchAll(regExp),
    (match) => match,
  );

  if (matches.length === 0) {
    return null;
  }

  const codeLogLineNumber =
    extractCodeInfoFromCodeLogLine(codeLogLine).lineNumber;

  const locations = matches.map((match) => ({
    lineNumber: codeLogLineNumber - offset.lineOffset,
    startColumn: match.index - offset.columnOffset,
    endColumn: match.index - offset.columnOffset + match[0].length,
    problemIndex: "-1",
  }));

  return locations;
}

function generateCommonProblemLocation(
  codeLogLine: string,
  offset: LocationOffset,
): ProblemLocation {
  const { code, lineNumber: codeLogLineNumber } =
    extractCodeInfoFromCodeLogLine(codeLogLine);
  const startColumn = getFirstCharacterIndex(codeLogLine) - offset.columnOffset;
  const endColumn = startColumn + code.trim().length;
  const lineNumber = codeLogLineNumber - offset.lineOffset;

  return { lineNumber, startColumn, endColumn };
}

// problem index log line example:
//                   22                                 79
function extractProblemIndicesFromProblemIndexLogLine(
  problemIndexLine: string,
  codeLogLine: string,
  offset: LocationOffset,
): ProblemLocation[] | null {
  const codeLogLineNumber =
    extractCodeInfoFromCodeLogLine(codeLogLine).lineNumber;
  const regExp = /\d+/g;
  const problemIndices = Array.from(
    problemIndexLine.matchAll(regExp),
    (match) => ({
      lineNumber: codeLogLineNumber - offset.lineOffset,
      startColumn: match.index - offset.columnOffset,
      endColumn: match.index - offset.columnOffset, // this is not used, so set as same as startColumn at random
      problemIndex: match[0],
    }),
  );

  return problemIndices.length === 0 ? null : problemIndices;
}

/* there are two kind of beginning log lines indicating new problem
  1) problem with this kind of beginning has location indicator in one of previous log line.
     "22" will be extracted as problem index in below log line.
    "ERROR 22-322: Syntax error, expecting one of the following: ;, CANCEL, "
  2) problem with this kind of beginning has no location indicator and it is located to the previous closest source code.
     "undefined" will be returned in below log line, which means a common problem location will be used.
    "WARNING: Variable POP_100 not found in data set WORK.UNIVOUT."
*/
function extractProblemIndexFromNewProblemLogLine(
  logLine: string,
): string | undefined {
  const regExp = /(?<=^(warning|error)\s+)\d+(?=-\d+:\s.*)/gi;
  const match = logLine.match(regExp);
  return match?.[0] ?? undefined;
}

// extract code information in a line of log. The line is expected as
// "229  \ttitle 'Output Dataset From PROC UNIVARIATE';" or
// "232!      quit;ods html5 close;"
function extractCodeInfoFromCodeLogLine(codeLine: string): {
  lineNumber: number;
  code: string;
} | null {
  const capturingRegExp = /^(?<lineNum>\d+)!?(?<code>\s*.*)/;
  const match = codeLine.match(capturingRegExp);

  return match !== null && match.groups !== undefined
    ? {
        lineNumber: parseInt(match.groups.lineNum),
        code: match.groups.code,
      }
    : null;
}

function getProblemLocations(
  availableLocations: Set<ProblemLocation>,
  problemIndex?: string,
): ProblemLocation[] | undefined {
  const matched: ProblemLocation[] = [];
  availableLocations.forEach((location) => {
    if (location.problemIndex === problemIndex) {
      matched.push(location);
    }
  });

  return matched;
}

function addPinpointProblemLocations(
  availableLocations: Set<ProblemLocation>,
  newLocations: ProblemLocation[] | null,
): void {
  if (newLocations === null) {
    return;
  }

  newLocations.forEach((location) => availableLocations.add(location));
}

function updatePinpointProblemLocations(
  availableLocations: Set<ProblemLocation>,
  problemIndices: ProblemLocation[],
): void {
  if (problemIndices !== null) {
    problemIndices.forEach((withProblemIndex) => {
      availableLocations.forEach((location) => {
        if (
          location.lineNumber === withProblemIndex.lineNumber &&
          location.startColumn === withProblemIndex.startColumn &&
          location.problemIndex !== withProblemIndex.problemIndex &&
          location.problemIndex !== undefined
        ) {
          if (location.problemIndex === "-1") {
            location.problemIndex = withProblemIndex.problemIndex;
          } else {
            // create new location if different problem indices at same location
            availableLocations.add({
              ...location,
              problemIndex: withProblemIndex.problemIndex,
            });
          }
        }
      });
    });
  }
}

function updateCommonProblemLocation(
  availableLocations: Set<ProblemLocation>,
  newCommonProblemLocation: ProblemLocation,
): void {
  // there is always one and only one common problem location
  const commonProblemLocation = getProblemLocations(availableLocations)[0];

  if (!commonProblemLocation) {
    availableLocations.add(newCommonProblemLocation);
  } else {
    commonProblemLocation.lineNumber = newCommonProblemLocation.lineNumber;
    commonProblemLocation.startColumn = newCommonProblemLocation.startColumn;
    commonProblemLocation.endColumn = newCommonProblemLocation.endColumn;
  }
}

function removeUsedProblemLocation(
  availableLocations: Set<ProblemLocation>,
  problemIndex: string,
): void {
  // common problem location will not be removed.
  if (!problemIndex) {
    return;
  }

  availableLocations.forEach((location) => {
    if (location.problemIndex === problemIndex) {
      availableLocations.delete(location);
    }
  });
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
  return /^(?<space>\s*)(?<indicator>[-_]+\s*)+$/.test(logLine);
}

/*
the number below the continuous hyphens/underscores means a problem index.
in below logs, the 3rd & 4th & 6th lines are problem index log lines.
below are part of logs:
18       call call symputx('mac', quote(strip(emple)));            
                   -------                            -
                   22                                 79
                   68
              ----
              251
*/
function isProblemIndexLogLine(line: string): boolean {
  return /^(?<space>\s*)(?<problemIndex>\d+\s*)+$/.test(line);
}

function isValidSourceCodeLog(logLine: LogLine): boolean {
  return isSourceTypeLog(logLine) && !isEmptyCodeLogLine(logLine.line);
}
