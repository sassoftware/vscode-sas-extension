import type { ActivationFunction } from "vscode-notebook-renderer";

const COLOR_RED = "#e75c58"; // ansi-red-fg  (separator, error type name)
const COLOR_GRAY = "#808080"; // dimmed text  (file refs, "Traceback…" label, ":" + message)

/** Width of the separator line */
const SEPARATOR = "-".repeat(75);

/**
 * Renders Python tracebacks:
 *
 *   ───────────────────────────────────────────  (red separator)
 *   NameError             Traceback (most recent call last)
 *     File "<stdin>", line 5, in <module>        (gray)
 *     File "<string>", line 11, in <module>      (gray)
 *
 *   NameError: name 'foo' is not defined        (bold-red name, gray rest)
 *
 * Input data: string[] – plain-text traceback lines extracted from the SAS
 * log (content between the last pair of `>>>` prompt markers after an
 * "Unhandled Python exception" error).
 */
export const activate: ActivationFunction = () => ({
  renderOutputItem(data, element) {
    const lines: string[] = data.json();
    if (!lines.length) {
      element.replaceChildren();
      return;
    }

    // ── Parse the traceback structure ───────────────────────────────────────
    //
    // Standard Python traceback layout:
    //   Traceback (most recent call last):          ← always first
    //     File "…", line N, in <frame>              ← 0..N file refs
    //     <optional code context lines>
    //   SomeError: the error message                ← always last
    //

    let tracebackLabel = "Traceback (most recent call last)";
    let errorTypeName = "";
    let errorRest = "";
    const bodyLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith("Traceback")) {
        // Strip the trailing colon if present so we can reformat freely.
        tracebackLabel = line.replace(/:$/, "");
        continue;
      }

      // Match  "SomeName: message"  or bare  "SomeName"  on the last line.
      // We use a broad pattern: starts with an uppercase letter and contains
      // only identifier characters before the colon (or end-of-line).
      const errMatch = /^([A-Za-z][A-Za-z0-9_]*)(:?.*)$/.exec(line);
      if (
        errMatch &&
        !line.startsWith(" ") &&
        !line.startsWith("\t") &&
        // Must look like an exception name (contains "Error", "Exception",
        // etc.) OR be the very last non-empty line of the traceback.
        (/Error|Exception|Warning|KeyboardInterrupt|SystemExit|StopIteration|GeneratorExit|BaseException/.test(
          errMatch[1],
        ) ||
          line === lines.filter((l) => l.trim()).slice(-1)[0])
      ) {
        errorTypeName = errMatch[1];
        const rest = errMatch[2]; // includes the leading ":"
        errorRest = rest;
        continue;
      }

      bodyLines.push(line);
    }

    // ── Build the DOM ────────────────────────────────────────────────────────
    const pre = document.createElement("pre");
    pre.style.fontFamily = "var(--vscode-editor-font-family)";
    pre.style.fontSize = "var(--vscode-editor-font-size)";
    pre.style.whiteSpace = "pre";
    pre.style.margin = "0";
    pre.style.padding = "4px 8px";
    pre.style.background =
      "color-mix(in srgb, var(--vscode-inputValidation-errorBackground, #5a1d1d) 25%, transparent)";

    /** Create a styled inline span. */
    const span = (
      content: string,
      color: string,
      bold = false,
    ): HTMLSpanElement => {
      const s = document.createElement("span");
      s.textContent = content;
      s.style.color = color;
      if (bold) {
        s.style.fontWeight = "bold";
      }
      return s;
    };
    /** Create a plain text node (used for whitespace and newlines). */
    const text = (t: string) => document.createTextNode(t);

    // 1. Red separator
    pre.appendChild(span(SEPARATOR, COLOR_RED));
    pre.appendChild(text("\n"));

    // 2. "ErrorType            Traceback (most recent call last)" header
    if (errorTypeName) {
      // Left side: error type name, right-padded so "Traceback…" aligns
      const padLen = Math.max(1, 42 - errorTypeName.length);
      pre.appendChild(span(errorTypeName, COLOR_RED, true));
      pre.appendChild(text(" ".repeat(padLen)));
      pre.appendChild(span(tracebackLabel, COLOR_GRAY));
    } else {
      pre.appendChild(span(tracebackLabel, COLOR_GRAY));
    }
    pre.appendChild(text("\n"));

    // 3. Body lines (file references, code context snippets)
    for (const line of bodyLines) {
      if (line.trim().startsWith("File ") || line.trimStart() !== line) {
        // Indented lines = file/frame refs → dimmed gray
        pre.appendChild(span(line, COLOR_GRAY));
      } else {
        pre.appendChild(text(line));
      }
      pre.appendChild(text("\n"));
    }

    // 4. Blank separator before the final error message
    pre.appendChild(text("\n"));

    // 5. "ErrorType: message" (error type bold-red, colon+message gray)
    if (errorTypeName) {
      pre.appendChild(span(errorTypeName, COLOR_RED, true));
      if (errorRest) {
        pre.appendChild(span(errorRest, COLOR_GRAY));
      }
      pre.appendChild(text("\n"));
    }

    element.replaceChildren(pre);
  },
});
