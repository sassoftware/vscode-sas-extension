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
  // Viya reports FLOAT/CHAR and SAS 9 reports num/char; both must render the same icon.
  [
    { format: "DATE9.", category: "date", icon: "date" },
    { format: "TIME8.", category: "time", icon: "time" },
    { format: "DATETIME20.", category: "datetime", icon: "date-time" },
    { format: "DOLLAR15.2", category: "curr", icon: "currency" },
    { format: "COMMA12.", category: "num", icon: "float" },
    { format: "$CHAR20.", category: "char", icon: "char" },
  ].forEach(({ format, category, icon }) => {
    const isChar = category === "char";

    it(`renders the ${icon} icon for ${format} on Viya`, () => {
      const html = renderBody([
        {
          name: "col",
          type: isChar ? "CHAR" : "FLOAT",
          length: 8,
          format: { name: format },
          formatCategory: category,
        },
      ]);
      assert.include(html, `class="header-icon ${icon}"`);
    });

    it(`renders the ${icon} icon for ${format} on SAS 9`, () => {
      const html = renderBody([
        {
          name: "col",
          type: isChar ? "char" : "num",
          length: 8,
          format,
          formatCategory: category,
        },
      ]);
      assert.include(html, `class="header-icon ${icon}"`);
    });
  });

  it("renders the date icon for the date category", () => {
    const html = renderBody([
      {
        name: "dcol",
        type: "float",
        length: 8,
        format: "DATE9.",
        formatCategory: "date",
      },
    ]);
    assert.include(html, 'class="header-icon date"');
    // The Type column always uses the type based icon.
    assert.include(html, 'class="header-icon float"');
  });

  it("renders the time icon for the time category", () => {
    const html = renderBody([
      {
        name: "tcol",
        type: "numeric",
        length: 8,
        format: "TIME8.",
        formatCategory: "time",
      },
    ]);
    assert.include(html, 'class="header-icon time"');
  });

  it("renders the date-time icon for the datetime category", () => {
    const html = renderBody([
      {
        name: "dtcol",
        type: "float",
        length: 8,
        format: "DATETIME20.",
        formatCategory: "datetime",
      },
    ]);
    assert.include(html, 'class="header-icon date-time"');
  });

  it("renders the currency icon for the curr category", () => {
    const html = renderBody([
      {
        name: "ccol",
        type: "float",
        length: 8,
        format: "DOLLAR15.2",
        formatCategory: "curr",
      },
    ]);
    assert.include(html, 'class="header-icon currency"');
  });

  it("renders the numeric icon for the num category", () => {
    const html = renderBody([
      {
        name: "pcol",
        type: "float",
        length: 8,
        format: "PERCENT8.2",
        formatCategory: "num",
      },
    ]);
    assert.include(html, 'class="header-icon float"');
    assert.notInclude(html, 'class="header-icon currency"');
  });

  it("renders the character icon for the char category", () => {
    const html = renderBody([
      {
        name: "scol",
        type: "char",
        length: 20,
        format: "$CHAR20.",
        formatCategory: "char",
      },
    ]);
    assert.include(html, 'class="header-icon char"');
  });

  it("ignores category casing and surrounding whitespace", () => {
    const html = renderBody([
      {
        name: "dcol",
        type: "FLOAT",
        length: 8,
        format: "DATE9.",
        formatCategory: " DATE ",
      },
    ]);
    assert.include(html, 'class="header-icon date"');
  });

  it("falls back to the numeric icon for an unknown category", () => {
    const html = renderBody([
      {
        name: "ncol",
        type: "FLOAT",
        length: 8,
        format: "MYFMT12.2",
        formatCategory: "somethingelse",
      },
    ]);
    assert.include(html, 'class="header-icon float"');
  });

  it("falls back to the type icon when no category was resolved", () => {
    const html = renderBody([
      { name: "ncol", type: "FLOAT", length: 8, format: "MYFMT12.2" },
      { name: "ccol", type: "CHAR", length: 20, format: "" },
    ]);
    assert.include(html, 'class="header-icon float"');
    assert.include(html, 'class="header-icon char"');
  });

  it("still displays the raw format name", () => {
    const html = renderBody([
      {
        name: "objfmt",
        type: "NUMERIC",
        length: 8,
        format: { name: "DATE9." },
        formatCategory: "date",
      },
    ]);
    assert.include(html, 'class="header-icon date"');
    assert.ok(html.includes("DATE9."));
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
      { name: "ncol", type: "FLOAT", length: 8, format: "" },
    ]);

    assert.include(html, "Numeric");
  });

  it("displays Character for CHAR type", () => {
    const html = renderBody([
      { name: "ccol", type: "CHAR", length: 8, format: "" },
    ]);

    assert.include(html, "Character");
  });

  it("supports CHARACTER type", () => {
    const html = renderBody([
      { name: "ccol", type: "CHARACTER", length: 20, format: "" },
    ]);

    assert.include(html, "header-icon char");
  });
});
