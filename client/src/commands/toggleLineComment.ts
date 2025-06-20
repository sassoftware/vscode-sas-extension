// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TextEditor, commands } from "vscode";

/**
 * Register a command to toggle SAS block comment (/* ... *\/)
 * If the line is already commented, remove the comment
 * If the line is not commented, add comment
 */
export function registerToggleLineCommentCommand() {
  return commands.registerTextEditorCommand(
    "SAS.toggleLineComment",
    async (editor) => {
      const { selections, document } = editor;

      // Get the line range of all selected areas
      const linesRange = selections.map((selection) => {
        const startLine = selection.start.line;
        const endLine = selection.end.line;
        // Ensure endLine doesn't exceed actual line count when selecting the whole line by clicking the line number
        if (selection.end.character === 0 && endLine > startLine) {
          return { startLine, endLine: endLine - 1 };
        }
        return { startLine, endLine };
      });

      await editor.edit((editBuilder) => {
        for (const range of linesRange) {
          // Analyze comment status and minimum indentation for each selected area
          const { shouldUncomment, minIndentColumn } = analyzeLines(
            editor,
            range,
          );
          for (
            let lineIndex = range.startLine;
            lineIndex <= range.endLine;
            lineIndex++
          ) {
            const line = document.lineAt(lineIndex);
            const lineText = line.text;
            const lineRange = line.range;
            if (shouldUncomment) {
              // Only process commented lines
              const matches = lineText.match(
                /^([ \t]*)\/\*\s?(.*?)\s?\*\/\s*$/,
              );
              if (matches) {
                const indent = matches[1] || "";
                const content = matches[2] || "";
                editBuilder.replace(lineRange, `${indent}${content}`);
              }
            } else {
              // Skip blank lines in multi-line selection
              if (
                isEmptyLine(lineText) &&
                !(range.startLine === range.endLine)
              ) {
                continue;
              }
              // Add comment
              const beforeComment = lineText.substring(0, minIndentColumn);
              const afterComment = lineText.substring(minIndentColumn);
              editBuilder.replace(
                lineRange,
                `${beforeComment}/* ${afterComment} */`,
              );
            }
          }
        }
      });
    },
  );
}

// Utility functions
function isEmptyLine(lineText: string): boolean {
  return /^\s*$/.test(lineText);
}
function isCommentedLine(lineText: string): boolean {
  return /^\s*\/\*.*\*\/\s*$/.test(lineText);
}

/**
 * Independently analyze the comment status and minimum indentation of each selected area,
 * used to determine whether to add or remove comments
 *
 * @param editor Current TextEditor instance, used to access document content
 * @param range Line range of selected area, including startLine and endLine
 * @returns {Object}
 * @returns {boolean} shouldUncomment - Whether to perform uncomment operation
 * @returns {number} minIndentColumn - Minimum indentation column in selected lines (for comment alignment)
 *
 * Function behavior:
 * 1. For single line selection, if it's a blank line (including pure indentation), add comment with indentation equal to line length
 * 2. For multi-line selection, iterate through all selected lines, check comment status and indentation of each line:
 *    If any uncommented non-empty line is found, consider adding comments
 *    Calculate the minimum indentation (default 0) of all non-empty lines for comment alignment
 */
function analyzeLines(
  editor: TextEditor,
  range: { startLine: number; endLine: number },
) {
  const { document } = editor;
  // Special handling for single blank line
  if (range.startLine === range.endLine) {
    const lineIndex = range.startLine;
    const lineText = document.lineAt(lineIndex).text;
    if (isEmptyLine(lineText)) {
      return {
        shouldUncomment: false,
        minIndentColumn: lineText.length,
      };
    }
  }

  let shouldUncomment = true;
  let minIndentColumn = Number.MAX_VALUE;
  for (
    let lineIndex = range.startLine;
    lineIndex <= range.endLine;
    lineIndex++
  ) {
    const lineText = document.lineAt(lineIndex).text;
    if (!isCommentedLine(lineText) && !isEmptyLine(lineText)) {
      shouldUncomment = false;
    }
    if (!isEmptyLine(lineText)) {
      const indent =
        document.lineAt(lineIndex).firstNonWhitespaceCharacterIndex;
      if (indent < minIndentColumn) {
        minIndentColumn = indent;
      }
    }
  }
  if (minIndentColumn === Number.MAX_VALUE) {
    minIndentColumn = 0;
  }
  return { shouldUncomment, minIndentColumn };
}
