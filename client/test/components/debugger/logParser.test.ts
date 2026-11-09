import { expect } from "chai";

import { parseDebuggerLog } from "../../../src/components/debugger/logParser";
import type { LogLine } from "../../../src/connection";

const OPTIONS = "options dsoptions=ldebug notes source;";

const describeAll = [
  "DEBUG> describe _all_;",
  "Name = a, Type = NUM, Length = 8",
  "Name = b, Type = NUM, Length = 8",
  "Name = c, Type = NUM, Length = 8",
  "Name = d, Type = NUM, Length = 8",
  "Name = e, Type = NUM, Length = 8",
  "Name = f, Type = NUM, Length = 8",
  "3                                                          The SAS System                       Monday, October 26, 2026 03:40:00 PM",
  "",
  "Name = r1, Type = CHAR, Length = 200",
  "Name = r2, Type = CHAR, Length = 200",
  "Name = r3, Type = CHAR, Length = 200",
  "Name = r4, Type = CHAR, Length = 200",
  "Name = r5, Type = CHAR, Length = 200",
  "Name = r6, Type = CHAR, Length = 200",
  "Name = c1, Type = CHAR, Length = 5",
  "Name = c2, Type = CHAR, Length = 5",
  "Name = c3, Type = CHAR, Length = 5",
  "Name = _ERROR_, Type = NUM, Length = 8",
  "Name = _N_, Type = NUM, Length = 8",
];

// Debugger output captured from SAS Viya, one entry per log line
const realTranscript: LogLine[] = [
  { type: "source", line: `2    ${OPTIONS}` },
  { type: "source", line: "3     " },
  { type: "source", line: "4    data _null_;" },
  { type: "source", line: "5        /* Test */" },
  { type: "source", line: "6        a=(1 + 2) + 3;" },
  { type: "source", line: "7        b=1 + (2 + 3);" },
  { type: "source", line: "45   run;" },
  { type: "normal", line: "" },
  { type: "normal", line: "Stopped at line 6 column 5" },
  { type: "normal", line: "   6     a=(1 + 2) + 3;" },
  { type: "normal", line: "DEBUG> " },
  { type: "normal", line: "Stepped to line 7 column 5" },
  { type: "normal", line: "   7     b=1 + (2 + 3);" },
  ...describeAll.map((line): LogLine => ({ type: "normal", line })),
  ...[
    "DEBUG> examine _all_;",
    "a = 6",
    "b = .",
    "c = .",
    "d = .",
    "e = .",
    "f = .",
    "r1 = ",
    "r2 =",
    "c1 = ",
    "_ERROR_ = 0",
    "_N_ = 1",
    "DEBUG> ",
    "Stepped to line 9 column 5",
    "   9     c=(0.1 + 0.2) + 0.3;",
  ].map((line): LogLine => ({ type: "normal", line })),
  ...describeAll.map((line): LogLine => ({ type: "normal", line })),
];

describe("DATA step debugger log parser", () => {
  it("finds the log line where the submitted code starts", () => {
    const transcript = parseDebuggerLog(realTranscript, OPTIONS);

    expect(transcript.firstCodeLogLine).to.equal(2);
  });

  it("records every stop with its location and echoed source", () => {
    const { stops } = parseDebuggerLog(realTranscript, OPTIONS);

    expect(
      stops.map(({ logLine, column, sourceText }) => ({
        logLine,
        column,
        sourceText,
      })),
    ).to.deep.equal([
      { logLine: 6, column: 5, sourceText: "a=(1 + 2) + 3;" },
      { logLine: 7, column: 5, sourceText: "b=1 + (2 + 3);" },
      { logLine: 9, column: 5, sourceText: "c=(0.1 + 0.2) + 0.3;" },
    ]);
  });

  it("collects DESCRIBE attributes and ignores page titles", () => {
    const { variables } = parseDebuggerLog(realTranscript, OPTIONS);

    expect(variables.size).to.equal(17);
    expect(variables.get("a")).to.deep.equal({
      name: "a",
      type: "NUM",
      length: 8,
    });
    expect(variables.get("r1")).to.deep.equal({
      name: "r1",
      type: "CHAR",
      length: 200,
    });
    expect([...variables.keys()].slice(-2)).to.deep.equal(["_ERROR_", "_N_"]);
  });

  it("attaches EXAMINE values only to the stop where they were reported", () => {
    const { stops } = parseDebuggerLog(realTranscript, OPTIONS);

    expect(stops[0].values.size).to.equal(0);
    expect(Object.fromEntries(stops[1].values)).to.deep.equal({
      a: "6",
      b: ".",
      c: ".",
      d: ".",
      e: ".",
      f: ".",
      r1: "",
      r2: "",
      c1: "",
      _ERROR_: "0",
      _N_: "1",
    });
    expect(stops[2].values.size).to.equal(0);
  });

  it("treats abbreviated EXAMINE as a value command and other commands as not", () => {
    const lines: LogLine[] = [
      "Stopped at line 3 column 1",
      "DEBUG> e a;",
      "a = 1",
      "DEBUG> list _all_;",
      "b = 2",
    ].map((line) => ({ type: "normal", line }));

    const { stops } = parseDebuggerLog(lines, OPTIONS);

    expect(Object.fromEntries(stops[0].values)).to.deep.equal({ a: "1" });
  });

  it("returns no stops or code start for unrelated logs", () => {
    const transcript = parseDebuggerLog(
      [
        { type: "source", line: "1    data x; set y; run;" },
        { type: "note", line: "NOTE: x = 1" },
      ],
      OPTIONS,
    );

    expect(transcript.firstCodeLogLine).to.equal(undefined);
    expect(transcript.stops).to.deep.equal([]);
    expect(transcript.variables.size).to.equal(0);
  });
});
