// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { assert } from "chai";

import { CustomMacroStore } from "../../../src/sas/macros/CustomMacroStore";

describe("CustomMacroStore", () => {
  it("uses payload keys as names and normalizes lookup and prefix matching", () => {
    const store = new CustomMacroStore();
    store.set({ macros: { SortDS: { parameters: [] } } });

    assert.equal(store.get("sortds")?.name, "SortDS");
    assert.deepEqual(
      store.findByPrefix("SO").map((macro) => macro.name),
      ["SortDS"],
    );
  });

  it("preserves names without applying SAS identifier grammar or length limits", () => {
    const store = new CustomMacroStore();
    const macroName = "Macro.Name-With-A-Very-Long-Identifier-That-Exceeds-32";
    const parameterName = "parameter name/with punctuation and extra length";
    store.set({
      macros: {
        [macroName]: { parameters: [{ name: parameterName }] },
      },
    });

    assert.equal(store.get(macroName.toLowerCase())?.name, macroName);
    assert.equal(store.get(macroName)?.parameters[0].name, parameterName);
  });

  it("uses the last key when payload keys differ only by case", () => {
    const store = new CustomMacroStore();
    store.set({
      macros: {
        SortDS: { parameters: [{ name: "old" }] },
        sortds: { parameters: [{ name: "new" }] },
      },
    });

    assert.equal(store.get("SORTDS")?.name, "sortds");
    assert.equal(store.get("sortds")?.parameters[0].name, "new");
    assert.deepEqual(
      store.getAll().map((macro) => macro.name),
      ["sortds"],
    );
  });

  it("fully replaces the previous map and clears on malformed payloads", () => {
    const store = new CustomMacroStore();
    store.set({ macros: { first: { parameters: [] } } });
    store.set({ macros: { second: { parameters: [] } } });
    assert.isUndefined(store.get("first"));
    assert.deepEqual(
      store.getAll().map((macro) => macro.name),
      ["second"],
    );

    store.set({ macros: null });
    assert.deepEqual(store.getAll(), []);
  });

  it("infers positional and keyword parameters from defaultValue", () => {
    const store = new CustomMacroStore();
    store.set({
      macros: {
        valid: {
          parameters: [
            { name: "ds" },
            { name: "by", defaultValue: "id" },
            { name: "out", defaultValue: "" },
          ],
        },
        invalid: { parameters: "not-an-array" },
      },
    });

    assert.deepEqual(store.get("valid")?.parameters, [
      { name: "ds" },
      { name: "by", defaultValue: "id" },
      { name: "out", defaultValue: "" },
    ]);
    assert.isUndefined(store.get("invalid"));
  });

  it("treats null and other non-string defaults as positional without throwing", () => {
    const store = new CustomMacroStore();
    assert.doesNotThrow(() =>
      store.set({
        macros: {
          values: {
            parameters: [
              { name: "nullValue", defaultValue: null },
              { name: "numberValue", defaultValue: 3 },
              { name: "objectValue", defaultValue: {} },
            ],
          },
        },
      }),
    );

    assert.deepEqual(store.get("values")?.parameters, [
      { name: "nullValue" },
      { name: "numberValue" },
      { name: "objectValue" },
    ]);
  });

  it("ignores legacy kind fields and infers from defaultValue only", () => {
    const store = new CustomMacroStore();
    store.set({
      macros: {
        legacy: {
          parameters: [
            { name: "positional", kind: "keyword" },
            { name: "keyword", kind: "positional", defaultValue: "x" },
          ],
        },
      },
    });

    assert.deepEqual(store.get("legacy")?.parameters, [
      { name: "positional" },
      { name: "keyword", defaultValue: "x" },
    ]);
  });
});
