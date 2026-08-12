// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  currencyFormatSet,
  dateFormatSet,
  dateTimeFormatSet,
  timeFormatSet,
} from "./columnFormatCategories";

export type ColumnIconClass =
  "" | "float" | "char" | "date" | "time" | "date-time" | "currency";

// Strips width/decimal suffixes (e.g. "DATE9." -> "DATE") so a format can be looked up in the category sets.
export const normalizeFormatName = (format?: string): string =>
  (format || "")
    .trim()
    .toUpperCase()
    .replace(/[0-9_]*\.?[0-9]*$/, "");

// Classifies a SAS format name into an icon class, or "" when it doesn't match a known category.
export const classifyFormatIcon = (format?: string): ColumnIconClass => {
  const normalizedFormat = normalizeFormatName(format);

  if (dateTimeFormatSet.has(normalizedFormat)) {
    return "date-time";
  }

  if (timeFormatSet.has(normalizedFormat)) {
    return "time";
  }

  if (dateFormatSet.has(normalizedFormat)) {
    return "date";
  }

  if (currencyFormatSet.has(normalizedFormat)) {
    return "currency";
  }

  return "";
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
