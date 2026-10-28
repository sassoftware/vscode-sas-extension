// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { LogLine } from "../../connection";

export interface DebuggerVariableInfo {
  name: string;
  type: string;
  length: number;
}

export interface DebuggerStop {
  /** Line number as reported in the SAS log, not the document */
  logLine: number;
  column: number;
  /** Source text SAS echoes after the stop message, when present */
  sourceText?: string;
  /** Values reported by EXAMINE while stopped here, in output order */
  values: Map<string, string>;
}

export interface DebuggerTranscript {
  /** SAS log line number of the first submitted statement */
  firstCodeLogLine?: number;
  /** Variable attributes reported by DESCRIBE, in output order */
  variables: Map<string, DebuggerVariableInfo>;
  stops: DebuggerStop[];
}

const STOP_PATTERN = /^(?:Stopped at|Stepped to) line (\d+) column (\d+)$/;
const PROMPT_PATTERN = /^DEBUG>\s*(.*)$/;
const DESCRIBE_PATTERN = /^Name = ([^,\s]+), Type = (\w+), Length = (\d+)/;
const VALUE_PATTERN = /^([A-Za-z_][\w.]*) =(?: (.*))?$/;
const SOURCE_ECHO_PATTERN = /^(\d+)\s+(.*)$/;

const isExamineCommand = (command: string): boolean => {
  const word = command.split(/[\s;]/)[0].toLowerCase();
  return word.length > 0 && "examine".startsWith(word);
};

/**
 * Parses the log of a completed DATA step debugger job.
 *
 * @param firstStatement the first statement submitted with the job, used to
 * find where the submitted code starts in the log's line numbering
 */
export function parseDebuggerLog(
  lines: LogLine[],
  firstStatement: string,
): DebuggerTranscript {
  const transcript: DebuggerTranscript = {
    variables: new Map(),
    stops: [],
  };
  let currentStop: DebuggerStop | undefined;
  let awaitingSourceEcho = false;
  let examining = false;

  for (const entry of lines) {
    const text = entry.line?.trim() ?? "";
    if (!text) {
      continue;
    }

    if (awaitingSourceEcho) {
      awaitingSourceEcho = false;
      const echo = SOURCE_ECHO_PATTERN.exec(text);
      if (echo && Number(echo[1]) === currentStop.logLine) {
        currentStop.sourceText = echo[2];
        continue;
      }
    }

    const stop = STOP_PATTERN.exec(text);
    if (stop) {
      currentStop = {
        logLine: Number(stop[1]),
        column: Number(stop[2]),
        values: new Map(),
      };
      transcript.stops.push(currentStop);
      awaitingSourceEcho = true;
      examining = false;
      continue;
    }

    const prompt = PROMPT_PATTERN.exec(text);
    if (prompt) {
      examining = isExamineCommand(prompt[1]);
      continue;
    }

    const describe = DESCRIBE_PATTERN.exec(text);
    if (describe) {
      transcript.variables.set(describe[1], {
        name: describe[1],
        type: describe[2].toUpperCase(),
        length: Number(describe[3]),
      });
      continue;
    }

    if (transcript.firstCodeLogLine === undefined) {
      const echo = SOURCE_ECHO_PATTERN.exec(text);
      if (echo && echo[2].trim() === firstStatement.trim()) {
        transcript.firstCodeLogLine = Number(echo[1]);
        continue;
      }
    }

    if (examining && currentStop) {
      const value = VALUE_PATTERN.exec(text);
      if (value) {
        currentStop.values.set(value[1], value[2] ?? "");
      }
    }
  }

  return transcript;
}
