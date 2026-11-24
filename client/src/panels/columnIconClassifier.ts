// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
export type ColumnIconClass =
  "" | "float" | "char" | "date" | "time" | "date-time" | "currency";

// Categories reported by SAS, either by the Compute service
// (GET /sessions/{sessionId}/formats/{formatName}) or by fmtinfo(format, 'CAT').
export type FormatCategory =
  | "binary"
  | "char"
  | "curr"
  | "date"
  | "datetime"
  | "num"
  | "smf"
  | "stat"
  | "time";

// binary, smf and stat have no dedicated asset, so they reuse the numeric icon.
const categoryIcons: Record<FormatCategory, ColumnIconClass> = {
  binary: "float",
  char: "char",
  curr: "currency",
  date: "date",
  datetime: "date-time",
  num: "float",
  smf: "float",
  stat: "float",
  time: "time",
};

const iconsByCategory: Record<string, ColumnIconClass> = categoryIcons;

// Maps a SAS format category to an icon class. Unknown or missing categories return "" so that
// callers fall back to the generic numeric/character icon derived from the column type.
export const iconForFormatCategory = (category?: string): ColumnIconClass =>
  iconsByCategory[(category || "").trim().toLowerCase()] ?? "";

// Single resolution path shared by the data viewer column headers and the table properties
// panel: the SAS format category wins, otherwise the column type picks the generic icon.
export const iconForColumn = (
  type?: string,
  formatCategory?: string,
): ColumnIconClass => {
  const categoryIcon = iconForFormatCategory(formatCategory);
  if (categoryIcon) {
    return categoryIcon;
  }

  switch ((type || "").toUpperCase()) {
    case "CHAR":
    case "CHARACTER":
      return "char";
    case "FLOAT":
    case "NUM":
    case "NUMERIC":
    case "CURRENCY":
    case "DATE":
    case "TIME":
    case "DATETIME":
      return "float";
    default:
      return "";
  }
};

// Canonical (untranslated) label for an icon class; callers apply their own localization, if any.
export const getIconLabel = (icon: ColumnIconClass | string): string => {
  switch (icon) {
    case "float":
      return "Numeric";
    case "char":
      return "Character";
    case "date":
      return "Date";
    case "time":
      return "Time";
    case "date-time":
      return "Datetime";
    case "currency":
      return "Currency";
    default:
      return "";
  }
};

// Extracts a format's display name whether it's a plain string or an object with a `name` property.
export const extractFormatName = (
  format: { name?: string } | string | undefined,
): string => {
  if (typeof format === "string") {
    return format;
  }
  return format?.name ?? "";
};

// Strips the width/decimal suffix so that SAS can resolve the format (e.g. "DOLLAR15.2" -> "DOLLAR").
export const baseFormatName = (
  format: { name?: string } | string | undefined,
): string =>
  extractFormatName(format)
    .trim()
    .toUpperCase()
    .replace(/[0-9]*\.?[0-9]*$/, "");
