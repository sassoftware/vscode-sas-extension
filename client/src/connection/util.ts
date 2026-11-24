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
