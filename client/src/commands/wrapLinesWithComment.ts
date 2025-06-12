import { Range, commands, window } from "vscode";

/**
 * Registers a command to wrap the non-blank content of the selected line or multiple lines with SAS block comments (/* ... *\/).
 * If the selection spans multiple lines, each line will be commented individually.
 */
export function registerAddCommentCommand() {
  return commands.registerCommand("SAS.addBlockComment", async () => {
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showInformationMessage("No active editor");
      return;
    }
    const { selections, document } = editor;
    await editor.edit((editBuilder) => {
      for (const selection of selections) {
        const start = selection.start.line;
        const end = selection.end.line;
        for (let i = start; i <= end; i++) {
          const line = document.lineAt(i);
          const lineText = line.text.substring(
            line.firstNonWhitespaceCharacterIndex,
          );
          const replacementRange = new Range(
            i,
            line.firstNonWhitespaceCharacterIndex,
            i,
            line.text.length,
          );
          if (lineText.trim().length > 0) {
            editBuilder.replace(replacementRange, `/* ${lineText} */`);
          } else {
            editBuilder.replace(replacementRange, `/*  */`);
          }
        }
      }
    });
  });
}

/**
 * Registers a command to remove SAS block comments (/* ... *\/) from the selected line or multiple lines.
 * If the selection spans multiple lines, each line will be processed individually.
 */
export function registerRemoveCommentCommand() {
  return commands.registerCommand("SAS.removeBlockComment", async () => {
    const editor = window.activeTextEditor;
    if (!editor) {
      window.showInformationMessage("No active editor");
      return;
    }
    const { selections, document } = editor;
    // Regex to find SAS block comments, allowing for leading/trailing whitespace
    // and optional space after /* and before */
    // It captures the content within the comment
    const commentRegex = /^\s*\/\*\s?(.*?)\s?\*\/\s*$/;
    await editor.edit((editBuilder) => {
      for (const selection of selections) {
        const start = selection.start.line;
        const end = selection.end.line;
        for (let i = start; i <= end; i++) {
          const line = document.lineAt(i);
          const lineText = line.text;
          const replacementRange = new Range(
            i,
            line.firstNonWhitespaceCharacterIndex,
            i,
            line.text.length,
          );
          const match = lineText.match(commentRegex);
          if (match) {
            // The actual content of the comment is in match[1]
            const uncommentedText = match[1];
            editBuilder.replace(replacementRange, uncommentedText);
          }
        }
      }
    });
  });
}
