import { assert } from "chai";

type AnyModule = Record<string, unknown>;
type AnyCtor<T = any> = new (...args: any[]) => T;

function safeRequire(paths: string[]): AnyModule {
  const errors: string[] = [];
  for (const p of paths) {
    try {
      return require(p);
    } catch (err) {
      errors.push(`${p}: ${(err as Error).message}`);
    }
  }
  assert.fail(`Unable to load module.\nTried:\n${errors.join("\n")}`);
}

function toSet(value: unknown): Set<string> | undefined {
  if (value instanceof Set) return value as Set<string>;
  if (Array.isArray(value)) return new Set(value.map((v) => String(v)));
  return undefined;
}

function pickFormat(value: unknown, fallback: string): string {
  const s = toSet(value);
  if (!s || s.size === 0) return fallback;
  return String(Array.from(s)[0]);
}

function normalizeLikeViewer(format?: string): string {
  return (format || "")
    .trim()
    .toUpperCase()
    .replace(/[0-9_]*\.?[0-9]*$/, "");
}

function getViewerCtor(mod: AnyModule): AnyCtor {
  const ctor = (mod.default || mod.TablePropertiesViewer) as
    AnyCtor | undefined;
  if (!ctor) {
    assert.fail("TablePropertiesViewer class export not found.");
  }
  return ctor;
}

function buildTableInfo() {
  return {
    name: "TEST_TABLE",
    libref: "WORK",
    type: "DATA",
    label: "Test",
    engine: "BASE",
    extendedType: "",
    rowCount: 10,
    columnCount: 1,
    logicalRecordCount: 10,
    physicalRecordCount: 10,
    recordLength: 8,
    creationTimeStamp: "2024-01-01T00:00:00Z",
    modifiedTimeStamp: "2024-01-02T00:00:00Z",
    compressionRoutine: "",
    encoding: "UTF-8",
    bookmarkLength: 0,
  };
}

function loadTablePropertiesViewerModule(): AnyModule {
  return safeRequire(["../../src/panels/TablePropertiesViewer"]);
}

function loadFormatCategoriesModule(): AnyModule {
  return safeRequire(["../../src/panels/columnFormatCategories"]);
}

function renderBody(
  columns: any[],
  showColumns = true,
  focusedColumn = "",
): string {
  const mod = loadTablePropertiesViewerModule();
  const Viewer = getViewerCtor(mod);
  const viewer = new Viewer(
    {} as any,
    "TEST_TABLE",
    buildTableInfo() as any,
    columns as any,
    showColumns,
    focusedColumn,
  ) as any;

  return viewer.body();
}

describe("TablePropertiesViewer rendering tests", () => {
  const cats = loadFormatCategoriesModule();

  it("renders date icon in Name column for normalized date format", () => {
    const dateBase = normalizeLikeViewer(
      pickFormat(cats.dateFormatSet, "DATE"),
    );
    const html = renderBody([
      { name: "dcol", type: "float", length: 8, format: `${dateBase}9.` },
    ]);
    assert.include(html, 'class="header-icon date"');
    assert.include(html, 'class="header-icon float"');
  });

  it("renders time icon for lowercase + precision format", () => {
    const timeBase = normalizeLikeViewer(
      pickFormat(cats.timeFormatSet, "TIME"),
    );
    const html = renderBody([
      {
        name: "tcol",
        type: "numeric",
        length: 8,
        format: `${timeBase.toLowerCase()}12.2`,
      },
    ]);
    assert.include(html, 'class="header-icon time"');
  });

  it("renders date-time icon with precedence for datetime formats", () => {
    const dtBase = normalizeLikeViewer(
      pickFormat(cats.dateTimeFormatSet, "DATETIME"),
    );
    const html = renderBody([
      { name: "dtcol", type: "float", length: 8, format: `${dtBase}20.3` },
    ]);
    assert.include(html, 'class="header-icon date-time"');
  });

  it("renders currency icon for currency format", () => {
    const curBase = normalizeLikeViewer(
      pickFormat(cats.currencyFormatSet, "DOLLAR"),
    );
    const html = renderBody([
      { name: "ccol", type: "float", length: 8, format: `${curBase}12.2` },
    ]);
    assert.include(html, 'class="header-icon currency"');
  });

  it("falls back to float icon when format is unknown for numeric type", () => {
    const html = renderBody([
      { name: "ncol", type: "FLOAT", length: 8, format: "UNKNOWN12.2" },
    ]);
    assert.include(html, 'class="header-icon float"');
  });

  it("uses char icon for character type in Type column", () => {
    const html = renderBody([
      { name: "scol", type: "CHAR", length: 20, format: "" },
    ]);
    assert.include(html, 'class="header-icon char"');
  });

  it("supports format object with name property", () => {
    const dateBase = normalizeLikeViewer(
      pickFormat(cats.dateFormatSet, "DATE"),
    );
    const html = renderBody([
      {
        name: "objfmt",
        type: "NUMERIC",
        length: 8,
        format: { name: `${dateBase}9.` },
      },
    ]);
    assert.include(html, 'class="header-icon date"');
    assert.ok(html.includes(`${dateBase}9.`));
  });

  it("applies active row class to focused column", () => {
    const html = renderBody(
      [
        { name: "a", type: "FLOAT", length: 8, format: "" },
        { name: "b", type: "FLOAT", length: 8, format: "" },
      ],
      true,
      "b",
    );
    assert.ok(html.includes('<tr class="active">'));
  });

  it("scripts() and styles() return expected assets", () => {
    const mod = loadTablePropertiesViewerModule();
    const Viewer = getViewerCtor(mod);
    const viewer = new Viewer(
      {} as any,
      "TEST_TABLE",
      buildTableInfo() as any,
      [] as any,
      true,
      "",
    ) as any;
    assert.deepStrictEqual(viewer.scripts(), ["TablePropertiesViewer.js"]);
    assert.deepStrictEqual(viewer.styles(), ["TablePropertiesViewer.css"]);
  });

  it("tabs reflect showColumns flag", () => {
    const htmlColumns = renderBody([], true);
    const htmlGeneral = renderBody([], false);
    assert.ok(htmlColumns.includes('data-tab="columns">'));
    assert.ok(htmlGeneral.includes('data-tab="properties">'));
    assert.ok(htmlColumns.includes('id="columns" class="tab-content active"'));
    assert.ok(
      htmlGeneral.includes('id="properties" class="tab-content active"'),
    );
  });

  it("displays Numeric for FLOAT type", () => {
    const html = renderBody([
      {
        name: "ncol",
        type: "FLOAT",
        length: 8,
        format: "",
      },
    ]);

    assert.include(html, "Numeric");
  });

  it("displays Character for CHAR type", () => {
    const html = renderBody([
      {
        name: "ccol",
        type: "CHAR",
        length: 8,
        format: "",
      },
    ]);

    assert.include(html, "Character");
  });

  it("supports CHARACTER type", () => {
    const html = renderBody([
      {
        name: "ccol",
        type: "CHARACTER",
        length: 20,
        format: "",
      },
    ]);

    assert.include(html, "header-icon char");
  });

  it("falls back to char icon when format is unknown for character type", () => {
    const html = renderBody([
      {
        name: "ccol",
        type: "CHAR",
        length: 20,
        format: "UNKNOWN",
      },
    ]);

    assert.include(html, "header-icon char");
  });

  it("ignores surrounding whitespace in formats", () => {
    const html = renderBody([
      {
        name: "dcol",
        type: "FLOAT",
        length: 8,
        format: " DATE9. ",
      },
    ]);

    assert.include(html, "header-icon date");
  });
});
