// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { baseFormatName } from "../panels/columnIconClassifier";

export type FormatCategoryFetcher = (
  formatNames: string[],
) => Promise<Record<string, string>>;

const normalizeCategory = (category?: string): string =>
  (category || "").trim().toLowerCase();

/**
 * Resolves SAS format categories (date, datetime, time, curr, num, char, ...) for format names,
 * caching results so a format is only looked up once per session.
 */
export class FormatCategoryCache {
  private readonly categories = new Map<string, string>();

  public constructor(private readonly fetchCategories: FormatCategoryFetcher) {}

  public clear(): void {
    this.categories.clear();
  }

  /**
   * Returns a map of base format name (e.g. "DOLLAR") to category. Formats whose category could
   * not be determined map to "" so callers fall back to type based icons.
   */
  public async resolve(
    formats: Array<{ name?: string } | string | undefined>,
  ): Promise<Map<string, string>> {
    // Deduplicate normalized format names and ignore empty values so we don't
    // perform repeated lookups for the same format.
    const names = [...new Set(formats.map(baseFormatName))].filter(Boolean);
    // Snapshot the hits up front: fetching can reconnect the session, which clears the cache.
    const resolved = new Map<string, string>();
    const missing: string[] = [];

    names.forEach((formatName) => {
      if (this.categories.has(formatName)) {
        resolved.set(formatName, this.categories.get(formatName) ?? "");
      } else {
        missing.push(formatName);
      }
    });

    if (missing.length > 0) {
      try {
        const fetched = await this.fetchCategories(missing);
        missing.forEach((name) => {
          const category = normalizeCategory(fetched[name]);
          this.categories.set(name, category);
          resolved.set(name, category);
        });
      } catch (error) {
        // Leave the unresolved names uncached so that a later request can retry them.
        console.warn("Unable to resolve SAS format categories", error);
      }
    }

    return new Map(names.map((name) => [name, resolved.get(name) ?? ""]));
  }
}
