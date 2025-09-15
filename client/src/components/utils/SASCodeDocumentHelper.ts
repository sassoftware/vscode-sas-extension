// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ColorThemeKind,
  Hover,
  Position,
  Selection,
  TextDocument,
  commands,
  window,
  workspace,
} from "vscode";

import { v4 } from "uuid";

import { profileConfig } from "../../commands/profile";
import { ConnectionType } from "../profile";
import { SASCodeDocumentParameters } from "./SASCodeDocument";
import { getHtmlStyle, isOutputHtmlEnabled } from "./settings";

export function getCodeDocumentConstructionParameters(
  textDocument: TextDocument,
  addition?: {
    selections?: ReadonlyArray<Selection>;
    preamble?: string;
    postamble?: string;
  },
): SASCodeDocumentParameters {
  // TODO #810 This is a temporary solution to prevent creating an excessive
  // number of result files for viya connections.
  // This todo will be cleaned up with remaining work in #810.
  const uuid = connectionTypeIsNotRest() ? v4() : undefined;

  return {
    languageId: textDocument.languageId,
    code: textDocument.getText(),
    selectedCode: getSelectedCode(textDocument, addition?.selections),
    uri: textDocument.uri.toString(),
    fileName: textDocument.fileName ?? textDocument.uri?.fsPath,
    selections: getCodeSelections(addition?.selections, textDocument),
    preamble: addition?.preamble,
    postamble: addition?.postamble,
    htmlStyle: getHtmlStyleValue(),
    outputHtml: isOutputHtmlEnabled(),
    uuid,
    checkKeyword: async (lineNumber: number, ...keywords: string[]) => {
      const codeLines = textDocument.getText().split("\n");
      const codeLine = codeLines[lineNumber];

      const regExp = new RegExp(`\\b(${keywords.join("|")})\\b`, "gi");
      const matches = Array.from(codeLine.matchAll(regExp));

      if (matches.length === 0) {
        return false;
      }

      for (const match of matches) {
        const [actualHover]: Hover[] = await commands.executeCommand(
          "vscode.executeHoverProvider",
          textDocument.uri,
          new Position(lineNumber, match.index),
        );
        if (actualHover !== undefined) {
          return true;
        }
      }
      return false;
    },
  };
}

function getSelectedCode(
  textDocument: TextDocument,
  selections?: ReadonlyArray<Selection>,
): string {
  if (selectionsAreNotEmpty(selections)) {
    return selections
      .map((selection) => {
        return textDocument.getText(selection);
      })
      .join("\n");
  } else {
    return "";
  }
}

function connectionTypeIsNotRest(): boolean {
  const activeProfile = profileConfig.getActiveProfileDetail();
  return (
    activeProfile &&
    activeProfile.profile.connectionType !== ConnectionType.Rest
  );
}

function selectionsAreNotEmpty(
  selections: ReadonlyArray<Selection> | undefined,
): boolean {
  return (
    selections?.length > 1 ||
    // the single cursor (if it is not in a selection) is always treated as a selection in Monaco Editor
    (selections?.length === 1 && !selections[0].isEmpty)
  );
}

function getHtmlStyleValue(): string {
  const htmlStyleSetting = getHtmlStyle();
  if (htmlStyleSetting === "(auto)") {
    // get the results.html.custom.style object from user settings
    const customStyle =
      workspace.getConfiguration("SAS").get<{
        light?: string;
        dark?: string;
        highContrast?: string;
        highContrastLight?: string;
      }>("results.html.custom.style") || {};

    switch (window.activeColorTheme.kind) {
      case ColorThemeKind.Light:
        return customStyle.light || "Illuminate";
      case ColorThemeKind.Dark:
        return customStyle.dark || "Ignite";
      case ColorThemeKind.HighContrast:
        return customStyle.highContrast || "HighContrast";
      case ColorThemeKind.HighContrastLight:
        return customStyle.highContrastLight || "Illuminate";
      default:
        return "";
    }
  } else if (htmlStyleSetting === "(server default)") {
    return "";
  } else {
    return htmlStyleSetting;
  }
}

// if no valid selection, return whole text as only selection
function getCodeSelections(
  selections: ReadonlyArray<Selection>,
  textDocument: TextDocument,
): ReadonlyArray<Selection> | undefined {
  if (selectionsAreNotEmpty(selections)) {
    const codeSelections: Selection[] = selections.filter(
      (selection) => !selection.isEmpty,
    );
    return codeSelections;
  } else {
    const lastLine = textDocument.lineCount - 1;
    const lastCharacter = textDocument.lineAt(lastLine).text.length;
    return [
      new Selection(new Position(0, 0), new Position(lastLine, lastCharacter)),
    ];
  }
}
