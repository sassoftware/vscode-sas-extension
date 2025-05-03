// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export function extractOutputHtmlFileName(
  line: string,
  defaultValue: string,
): string {
  return (
    line.match(/body="(.{8}-.{4}-.{4}-.{4}-.{12}).htm"/)?.[1] ?? defaultValue
  );
}

export const extractTextBetweenTags = (
  text: string,
  startTag: string = "",
  endTag: string = "",
): string => {
  return startTag && endTag
    ? text
        .slice(text.lastIndexOf(startTag), text.lastIndexOf(endTag))
        .replace(startTag, "")
        .replace(endTag, "")
        .replace(/^\n/, "")
        .replace(/\n$/, "")
    : text;
};

export const getColumnIconType = ({
  type,
  format,
}: {
  index: number;
  type: string;
  name: string;
  format: string;
}) => {
  format = format.toUpperCase();

  const isDateFormat = () =>
    [
      "DAT",
      "MM",
      "DD",
      "YY",
      "EURDF",
      "JUL",
      "YEAR",
      "DAY",
      "MONTH",
      "MON",
      "DOWNAME",
    ].some((f) => format.includes(f)) &&
    ![
      "TIME",
      "HH",
      "SS",
      "COMM",
      "DATEAMPM",
      "DATETIME",
      "NLDATMTM",
      "NLDATM",
      "NLDATMAP",
      "NLDATMW",
    ].some((f) => format.includes(f));

  const isTimeFormat = () =>
    ["TIME", "TIMAP", "HOUR", "HH", "MM", "SS", "NLDATMTM"].some((f) =>
      format.includes(f),
    ) && !["DATEAMPM", "DATETIME", "COMMA"].some((f) => format.includes(f));

  const isDateTimeFormat = () =>
    ["DATEAMPM", "DATETIME", "NLDATM", "NLDATMAP", "NLDATMW"].some((f) =>
      format.includes(f),
    );

  const isCurrencyFormat = () =>
    ["NLMNI", "NLMNL", "NLMNY", "YEN", "DOLLAR", "EURO"].some((f) =>
      format.includes(f),
    );

  if (type === "num") {
    if (isDateFormat()) {
      return "date";
    }
    if (isTimeFormat()) {
      return "time";
    }
    if (isDateTimeFormat()) {
      return "datetime";
    }
    if (isCurrencyFormat()) {
      return "currency";
    }
  }

  return type;
};
