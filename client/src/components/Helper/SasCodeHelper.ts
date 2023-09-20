// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { ColorThemeKind, l10n, window, workspace } from "vscode";

import { isAbsolute } from "path";

import { getHtmlStyle, isOutputHtmlEnabled } from "./SettingHelper";

function generateHtmlStyleOption(): string {
  const htmlStyle = getHtmlStyle();

  let odsStyle;
  switch (htmlStyle) {
    case "(auto)":
      switch (window.activeColorTheme.kind) {
        case ColorThemeKind.Light:
          odsStyle = "Illuminate";
          break;
        case ColorThemeKind.Dark:
          odsStyle = "Ignite";
          break;
        case ColorThemeKind.HighContrast:
          odsStyle = "HighContrast";
          break;
        case ColorThemeKind.HighContrastLight:
          odsStyle = "Illuminate";
          break;
        default:
          odsStyle = "";
          break;
      }
      break;
    case "(server default)":
      odsStyle = "";
      break;
    default:
      odsStyle = htmlStyle;
      break;
  }

  return odsStyle ? ` style=${odsStyle}` : "";
}

export function wrapCodeWithOutputHtml(code: string): string {
  const outputHtml = isOutputHtmlEnabled();

  if (outputHtml) {
    const htmlStyleOption = generateHtmlStyleOption();
    return `ods html5${htmlStyleOption};\n${code}\n;run;quit;ods html5 close;`;
  } else {
    return code;
  }
}

export async function wrapCodeWithPreambleAndPostamble(
  code: string,
  preamble?: string,
  postamble?: string,
) {
  let sasCode = code;
  if (preamble) {
    sasCode = preamble + "\n" + sasCode;
  }

  if (postamble) {
    sasCode = sasCode + "\n" + postamble;
  }

  return sasCode;
}

export async function getSASCodeFromActiveEditor() {
  const activeEditor = window.activeTextEditor;
  let sasCode = "";

  if (activeEditor === undefined) {
    throw new Error(l10n.t("No opened file"));
  } else if (activeEditor.document.languageId !== "sas") {
    throw new Error(
      l10n.t("Not a valid sas file: {file}", {
        file: activeEditor.document.fileName,
      }),
    );
  } else {
    for (const selection of activeEditor.selections) {
      const selectedText: string = activeEditor.document.getText(selection);
      sasCode += selectedText;
    }
    // if no non-whitespace characters are selected, treat as no selection and run all code
    if (sasCode.trim().length === 0) {
      sasCode = activeEditor.document.getText();
    }
  }

  checkCodeIsNotEmpty(sasCode);
  if (activeEditor.document.fileName) {
    sasCode = 'option set=SAS_EXECFILEPATH=%sysfunc(quote(' + activeEditor.document.fileName + '));\n' + sasCode;
  }
  
  return sasCode;
}

export async function getSASCodeFromFile(file: string) {
  let fileUri;
  let sasCode;

  if (isAbsolute(file)) {
    const textDocument = await workspace.openTextDocument(file);
    if (textDocument.languageId === "sas") {
      fileUri = file ;
      sasCode = textDocument.getText();
    } else {
      throw new Error(l10n.t("Not a valid sas file: {file}", { file }));
    }
  } else {
    fileUri = (await workspace.findFiles(file))[0];
    if (fileUri === undefined) {
      throw new Error(l10n.t("Cannot find file: {file}", { file }));
    }
    sasCode = (await workspace.openTextDocument(fileUri)).getText();
  }

  checkCodeIsNotEmpty(sasCode);

  sasCode = 'option set=SAS_EXECFILEPATH=%sysfunc(quote(' + fileUri + '));\n' + sasCode;

  return sasCode;
}

export async function wrapCode(
  code: string,
  preamble: string,
  postamble: string,
) {
  let sasCode = await wrapCodeWithPreambleAndPostamble(
    code,
    preamble,
    postamble,
  );

  if (isOutputHtmlEnabled()) {
    sasCode = wrapCodeWithOutputHtml(sasCode);
  }

  return sasCode;
}

function checkCodeIsNotEmpty(code: string) {
  if (code.trim() === "") {
    throw new Error(l10n.t("No valid sas code"));
  }
}
