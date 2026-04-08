// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { LogLine } from "../../connection";

// VS Code's built-in `application/vnd.code.notebook.error` renderer processes.
const A_RED = "\u001b[0;31m"; // separator line, error-type name
const A_GREEN = "\u001b[0;32m"; // file path
const A_CYAN = "\u001b[0;36m"; // line number, frame/function name
const A_RESET = "\u001b[0m"; // reset to default

export interface PythonError {
  /** Exception class name, e.g. "NameError" */
  name: string;
  /** Exception message without the class prefix */
  message: string;
  /** Full ANSI-coded traceback string. */
  stack: string;
}

const PYTHON_PROMPT_REGEX = /^>>> ?$/;
const UNHANDLED_PYTHON_EXCEPTION = "Unhandled Python exception";

export interface PythonProcessedOutput {
  /** True when the Python interpreter itself raised an exception */
  isPythonError: boolean;
  /** True when SAS (not Python) raised an error (e.g. Python not installed) */
  isSASError: boolean;
  /**
   * For stdout output (success) or SAS-error lines: LogLine[] ready for the
   * existing log renderer.
   */
  outputLines: LogLine[];
  /**
   * For Python exceptions: the raw traceback text lines to be passed to the
   * PythonErrorRenderer.
   */
  errorLines: string[];
  /**
   * Raw HTML from a `_repr_html_()` call, ready to be wrapped and shown via
   * the HTML renderer.  Null when the auto-print expression did not produce
   * an HTML representation.
   */
  htmlRepr: string | null;
}

/**
 * Parses the raw SAS log lines produced by a PROC PYTHON execution and
 * extracts only the information that is meaningful for a notebook cell:
 *
 * - Python stdout/stderr (between the `>>>` prompt markers)
 * - Python tracebacks (after `ERROR: Unhandled Python exception.`)
 * - SAS-level errors when Python itself could not be invoked
 *
 * All SAS boilerplate (NOTE lines, source-code echo, timing info, etc.) is
 * silently discarded.
 */
export function processPythonLog(logs: LogLine[]): PythonProcessedOutput {
  const isPythonError = logs.some(
    (l) => l.type === "error" && l.line.includes(UNHANDLED_PYTHON_EXCEPTION),
  );

  // A SAS-level error is any error that is NOT the "Unhandled Python exception"
  // sentinel – meaning something went wrong before or outside the Python code
  // itself (e.g. Python not installed, syntax error in PROC PYTHON statement).
  const isSASError =
    !isPythonError &&
    logs.some(
      (l) => l.type === "error" && !l.line.includes(UNHANDLED_PYTHON_EXCEPTION),
    );

  if (isPythonError) {
    const errorLines = extractPythonOutputText(logs);
    return {
      isPythonError: true,
      isSASError: false,
      outputLines: [],
      errorLines,
      htmlRepr: null,
    };
  }

  if (isSASError) {
    const outputLines = logs.filter(
      (l) => l.type === "error" || l.type === "warning",
    );
    return {
      isPythonError: false,
      isSASError: true,
      outputLines,
      errorLines: [],
      htmlRepr: null,
    };
  }

  // Success path – extract Python stdout and any _repr_html_() payload.
  const outputText = extractPythonOutputText(logs);
  const { html: htmlRepr, remaining } = extractHtmlRepr(outputText);
  const outputLines: LogLine[] = remaining.map((text) => ({
    type: "normal" as const,
    line: text,
  }));

  return {
    isPythonError: false,
    isSASError: false,
    outputLines,
    errorLines: [],
    htmlRepr,
  };
}

/**
 * Parses a plain-text Python traceback (as extracted from the SAS log) and
 * reconstructs it.  The result is suitable for use as the `stack` field of
 * `vscode.NotebookCellOutputItem.error()`, which uses VS Code's built-in renderer.
 *
 * Traceback structure (with ANSI codes):
 *   \u001b[0;31m---75 dashes---\u001b[0m
 *   \u001b[0;31mNameError\u001b[0m       Traceback (most recent call last)
 *     File \u001b[0;32m"<stdin>"\u001b[0m, line \u001b[0;36m5\u001b[0m, in \u001b[0;36m<module>\u001b[0m
 *   \u001b[0;31mNameError\u001b[0m: name 'asdf' is not defined
 */
export function buildPythonError(plainLines: string[]): PythonError {
  let tracebackHeader = "Traceback (most recent call last)";
  let errorName = "";
  let errorMessage = "";
  const bodyLines: string[] = [];

  const nonEmpty = plainLines.filter((l) => l.trim() !== "");
  const lastLine = nonEmpty.length > 0 ? nonEmpty[nonEmpty.length - 1] : "";

  for (const line of plainLines) {
    // Skip the "Traceback (most recent call last):" opener — we rebuild it.
    if (/^Traceback/.test(line)) {
      tracebackHeader = line.replace(/:$/, "");
      continue;
    }

    // Detect the final "ErrorType: message" line (unindented, capitalized name).
    if (!line.startsWith(" ") && !line.startsWith("\t") && line.trim()) {
      const m = /^([A-Za-z][A-Za-z0-9_.]*)(:[ ]?(.*))?$/.exec(line.trim());
      if (
        m &&
        (/Error|Exception|Warning|KeyboardInterrupt|SystemExit|StopIteration|GeneratorExit|BaseException/.test(
          m[1],
        ) ||
          line === lastLine)
      ) {
        errorName = m[1];
        errorMessage = m[3] ?? "";
        continue;
      }
    }

    bodyLines.push(line);
  }

  const ansiLines: string[] = [];

  // 1. Red separator
  ansiLines.push(`${A_RED}${"-".repeat(75)}${A_RESET}`);

  // 2. "ErrorType          Traceback (most recent call last)"
  if (errorName) {
    const pad = Math.max(1, 42 - errorName.length);
    ansiLines.push(
      `${A_RED}${errorName}${A_RESET}${" ".repeat(pad)}${tracebackHeader}`,
    );
  } else {
    ansiLines.push(tracebackHeader);
  }

  // 3. Body lines — apply green to file paths, cyan to line numbers & frames
  for (const line of bodyLines) {
    //   File "<stdin>", line 5, in <module>
    const fm = /^(\s*File )(".*?")(, line )(\d+)((?:, in )(.+))?$/.exec(line);
    if (fm) {
      const [, prefix, filePath, lineText, lineNum, inPart = "", frame = ""] =
        fm;
      const frameColored = frame ? `${A_CYAN}${frame}${A_RESET}` : "";
      ansiLines.push(
        `${prefix}${A_GREEN}${filePath}${A_RESET}${lineText}${A_CYAN}${lineNum}${A_RESET}${inPart ? `, in ` : ""}${frameColored}`,
      );
    } else {
      ansiLines.push(line);
    }
  }

  // 4. Final "ErrorType: message" line
  if (errorName) {
    ansiLines.push(`${A_RED}${errorName}${A_RESET}: ${errorMessage}`);
  }

  return {
    name: errorName,
    message: errorMessage,
    stack: ansiLines.join("\n"),
  };
}

/**
 * Scans `outputLines` for the `__SAS_EXT_HTML_START__` / `__SAS_EXT_HTML_END__`
 * markers emitted by the auto-print `_repr_html_()` injection.  When found,
 * the base64-encoded HTML between the markers is decoded and returned as
 * `html`; lines outside the markers are returned as `remaining`.
 */
function extractHtmlRepr(outputLines: string[]): {
  html: string | null;
  remaining: string[];
} {
  const startIdx = outputLines.findIndex(
    (l) => l.trim() === "__SAS_EXT_HTML_START__",
  );
  const endIdx = outputLines.findIndex(
    (l) => l.trim() === "__SAS_EXT_HTML_END__",
  );

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return { html: null, remaining: outputLines };
  }

  const b64 = outputLines
    .slice(startIdx + 1, endIdx)
    .map((l) => l.trim())
    .join("");

  let html: string | null = null;
  try {
    html = Buffer.from(b64, "base64").toString("utf-8");
  } catch {
    // Decoding failure → treat as no HTML repr
  }

  const remaining = [
    ...outputLines.slice(0, startIdx),
    ...outputLines.slice(endIdx + 1),
  ];

  return { html, remaining };
}

/**
 * Finds content between the last pair of `>>>` prompt lines in the "normal"
 * type log lines.  Returns an empty array when there is no meaningful output
 * (i.e. the section between the prompts is blank).
 *
 * Structure of a PROC PYTHON log (normal-type lines only):
 *   ">>> "        ← prompt after Python init (first run) or code submission
 *   ...           ← Python stdout / traceback
 *   ">>> "        ← closing prompt
 */
function extractPythonOutputText(logs: LogLine[]): string[] {
  const normalLines = logs.filter((l) => l.type === "normal");

  const promptIndices: number[] = normalLines
    .map((l, i) => ({ line: l.line.trim(), i }))
    .filter(({ line }) => PYTHON_PROMPT_REGEX.test(line))
    .map(({ i }) => i);

  if (promptIndices.length < 2) {
    return [];
  }

  const startIdx = promptIndices[promptIndices.length - 2];
  const endIdx = promptIndices[promptIndices.length - 1];

  const outputLines = normalLines
    .slice(startIdx + 1, endIdx)
    .map((l) => l.line);

  // Suppress trivially empty output (just whitespace)
  if (!outputLines.some((l) => l.trim() !== "")) {
    return [];
  }

  return outputLines;
}
