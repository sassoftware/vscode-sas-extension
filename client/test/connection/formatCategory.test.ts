// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import { FormatCategoryCache } from "../../src/connection/formatCategory";

describe("FormatCategoryCache", () => {
  it("resolves categories keyed by base format name", async () => {
    const cache = new FormatCategoryCache(async () => ({
      DATE: "date",
      DOLLAR: "curr",
    }));

    const categories = await cache.resolve(["DATE9.", { name: "DOLLAR15.2" }]);

    assert.strictEqual(categories.get("DATE"), "date");
    assert.strictEqual(categories.get("DOLLAR"), "curr");
  });

  it("normalizes the category casing", async () => {
    const cache = new FormatCategoryCache(async () => ({ DATE: " DATE " }));

    const categories = await cache.resolve(["DATE9."]);

    assert.strictEqual(categories.get("DATE"), "date");
  });

  it("only requests each format once", async () => {
    const requests: string[][] = [];
    const cache = new FormatCategoryCache(async (names) => {
      requests.push(names);
      return { DATE: "date", TIME: "time" };
    });

    await cache.resolve(["DATE9.", "DATE11.", "TIME8."]);
    await cache.resolve(["DATE9.", "TIME8."]);

    assert.deepStrictEqual(requests, [["DATE", "TIME"]]);
  });

  it("caches formats the server did not categorize", async () => {
    let calls = 0;
    const cache = new FormatCategoryCache(async () => {
      calls += 1;
      return {};
    });

    const first = await cache.resolve(["MYFMT."]);
    await cache.resolve(["MYFMT."]);

    assert.strictEqual(first.get("MYFMT"), "");
    assert.strictEqual(calls, 1);
  });

  it("falls back to empty categories and retries when the lookup fails", async () => {
    let calls = 0;
    const cache = new FormatCategoryCache(async () => {
      calls += 1;
      throw new Error("service unavailable");
    });

    const categories = await cache.resolve(["DATE9."]);
    await cache.resolve(["DATE9."]);

    assert.strictEqual(categories.get("DATE"), "");
    assert.strictEqual(calls, 2);
  });

  it("ignores columns without a format", async () => {
    let calls = 0;
    const cache = new FormatCategoryCache(async () => {
      calls += 1;
      return {};
    });

    const categories = await cache.resolve([undefined, "", { name: "" }]);

    assert.strictEqual(calls, 0);
    assert.strictEqual(categories.size, 0);
  });

  it("keeps already resolved categories when a fetch clears the cache", async () => {
    const known = { DATE: "date", TIME: "time" };
    const cache = new FormatCategoryCache(async (names) => {
      // Mimics a reconnect during the lookup, which clears the cache mid-flight.
      cache.clear();
      return Object.fromEntries(names.map((name) => [name, known[name]]));
    });

    await cache.resolve(["DATE9."]);
    const categories = await cache.resolve(["DATE9.", "TIME8."]);

    assert.strictEqual(categories.get("DATE"), "date");
    assert.strictEqual(categories.get("TIME"), "time");
  });

  it("clears cached categories", async () => {
    let calls = 0;
    const cache = new FormatCategoryCache(async () => {
      calls += 1;
      return { DATE: "date" };
    });

    await cache.resolve(["DATE9."]);
    cache.clear();
    await cache.resolve(["DATE9."]);

    assert.strictEqual(calls, 2);
  });
});
