// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { LogLine } from "../../connection";

type ProblemType = "error" | "warning";

/* 
 there are 4 raw problems below:

  ERROR 22-322: Syntax error, expecting one of the following: (, ;.  

  ERROR 79-322: Expecting a ).

  ERROR 68-185: The function SYMPUTX is unknown, or cannot be accessed.

  ERROR 251-185: The subroutine CALL is unknown, or cannot be accessed. Check your spelling. 
                 Either it was not found in the path(s) of executable images, or there was incorrect or missing subroutine descriptor 
                 information.
*/
type RawProblem = {
  type: ProblemType; //"error" | "warning";
  lines: string[];
  problemNumber?: string;
};

/*
 there are 2 group of location lines below:

                     -------                            -
                     22                                 79
                     68
                ----
                251
*/
type RawLocationGroup = {
  indicatorLine: string;
  problemNumberLines: string[];
};

/* 
all location line groups on one source code, example:

  65       call call symputx('mac', quote(strip(emple)));
                     -------                            -
                     22                                 79
                     68
                ----
                251
*/
type RawLocationDesc = {
  sourceCodeLines: string[];
  rawLocationGroups?: RawLocationGroup[];
};

// the start column for code in log may be different with which is in source file,
// one case is the \t is converted to multiple spaces, so column offset is needed.
// the line number is different with which is in source file as well, so line offset is needed.
export type LocationOffset = {
  columnOffset: number;
  lineOffset: number;
};

export type Problem = {
  lineNumber: number;
  startColumn: number;
  endColumn: number;
  message: string;
  type: ProblemType;
};

export type ProblemLocation = {
  startColumn?: number;
  endColumn?: number;
  lineNumber?: number;
  problemNumber?: string;
};

// A problem set includes encountering one or more consecutive problems (followed by other source code log behavior endpoints)
// and error log lines that may exist prior to these problems for localization purposes
export class ProblemProcessor {
  private currentSourceCodeLines: string[];
  private rawLocationDescs: RawLocationDesc[];
  private rawProblems: RawProblem[];
  private unclaimedLocations: ProblemLocation[];

  public constructor(
    sourceCodeLine?: string[],
    private legacyLocations?: ProblemLocation[],
  ) {
    this.rawLocationDescs = [];
    this.rawProblems = [];
    this.currentSourceCodeLines = [];
    this.unclaimedLocations = [];

    if (sourceCodeLine && sourceCodeLine.length > 0) {
      this.currentSourceCodeLines.push(...sourceCodeLine);
    }
  }

  public addProblemLogLine(logLine: LogLine) {
    this.rawProblems.push(this.createRawProblem(logLine));
  }

  public appendProblemLogLine(logLine: LogLine) {
    const lastRawProblem = getLastElement(this.rawProblems);
    if (lastRawProblem) {
      lastRawProblem.lines.push(logLine.line);
    }
  }

  public addLocationIndicatorLogLine(logLine: LogLine) {
    const newRawLocationGroup: RawLocationGroup = {
      indicatorLine: logLine.line,
      problemNumberLines: [],
    };

    const lastRawLocationDesc = getLastElement(this.rawLocationDescs);
    if (
      lastRawLocationDesc &&
      lastRawLocationDesc.sourceCodeLines.join("-") ===
        this.currentSourceCodeLines.join("-")
    ) {
      lastRawLocationDesc.rawLocationGroups.push(newRawLocationGroup);
      return;
    }

    this.rawLocationDescs.push({
      sourceCodeLines: [...this.currentSourceCodeLines],
      rawLocationGroups: [newRawLocationGroup],
    });
  }

  public addProblemNumberLogLine(logLine: LogLine) {
    const lastRawLocationDesc = getLastElement(this.rawLocationDescs);
    if (!lastRawLocationDesc) {
      return;
    }

    const lastRawLocationGroup = getLastElement(
      lastRawLocationDesc.rawLocationGroups,
    );
    if (!lastRawLocationGroup || lastRawLocationGroup.indicatorLine === "") {
      return;
    }

    lastRawLocationGroup.problemNumberLines.push(logLine.line);
  }

  public isReady() {
    return this.rawProblems.length > 0;
  }

  public processProblems(offset?: LocationOffset | undefined): Problem[] {
    if (!offset) {
      return [];
    }

    const problems: Problem[] = [];
    const generalRawProblems: RawProblem[] = this.rawProblems.filter(
      (rawProblem) => rawProblem.problemNumber === undefined,
    );
    const typedRawProblems: RawProblem[] = this.rawProblems.filter(
      (rawProblem) => rawProblem.problemNumber !== undefined,
    );

    // process general problems
    problems.push(
      ...this.processGeneralProblems(
        this.currentSourceCodeLines,
        generalRawProblems,
        offset,
      ),
    );

    // process typed problems
    let unprocessedTypedRawProblems: RawProblem[] = [];
    let result: {
      problems: Problem[];
      unprocessedRawProblems: RawProblem[];
      unclaimedLocations: ProblemLocation[];
    };
    if (this.rawLocationDescs.length > 0 && typedRawProblems.length > 0) {
      const locations = processRawLocationDescs(this.rawLocationDescs, offset);
      result = this.processTypedProblems(locations, typedRawProblems);
      problems.push(...result.problems);
      unprocessedTypedRawProblems = [...result.unprocessedRawProblems];
      this.unclaimedLocations.push(...result.unclaimedLocations);
    } else if (this.rawLocationDescs.length > 0) {
      this.unclaimedLocations.push(
        ...processRawLocationDescs(this.rawLocationDescs, offset),
      );
    } else if (typedRawProblems.length > 0) {
      unprocessedTypedRawProblems = [...typedRawProblems];
    }

    // ensure that all raw problems are converted to problems
    if (
      unprocessedTypedRawProblems.length > 0 &&
      (this.legacyLocations?.length ?? 0) > 0
    ) {
      result = this.processTypedProblems(
        this.legacyLocations,
        unprocessedTypedRawProblems,
      );
      problems.push(...result.problems);
      unprocessedTypedRawProblems = [...result.unprocessedRawProblems];
    }

    if (unprocessedTypedRawProblems.length > 0) {
      problems.push(
        ...this.processGeneralProblems(
          this.currentSourceCodeLines,
          unprocessedTypedRawProblems,
          offset,
        ),
      );
    }

    return problems;
  }

  // check if the passed line is wrapped line, or a new line start, or same as previous
  // for wrapped line, it is possible that the passed line is same as previous line, in this case, keep the latter.
  public setSourceCodeLine(newSourceCodeLine: string) {
    const lastSourceCodeLine = getLastElement(this.currentSourceCodeLines);
    if (!lastSourceCodeLine) {
      this.currentSourceCodeLines = [newSourceCodeLine];
      return;
    }

    const isSameAsLast = newSourceCodeLine.trim() === lastSourceCodeLine.trim();
    if (isSameAsLast) {
      return;
    }

    const isWrappedLine = isSourceCodeLineAfterLineWrapping(newSourceCodeLine);
    if (!isWrappedLine) {
      this.currentSourceCodeLines = [newSourceCodeLine];
      return;
    }

    const lastCodeInfo = decomposeCodeLogLine(lastSourceCodeLine);
    const newCodeInfo = decomposeCodeLogLine(newSourceCodeLine);

    const isSameLineNumber = lastCodeInfo.lineNumber === newCodeInfo.lineNumber;
    const lastLine = lastCodeInfo.code.trim();
    const newLine = newCodeInfo.code.trim();
    const isSameCode = lastLine.includes(newLine) || newLine.includes(lastLine);
    const beginIndex = lastSourceCodeLine.indexOf(newLine[0]);

    if (!isSameLineNumber) {
      this.currentSourceCodeLines = [newSourceCodeLine];
      return;
    }

    if (isSameCode) {
      this.currentSourceCodeLines.pop();
      this.currentSourceCodeLines.push(
        lastSourceCodeLine.substring(0, beginIndex) + newLine,
      );
    } else {
      this.currentSourceCodeLines.push(newSourceCodeLine);
    }
  }

  public getSourceCodeLines(): string[] {
    return this.currentSourceCodeLines;
  }

  public getUnclaimedLocations(): ProblemLocation[] {
    return this.unclaimedLocations;
  }

  private processGeneralProblems(
    sourceCodeLines: string[],
    rawProblems: RawProblem[],
    offset: LocationOffset,
  ): Problem[] {
    const { lineNumber, startColumn, endColumn } = processGeneralLocation(
      sourceCodeLines,
      offset,
    );

    return rawProblems.map((rawProblem) => ({
      lineNumber,
      startColumn,
      endColumn,
      message: rawProblem.lines.map((line) => line.trim()).join(" "),
      type: rawProblem.type,
    }));
  }

  /*
    Associate the problem message with the location, with the strategy of:
      Iterate over all the locations, the order of the locations in the list is in row order:
        First, All the locations in the first row.
        Then, All the locations in the second row.
        And so on.
      For the first location, read the problem messages in the order they appear until the corresponding problem is found (based on the problem number).
      For the second location, the search will start from the location after the location at which the last found problem message, 
        and start from the beginning when it reaches the end of the column.
      Each subsequent location is searched from the location after the last location at which the problem message was found.
      *** If the list is traversed and no corresponding problem message is found, discard the location. ***
  */
  private processTypedProblems(
    locations: ProblemLocation[],
    rawProblems: RawProblem[],
  ): {
    problems: Problem[];
    unprocessedRawProblems: RawProblem[];
    unclaimedLocations: ProblemLocation[];
  } {
    const problems: Problem[] = [];
    const processedRawProblems = new Set<number>();
    const lastIndexMap = new Map<string, number>();
    const unclaimedLocations = [];
    locations.forEach((location) => {
      const problemNumber = location.problemNumber;
      const lastFoundIndex = lastIndexMap.get(problemNumber) ?? 0;
      let currentIndex = (lastFoundIndex + 1) % rawProblems.length;
      let foundIndex = undefined;
      let count = 0;
      while (count <= rawProblems.length) {
        if (
          problemNumber !== undefined &&
          rawProblems[currentIndex].problemNumber === problemNumber
        ) {
          foundIndex = currentIndex;
          break;
        }

        count++;
        currentIndex = (currentIndex + 1) % rawProblems.length;
      }

      if (foundIndex !== undefined) {
        lastIndexMap.set(problemNumber, foundIndex);
        processedRawProblems.add(foundIndex);
        const { lines, type } = rawProblems[foundIndex];
        const { lineNumber, startColumn, endColumn } = location;
        problems.push({
          lineNumber,
          startColumn,
          endColumn,
          message: lines.map((logLine) => logLine.trim()).join(" "),
          type,
        });
      } else {
        unclaimedLocations.push(location);
      }
    });

    const unprocessedRawProblems = rawProblems.filter(
      (_raw, index) => !processedRawProblems.has(index),
    );

    return { problems, unprocessedRawProblems, unclaimedLocations };
  }

  private createRawProblem(logLine: LogLine): RawProblem {
    const problemNumber = getProblemNumberFromProblemLogLine(logLine.line);
    const { line, type } = logLine;

    return {
      lines: [line],
      type: type === "error" ? "error" : "warning",
      problemNumber: problemNumber,
    };
  }
}

// decompose code information in a line of log. The line is expected as
// "229  \ttitle 'Output Dataset From PROC UNIVARIATE';" or
// "232!      quit;ods html5 close;"
export function decomposeCodeLogLine(codeLine: string): {
  lineNumber: number;
  code: string;
} | null {
  const capturingRegExp = /^(?<lineNum>\d+)\s*!?(?<code>\s*.*)/;
  const match = codeLine.match(capturingRegExp);

  return match !== null && match.groups !== undefined
    ? {
        lineNumber: parseInt(match.groups.lineNum),
        code: match.groups.code,
      }
    : null;
}

function getLastElement<T>(arr: T[]): T | null {
  const lastIndex = arr.length - 1;
  return lastIndex >= 0 ? arr[lastIndex] : null;
}

/* there are two kind of beginning log lines indicating new problem
    1) problem with this kind of beginning has location indicator in one of previous log line.
      "22" will be extracted as problem number in below log line.
      "ERROR 22-322: Syntax error, expecting one of the following: ;, CANCEL, "
    2) problem with this kind of beginning has no location indicator and it is located to the previous closest source code.
      "undefined" will be returned in below log line, which means a general problem location will be used.
      "WARNING: Variable POP_100 not found in data set WORK.UNIVOUT."
*/
function getProblemNumberFromProblemLogLine(
  logLine: string,
): string | undefined {
  const regExp = /(?<=^(warning|error)\s+)\d+(?=-\d+:\s.*)/gi;
  const match = logLine.match(regExp);
  return match?.[0] ?? undefined;
}

function processLocations(
  line: string,
  from: "indicator" | "problemNumber",
): ProblemLocation[] | null {
  switch (from) {
    case "indicator":
      return processLocationsFromIndicatorLine(line);
    case "problemNumber":
      return processLocationFromProblemNumberLine(line);
  }
}

function processLocationsFromIndicatorLine(
  indicatorLogLine: string,
): ProblemLocation[] | null {
  // example: "    ----     ---      --"
  const regExp = /[-_]+/g;
  const locations = Array.from(indicatorLogLine.matchAll(regExp), (match) => ({
    startColumn: match.index,
    endColumn: match.index + match[0].length,
  }));

  return locations.length === 0 ? null : locations;
}

// problem number log line example:
//                   22                                 79
function processLocationFromProblemNumberLine(
  problemNumberLine: string,
): ProblemLocation[] | null {
  const regExp = /\d+/g;
  const locations: ProblemLocation[] = Array.from(
    problemNumberLine.matchAll(regExp),
    (match): ProblemLocation => ({
      startColumn: match.index,
      problemNumber: match[0],
    }),
  );

  return locations.length === 0 ? null : locations;
}

function reviseLocationsFromIndicatorLine(
  indicatorLogLine: string,
  baseLocations: ProblemLocation[],
): ProblemLocation[] {
  const arr = Array.from(indicatorLogLine);
  baseLocations.forEach((location) => {
    arr[location.startColumn] = "=";
  });

  const regExp = /=[-_]*/g;
  const locations = Array.from(arr.join("").matchAll(regExp), (match) => ({
    startColumn: match.index,
    endColumn: match.index + match[0].length,
  }));

  return locations.length === 0 ? null : locations;
}

function processRawLocationDescs(
  rawLocationDescs: RawLocationDesc[],
  offset: LocationOffset,
): ProblemLocation[] {
  const locations: ProblemLocation[] = [];
  rawLocationDescs.forEach((rawLocationDesc) =>
    locations.push(...processRawLocationDesc(rawLocationDesc, offset)),
  );
  return locations;
}

function processSourceCodeLines(
  sourceCodeLines: string[],
  columnOffset: number,
): { lineNumber?: number; columnCorrection?: number } {
  if (!sourceCodeLines || sourceCodeLines.length === 0) {
    return {};
  }

  const lineNumber = decomposeCodeLogLine(sourceCodeLines[0]).lineNumber;

  // the source code log line may be separated into multiple lines, and the error occurred at the latter line,
  // in this case, must take account of the previous lines length to make start column correct.
  const leadingLines = sourceCodeLines.slice(0, -1);
  const columnCorrection = leadingLines.reduce(
    (accumulator, line) => accumulator + line.length - columnOffset + 1,
    0,
  );

  return { lineNumber, columnCorrection };
}

function processRawLocationDesc(
  rawLocationDesc: RawLocationDesc,
  offset: LocationOffset,
): ProblemLocation[] {
  const { lineNumber, columnCorrection } = processSourceCodeLines(
    rawLocationDesc.sourceCodeLines,
    offset.columnOffset,
  );

  if (lineNumber === undefined || columnCorrection === undefined) {
    return [];
  }

  const locations: ProblemLocation[] = [];
  const groups = rawLocationDesc.rawLocationGroups;
  groups.forEach((group) => {
    locations.push(...processRawLocationGroup(group));
  });

  locations.map((location) => {
    location.lineNumber = lineNumber - offset.lineOffset;
    location.startColumn =
      location.startColumn - offset.columnOffset + columnCorrection;
    location.endColumn =
      location.endColumn - offset.columnOffset + columnCorrection;
  });

  return locations;
}

/* 
  to handle the case below:

  87         data CUSTOMERS (label="Customer data for geocoding");
  88            infile datalines dlm=#' dlm=#' dlm=#;
                                    _             _
                                    24            24
                                    24            24
  ERROR 24-322: Variable name is not valid.
  ERROR 24-2: Invalid value for the DLM option.
  89            length address $ 24 city $ 24 state $ 2;

  adjust the item order in list make the items which have same startColumn placed continuously
*/
function adjustAppearanceOrder(
  locations: ProblemLocation[],
): ProblemLocation[] {
  if (locations.length < 3) {
    return locations;
  }

  const findAllMatched = (startColumn: number, problemNumber: string) => {
    const found = [];
    locations.map((location, index) => {
      if (
        location &&
        location.startColumn === startColumn &&
        location.problemNumber === problemNumber
      ) {
        locations[index] = undefined;
        found.push(location);
      }
    });
    return found;
  };

  const orderedLocations: ProblemLocation[] = [];
  locations.forEach((location, index) => {
    if (!location) {
      return;
    }
    orderedLocations.push(location);
    locations[index] = undefined;
    const found = findAllMatched(location.startColumn, location.problemNumber);
    orderedLocations.push(...found);
  });

  return orderedLocations;
}

function processRawLocationGroup(
  group: RawLocationGroup,
): ProblemLocation[] | null {
  if (
    !group.indicatorLine ||
    !group.problemNumberLines ||
    group.problemNumberLines.length === 0
  ) {
    return null;
  }

  let indicatorLocations = processLocations(group.indicatorLine, "indicator");

  const problemNumberLocations = processLocations(
    group.problemNumberLines[0],
    "problemNumber",
  );

  // to handle this case:
  //                         _____
  //                         1   22
  if (problemNumberLocations.length > indicatorLocations.length) {
    indicatorLocations = reviseLocationsFromIndicatorLine(
      group.indicatorLine,
      problemNumberLocations,
    );
  }

  // TODO
  if (problemNumberLocations.length < indicatorLocations.length) {
    // is it possible to have such case:
    //                        - -
    //                        221
    // is it possible to have such case, below includes two problems:
    //                        ---
    //                        221
  }

  const locations: ProblemLocation[] = [];
  group.problemNumberLines.forEach((line) => {
    const locationsWithProblemNumber = processLocations(line, "problemNumber");
    locationsWithProblemNumber.forEach((location1) => {
      const found = indicatorLocations.find(
        (location2) => location2.startColumn === location1.startColumn,
      );

      if (found) {
        locations.push({
          startColumn: found.startColumn,
          endColumn: found.endColumn,
          problemNumber: location1.problemNumber,
        });
      }
    });
  });

  return adjustAppearanceOrder(locations);
}

function processGeneralLocation(
  sourceCodeLines: string[],
  offset: LocationOffset,
): ProblemLocation | null {
  if (!sourceCodeLines || sourceCodeLines.length === 0 || !offset) {
    return null;
  }

  const lineNumber =
    decomposeCodeLogLine(sourceCodeLines[0]).lineNumber - offset.lineOffset;
  const wholeLine = sourceCodeLines.reduce(
    (accumulator, line) => accumulator + line.substring(offset.columnOffset),
  );

  const startColumn = getFirstCharacterIndex(wholeLine) - offset.columnOffset;
  const endColumn =
    startColumn + wholeLine.substring(startColumn).trim().length - 1;
  return { lineNumber, startColumn, endColumn };
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

/* 
  below are 3 cases that source code may be presented in log lines.
  8  ...

  8 !      ...

  8!      ...
*/
export function isSourceCodeLineAfterLineWrapping(logLine: string): boolean {
  return /^(?<lineNum>\d+)\s*!\s(?<code>\s*.*)/.test(logLine);
}
