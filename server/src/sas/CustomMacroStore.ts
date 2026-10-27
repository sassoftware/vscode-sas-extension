// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
// Server-wide cache of client-supplied custom macros (sas/getCustomMacros).
// LanguageServiceProvider is re-created on every edit, so the list must live
// at module level rather than in a per-document service.
import {
  CustomMacro,
  CustomMacroParameter,
  isValidMacroName,
} from "./MacroDefinitionParser";

const MAX_MACROS = 20000;
const MAX_PARAMETERS = 256;
const MAX_TEXT_LENGTH = 2000;

let clientMacros = new Map<string, CustomMacro>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const text = value.trim().substring(0, MAX_TEXT_LENGTH);
  return text ? text : undefined;
}

function sanitizeParameter(value: unknown): CustomMacroParameter | undefined {
  if (!isRecord(value) || !isValidMacroName(value.name)) {
    return undefined;
  }
  const parameter: CustomMacroParameter = {
    name: value.name,
    keyword: value.keyword === true,
  };
  const defaultValue = optionalText(value.defaultValue);
  if (parameter.keyword && defaultValue !== undefined) {
    parameter.defaultValue = defaultValue;
  }
  return parameter;
}

function sanitizeMacro(value: unknown): CustomMacro | undefined {
  if (!isRecord(value) || !isValidMacroName(value.name)) {
    return undefined;
  }
  const macro: CustomMacro = { name: value.name };
  if (Array.isArray(value.parameters)) {
    const parameters: CustomMacroParameter[] = [];
    for (const item of value.parameters.slice(0, MAX_PARAMETERS)) {
      const parameter = sanitizeParameter(item);
      if (parameter) {
        parameters.push(parameter);
      }
    }
    macro.parameters = parameters;
  }
  if (value.parmbuff === true) {
    macro.parmbuff = true;
  }
  const description = optionalText(value.description);
  if (description) {
    macro.description = description;
  }
  const sourceLabel = optionalText(value.sourceLabel);
  if (sourceLabel) {
    macro.sourceLabel = sourceLabel;
  }
  return macro;
}

/**
 * Validates a sas/getCustomMacros response from the client. Invalid entries
 * are dropped; returns undefined when the response itself is malformed.
 */
export function sanitizeCustomMacrosResult(
  result: unknown,
): CustomMacro[] | undefined {
  if (!isRecord(result) || !Array.isArray(result.macros)) {
    return undefined;
  }
  const macros: CustomMacro[] = [];
  for (const item of result.macros.slice(0, MAX_MACROS)) {
    const macro = sanitizeMacro(item);
    if (macro) {
      macros.push(macro);
    }
  }
  return macros;
}

/** Replaces the whole client-supplied list. Later duplicates win. */
export function setClientCustomMacros(macros: CustomMacro[]): void {
  const map = new Map<string, CustomMacro>();
  for (const macro of macros) {
    map.set(macro.name.toUpperCase(), macro);
  }
  clientMacros = map;
}

export function clearClientCustomMacros(): void {
  clientMacros = new Map();
}

/** @param name macro name with or without the leading "%" */
export function getClientCustomMacro(name: string): CustomMacro | undefined {
  return clientMacros.get(name.replace(/^%/, "").toUpperCase());
}

export function getClientCustomMacros(): CustomMacro[] {
  return Array.from(clientMacros.values());
}
