// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export const stringArrayToCsvString = (strings: string[]): string =>
  `"${strings
    .map((item: string | number) =>
      (item ?? "").toString().replace(/"/g, '""').trim(),
    )
    .join('","')}"`;
