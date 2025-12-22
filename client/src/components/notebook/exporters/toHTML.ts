// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ColorThemeKind,
  NotebookCell,
  NotebookCellKind,
  NotebookCellOutput,
  NotebookDocument,
  TextDocument,
  window,
} from "vscode";
import {
  LanguageClient,
  SemanticTokensRequest,
} from "vscode-languageclient/node";

import { readFileSync } from "fs";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";
import path from "path";

import type { LogLine } from "../../../connection";
import { includeLogInNotebookExport } from "../../utils/settings";

const templatesDir = path.resolve(__dirname, "../notebook/exporters/templates");

hljs.registerLanguage("python", python);
hljs.registerLanguage("sql", sql);

// Configure marked options
marked.setOptions({
  breaks: false,
  gfm: false,
});

// Enable KaTeX extension for marked
marked.use(markedKatex());

export const exportToHTML = async (
  notebook: NotebookDocument,
  client: LanguageClient,
) => {
  const cells = notebook.getCells();

  let template = readFileSync(`${templatesDir}/default.html`).toString();

  const isDark =
    window.activeColorTheme.kind === ColorThemeKind.Dark ||
    window.activeColorTheme.kind === ColorThemeKind.HighContrast;
  const theme = readFileSync(
    `${templatesDir}/${isDark ? "dark" : "light"}.css`,
  ).toString();

  // Read KaTeX CSS from templates directory (copied from node_modules during build)
  const katexCss = readFileSync(`${templatesDir}/katex.css`).toString();

  template = template.replace("${katex}", katexCss);
  template = template.replace("${theme}", theme);
  template = template.replace("${content}", await exportCells(cells, client));

  return template;
};

const exportCells = async (cells: NotebookCell[], client: LanguageClient) => {
  let result = "";

  for (const cell of cells) {
    if (cell.kind === NotebookCellKind.Markup) {
      result += markdownToHTML(cell.document) + "\n";
    } else {
      result += (await codeToHTML(cell.document, client)) + "\n";
      if (cell.outputs.length > 0) {
        for (const output of cell.outputs) {
          if (includeLogInNotebookExport()) {
            result += logToHTML(output) + "\n";
          }
          result += odsToHTML(output) + "\n";
        }
      }
    }
  }

  return result;
};

const markdownToHTML = (doc: TextDocument) => {
  let text = doc.getText();
  text = normalizeDisplayMathBlocks(text);

  return `<div class="markdown-cell">
${marked.parse(text)}
</div>`;
};

/**
 * Normalize display math blocks in markdown text.
 *
 * Ensures each $$...$$ display math block is on its own lines with blank
 * lines before and after, and trims leading/trailing whitespace inside the
 * delimiters while preserving internal newlines.
 *
 * @example
 * Inline: "This is $$ x^2 $$ in text." -> "This is\n\n$$\n x^2\n$$\n\n"
 *
 * @example
 * Display: "Text$$\\frac{1}{2}$$More" -> "Text\n\n$$\n\\frac{1}{2}\n$$\n\nMore"
 */
const normalizeDisplayMathBlocks = (input: string) =>
  input.replace(/\$\$([\s\S]*?)\$\$/g, (_match, content) => {
    const trimmedContent = content.trim();
    return `\n\n$$\n${trimmedContent}\n$$\n\n`;
  });

const codeToHTML = async (doc: TextDocument, client: LanguageClient) => {
  let result = "";
  if (doc.languageId === "sas") {
    result = await SASToHTML(doc, client);
  } else {
    result = hljs.highlight(doc.getText(), {
      language: doc.languageId,
    }).value;
  }
  return `<div class="code-cell">
<pre><code class="hljs">${result}</code></pre>
<div class="languageId">${doc.languageId}</div>
</div>`;
};

const SASToHTML = async (doc: TextDocument, client: LanguageClient) => {
  const result = [];
  const tokens = (
    await client.sendRequest(SemanticTokensRequest.type, {
      textDocument: {
        uri: doc.uri.toString(),
      },
    })
  ).data;
  const legend =
    client.initializeResult.capabilities.semanticTokensProvider.legend
      .tokenTypes;
  let tokenIndex = 0;
  let token =
    tokenIndex + 4 < tokens.length
      ? {
          line: tokens[tokenIndex],
          startChar: tokens[tokenIndex + 1],
          length: tokens[tokenIndex + 2],
          tokenType: tokens[tokenIndex + 3],
        }
      : null;

  for (let line = 0; line < doc.lineCount; line++) {
    const lineText = doc.lineAt(line).text;
    const parts = [];
    let end = 0;

    while (token && token.line === line) {
      parts.push(lineText.slice(end, token.startChar));
      end = token.startChar + token.length;
      parts.push(
        `<span class="sas-syntax-${legend[token.tokenType]}">${lineText.slice(
          token.startChar,
          end,
        )}</span>`,
      );
      tokenIndex += 5;
      token =
        tokenIndex + 4 < tokens.length
          ? {
              line: tokens[tokenIndex] + token.line,
              startChar:
                tokens[tokenIndex + 1] +
                (tokens[tokenIndex] > 0 ? 0 : token.startChar),
              length: tokens[tokenIndex + 2],
              tokenType: tokens[tokenIndex + 3],
            }
          : null;
    }
    parts.push(lineText.slice(end));
    result.push(parts.join(""));
  }
  return result.join("\n");
};

const odsToHTML = (output: NotebookCellOutput) => {
  const ods = output.items.find(
    (item) => item.mime === "application/vnd.sas.ods.html5",
  );
  if (ods) {
    const html = ods.data.toString();
    const style = html.slice(
      html.indexOf("<style>"),
      html.indexOf("</style>") + 8,
    );
    const content = html.slice(
      html.indexOf("<body ") + 6,
      html.lastIndexOf("</body>"),
    );
    return `<div class="cell-output">
${style}
<div ${content}</div>
</div>`;
  }
  return "";
};

const logToHTML = (output: NotebookCellOutput) => {
  const logItem = output.items.find(
    (item) => item.mime === "application/vnd.sas.compute.log.lines",
  );
  if (logItem) {
    const logs: LogLine[] = JSON.parse(logItem.data.toString());
    return `<div class="cell-output">
${logs
  .map(
    (line) => `<div class="log-line sas-log-${line.type}">${line.line}</div>`,
  )
  .join("\n")}
</div>`;
  }
  return "";
};
