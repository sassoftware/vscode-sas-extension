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
