// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/*
 * Custom macro completion protocol
 *
 * LSP consumers can supply custom macro definitions to the server with the
 * `sas/setCustomMacros` notification. Each notification replaces the complete
 * custom macro map; it is not a delta. The server does not scan files or parse
 * macro source text for this feature.
 *
 * The payload is `{ macros: Record<string, CustomMacro> }`. Each map key is the
 * macro name as written (for example, `SortDS`); the server normalizes it for
 * lookup and prefix matching. Each definition contains a `parameters` array and
 * optional `documentation`. Each parameter has a `name`. A string
 * `defaultValue` (including `""`) identifies a keyword parameter. A missing,
 * `null`, or non-string `defaultValue` identifies a positional parameter. A
 * keyword parameter with no declared default MUST send `defaultValue: ""`;
 * omitting it or sending `null` makes the parameter positional. The server
 * ignores any `kind` field. Parameters remain in their declared order.
 *
 *   client.sendNotification("sas/setCustomMacros", {
 *     macros: {
 *       sortds: {
 *         parameters: [
 *           { name: "ds" },
 *           { name: "by", defaultValue: "id" },
 *           { name: "out", defaultValue: "" },
 *         ],
 *         documentation: "Sort a dataset",
 *       },
 *       cleanup: { parameters: [] },
 *     },
 *   });
 *
 * After `%` and while typing its name, completion returns matching built-in and
 * custom macro names case-insensitively. A custom macro replaces a built-in
 * completion with the same name. Custom items show their parameter signature;
 * accepting one inserts parameters in their declared order, one per line, as
 * snippet tab stops. Keyword parameters use `name = ${n:default}` (or
 * `name = ${n}` for an empty default); positional parameters use `${n:name}`.
 * The closing parenthesis is followed by `$0;`. A macro without parameters
 * inserts `%name;`.
 */

const MAX_MACROS = 10000;
const MAX_PARAMETERS = 256;
const MAX_TEXT_LENGTH = 4000;

export interface MacroParameter {
  name: string;
  defaultValue?: string;
  documentation?: string;
}

/** A string default, including an empty one, identifies a keyword parameter. */
export function isKeywordParameter(parameter: MacroParameter): boolean {
  return typeof parameter.defaultValue === "string";
}

export interface CustomMacro {
  parameters: MacroParameter[];
  documentation?: string;
}

/** Internal registry value carrying the macro spelling from the payload key. */
export interface RegisteredCustomMacro extends CustomMacro {
  name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isName(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string"
    ? value.slice(0, MAX_TEXT_LENGTH)
    : undefined;
}

function toParameter(value: unknown): MacroParameter | undefined {
  if (!isRecord(value) || !isName(value.name)) {
    return undefined;
  }
  return {
    name: value.name,
    ...(typeof value.defaultValue === "string"
      ? { defaultValue: value.defaultValue.slice(0, MAX_TEXT_LENGTH) }
      : {}),
    ...(typeof value.documentation === "string"
      ? { documentation: value.documentation.slice(0, MAX_TEXT_LENGTH) }
      : {}),
  };
}

function toMacro(key: string, value: unknown): CustomMacro | undefined {
  if (!isName(key) || !isRecord(value) || !Array.isArray(value.parameters)) {
    return undefined;
  }
  const parameters = value.parameters
    .slice(0, MAX_PARAMETERS)
    .map(toParameter)
    .filter(
      (parameter): parameter is MacroParameter => parameter !== undefined,
    );
  return {
    parameters,
    ...(optionalText(value.documentation) !== undefined
      ? { documentation: optionalText(value.documentation) }
      : {}),
  };
}

/** In-memory custom macro map. Each set replaces the complete previous map. */
export class CustomMacroStore {
  private macros = new Map<string, RegisteredCustomMacro>();

  /** Invalid payloads are treated as an empty map; malformed entries are skipped. */
  set(payload: unknown): void {
    const next = new Map<string, RegisteredCustomMacro>();
    if (!isRecord(payload) || !isRecord(payload.macros)) {
      this.macros = next;
      return;
    }

    for (const [key, value] of Object.entries(payload.macros).slice(
      0,
      MAX_MACROS,
    )) {
      const macro = toMacro(key, value);
      if (macro) {
        const normalizedKey = key.toLowerCase();
        next.delete(normalizedKey);
        next.set(normalizedKey, { ...macro, name: key });
      }
    }
    this.macros = next;
  }

  get(name: string): RegisteredCustomMacro | undefined {
    return this.macros.get(name.replace(/^%/, "").toLowerCase());
  }

  findByPrefix(prefix: string): RegisteredCustomMacro[] {
    const normalizedPrefix = prefix.replace(/^%/, "").toLowerCase();
    return [...this.macros.entries()]
      .filter(([name]) => name.startsWith(normalizedPrefix))
      .map(([, macro]) => macro);
  }

  getAll(): RegisteredCustomMacro[] {
    return [...this.macros.values()];
  }
}
