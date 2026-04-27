export const stringArrayToCsvString = (strings: string[]): string =>
  `"${strings
    .map((item: string | number) =>
      (item ?? "").toString().replace(/"/g, '""').trim(),
    )
    .join('","')}"`;
