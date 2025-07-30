// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Selection, TextEditor, commands } from "vscode";
import type { BaseLanguageClient } from "vscode-languageclient";

/**
 * Register a command to toggle SAS block comment by line
 */
export async function toggleLineComment(
  editor: TextEditor,
  client: BaseLanguageClient,
): Promise<void> {
  const { selections, document } = editor;
  if (selections.length === 1) {
    // We have to depend on VS Code native command for embedded (e.g. Python, Lua) code
    // VS Code native command works on multiple selections together
    // so we're not able to only change some of selections
    // We only do for single selection for now

    const selection = selections[0];
    const endLine =
      // should not include the last line if it just selected the last return character
      selection.end.line > selection.start.line && selection.end.character === 0
        ? selection.end.line - 1
        : selection.end.line;
    const fullSelection = new Selection(
      selection.start.line,
      0,
      endLine,
      document.lineAt(endLine).range.end.character,
    );

    if (!fullSelection.isSingleLine) {
      const result = await client.sendRequest<string | null>(
        "sas/toggleLineComment",
        {
          textDocument:
            client.code2ProtocolConverter.asTextDocumentIdentifier(document),
          range: client.code2ProtocolConverter.asRange(fullSelection),
        },
      );
      if (result) {
        editor.selection = fullSelection;
        await editor.edit((editBuilder) => {
          editBuilder.replace(fullSelection, result);
        });
        return;
      }
    }
  }
  commands.executeCommand("editor.action.commentLine");
}
