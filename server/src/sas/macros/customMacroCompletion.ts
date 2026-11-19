// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CompletionItem,
  CompletionItemKind,
  InsertTextFormat,
  MarkupContent,
  MarkupKind,
  ParameterInformation,
  Range,
  SignatureInformation,
} from "vscode-languageserver";

import {
  type RegisteredCustomMacro,
  isKeywordParameter,
} from "./CustomMacroStore";

function escapeSnippet(text: string): string {
  return text.replace(/[\\$}]/g, "\\$&");
}

function parameterLabel(
  parameter: RegisteredCustomMacro["parameters"][number],
): string {
  return isKeywordParameter(parameter)
    ? `${parameter.name}=${parameter.defaultValue ?? ""}`
    : parameter.name;
}

function orderedParameters(macro: RegisteredCustomMacro) {
  return macro.parameters;
}

/** Parameter signature, e.g. "(ds, by=id, out=)". */
export function getParameterListLabel(macro: RegisteredCustomMacro): string {
  const parameters = orderedParameters(macro);
  return parameters.length
    ? `(${parameters.map(parameterLabel).join(", ")})`
    : "";
}

export function getSignatureLabel(macro: RegisteredCustomMacro): string {
  return `%${macro.name}${getParameterListLabel(macro)}`;
}

export function getMacroDocumentation(
  macro: RegisteredCustomMacro,
): MarkupContent | undefined {
  return macro.documentation
    ? { kind: MarkupKind.Markdown, value: macro.documentation }
    : undefined;
}

export function getSignatureInformation(
  macro: RegisteredCustomMacro,
): SignatureInformation {
  const parameters: ParameterInformation[] = [];
  let label = `%${macro.name}(`;
  for (const parameter of orderedParameters(macro)) {
    const text = parameterLabel(parameter);
    if (parameters.length > 0) {
      label += ", ";
    }
    parameters.push({
      label: [label.length, label.length + text.length],
      ...(parameter.documentation
        ? { documentation: parameter.documentation }
        : {}),
    });
    label += text;
  }
  label += ")";
  return {
    label,
    documentation: getMacroDocumentation(macro),
    parameters,
  };
}

function getInsertText(macro: RegisteredCustomMacro): {
  text: string;
  format: InsertTextFormat;
} {
  const name = `%${escapeSnippet(macro.name)}`;
  const parameters = orderedParameters(macro);
  if (parameters.length === 0) {
    return { text: `${name};`, format: InsertTextFormat.PlainText };
  }
  const keywordNameWidths = parameters
    .filter(isKeywordParameter)
    .map((parameter) => escapeSnippet(parameter.name).length);
  const keywordNameWidth = Math.max(0, ...keywordNameWidths);
  const args = parameters.map((parameter, index) => {
    const keyword = isKeywordParameter(parameter);
    const value = keyword ? parameter.defaultValue! : parameter.name;
    const placeholder =
      keyword && value === ""
        ? `\${${index + 1}}`
        : `\${${index + 1}:${escapeSnippet(value)}}`;
    if (!keyword) {
      return placeholder;
    }
    const escapedName = escapeSnippet(parameter.name);
    const alignment = " ".repeat(keywordNameWidth - escapedName.length + 2);
    return `${escapedName}${alignment}= ${placeholder}`;
  });
  const lines = args.map((argument, index) =>
    index === 0 ? `     ${argument}` : `  ,  ${argument}`,
  );
  return {
    text: `${name}(\n${lines.join("\n")}\n)$0;`,
    format: InsertTextFormat.Snippet,
  };
}

export function getCompletionItem(
  macro: RegisteredCustomMacro,
  range: Range,
): CompletionItem {
  const label = `%${macro.name}`;
  const signature = getParameterListLabel(macro);
  const insert = getInsertText(macro);
  return {
    label,
    ...(signature
      ? { detail: signature, labelDetails: { detail: signature } }
      : {}),
    kind: CompletionItemKind.Function,
    ...(macro.documentation ? { documentation: macro.documentation } : {}),
    filterText: label,
    insertText: insert.text,
    textEdit: { range, newText: insert.text },
    insertTextFormat: insert.format,
    data: { customMacro: true },
  };
}
