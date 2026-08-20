import { expect } from "chai";
import { readFileSync } from "fs";
import { join } from "path";
import proxyquire from "proxyquire";
import sinon from "sinon";

import {
  LibraryItem,
  TableData,
} from "../../../src/components/LibraryNavigator/types";
import * as connection from "../../../src/connection";
import { MockSession } from "./Coderunner.test";

const mockOutput = () => ({
  "SELECT COUNT(1)": `<Count>1234</Count>`,
});

class DatasetMockSession extends MockSession {
  private outputs: Array<string>;
  private calls = 0;
  public constructor(outputs: Array<string>) {
    super();
    this.outputs = outputs;
  }
  protected async execute(): Promise<void> {
    const output = `<mocked-uuid>${this.outputs[this.calls]}</mocked-uuid>`;
    this.calls += 1;
    this._logFn(output.split("\n").map((line) => ({ line, type: "normal" })));
  }
}
describe("ItcLibraryAdapter tests", () => {
  let now;
  let clock;
  let sessionStub;
  let ItcLibraryAdapter;
  beforeEach(() => {
    now = new Date();
    clock = sinon.useFakeTimers(now.getTime());
    sessionStub = sinon.stub(connection, "getSession");
    sessionStub.returns(new MockSession(mockOutput()));
    const codeRunner = proxyquire("../../../src/connection/itc/CodeRunner", {
      uuid: {
        v4: () => "mocked-uuid",
      },
    });
    ItcLibraryAdapter = proxyquire(
      "../../../src/connection/itc/ItcLibraryAdapter",
      {
        "./CodeRunner": codeRunner,
      },
    ).default;
  });

  afterEach(() => {
    clock.restore();
    sessionStub.restore();
  });

  it("fetches columns", async () => {
    const item: LibraryItem = {
      uid: "test",
      type: "table",
      id: "test",
      name: "test",
      readOnly: true,
    };

    const libraryAdapter = new ItcLibraryAdapter();
    const expectedColumns = [
      {
        name: "first",
        type: "char",
        format: "$8.",
        index: 1,
      },
      {
        name: "date",
        type: "date",
        format: "YYMMDD10.",
        index: 2,
      },
    ];

    const mockOutput = JSON.stringify([
      { index: 1, name: "first", type: "char", format: "$8." },
      { index: 2, name: "date", type: "num", format: "YYMMDD10." },
    ]);

    sessionStub.returns(new DatasetMockSession([mockOutput]));

    const response = await libraryAdapter.getColumns(item);

    expect(response.items).to.eql(expectedColumns);
    expect(response.count).to.equal(-1);
  });

  it("loads libraries", async () => {
    const expectedLibraries: LibraryItem[] = [
      {
        uid: "test1",
        id: "test1",
        name: "test1",
        type: "library",
        readOnly: true,
      },
      {
        uid: "test2",
        id: "test2",
        name: "test2",
        type: "library",
        readOnly: false,
      },
    ];

    const mockOutput = JSON.stringify({
      libraries: [
        ["test1", "yes"],
        ["test2", "no"],
      ],
      count: 2,
    });

    sessionStub.returns(new DatasetMockSession([mockOutput]));

    const libraryAdapter = new ItcLibraryAdapter();
    const response = await libraryAdapter.getLibraries();

    expect(response.items).to.eql(expectedLibraries);
    expect(response.count).to.equal(-1);
  });

  it("loads table data", async () => {
    const item: LibraryItem = {
      uid: "test",
      type: "table",
      id: "test",
      name: "TEST",
      readOnly: true,
    };

    const mockOutput = JSON.stringify({
      rows: [
        ["Peter", "Parker"],
        ["Tony", "Stark"],
      ],
      count: 1234,
    });

    sessionStub.returns(new DatasetMockSession([mockOutput]));

    const libraryAdapter = new ItcLibraryAdapter();
    const expectedTableData: TableData = {
      rows: [
        { cells: ["1", "Peter", "Parker"] },
        { cells: ["2", "Tony", "Stark"] },
      ],
      count: 1234,
    };

    const tableData = await libraryAdapter.getRows(item, 0, 100, []);

    expect(tableData).to.eql(expectedTableData);
  });

  it("drops temporary filtered views regardless of sort criteria", () => {
    const scriptPath = join(
      __dirname,
      "../../../../src/connection/itc/script/itc.ps1",
    );
    const script = readFileSync(scriptPath, "utf8");

    expect(script).to.match(/if \(\$sortCriteria -ne ""\)/);
    expect(script).to.match(/DROP VIEW \$tableName/);
  });

  it("sanitizes single quotes in filters before sending them to PowerShell", async () => {
    const item: LibraryItem = {
      uid: "test",
      type: "table",
      id: "test",
      name: "TEST",
      readOnly: true,
    };

    const allRowsOutput = JSON.stringify({
      rows: [
        ["Peter", "Parker"],
        ["Tony", "Stark"],
      ],
      count: 2,
    });

    const filteredRowsOutput = JSON.stringify({
      rows: [["Peter", "Parker"]],
      count: 1,
    });

    const executeRawCodeStub = sinon
      .stub()
      .onFirstCall()
      .resolves(allRowsOutput)
      .onSecondCall()
      .resolves(filteredRowsOutput);
    const codeRunner = {
      executeRawCode: executeRawCodeStub,
      runCode: sinon.stub(),
    };
    const ItcLibraryAdapterWithStub = proxyquire(
      "../../../src/connection/itc/ItcLibraryAdapter",
      {
        "./CodeRunner": codeRunner,
      },
    ).default;

    const libraryAdapter = new ItcLibraryAdapterWithStub();

    const unfilteredTableData = await libraryAdapter.getRows(item, 0, 100, []);

    const filteredTableData = await libraryAdapter.getRows(item, 0, 100, [], {
      filterValue: "first='Peter'",
    });

    expect(unfilteredTableData).to.eql({
      rows: [
        { cells: ["1", "Peter", "Parker"] },
        { cells: ["2", "Tony", "Stark"] },
      ],
      count: 2,
    });

    expect(executeRawCodeStub.secondCall.args[0]).to.match(/first.*Peter/);

    expect(filteredTableData).to.eql({
      rows: [{ cells: ["1", "Peter", "Parker"] }],
      count: 1,
    });
  });

  it("returns an empty dataset when ITC script errors occur for filters", async () => {
    const item: LibraryItem = {
      uid: "test",
      type: "table",
      id: "test",
      name: "TEST",
      readOnly: true,
    };

    const executeRawCodeStub = sinon
      .stub()
      .resolves("<ITCError>GetDatasetRecords error: invalid filter</ITCError>");
    const codeRunner = {
      executeRawCode: executeRawCodeStub,
      runCode: sinon.stub(),
    };
    const ItcLibraryAdapterWithStub = proxyquire(
      "../../../src/connection/itc/ItcLibraryAdapter",
      {
        "./CodeRunner": codeRunner,
      },
    ).default;

    const libraryAdapter = new ItcLibraryAdapterWithStub();

    const tableData = await libraryAdapter.getRows(item, 0, 100, [], {
      filterValue: "I_KNOW_THIS_WONT_WORK=1",
    });

    expect(tableData).to.eql({ rows: [], count: 0 });
  });

  it("loads table data for csv output", async () => {
    const item: LibraryItem = {
      uid: "test",
      type: "table",
      id: "test",
      name: "TEST",
      readOnly: true,
    };

    const mockOutputColumn = JSON.stringify([
      { index: 1, name: "first", type: "char", format: "$8." },
      { index: 2, name: "last", type: "num", format: "YYMMDD10." },
    ]);

    const mockOutputData = JSON.stringify({
      rows: [
        ["Peter", "Parker"],
        ["Tony", "Stark"],
      ],
      count: 1234,
    });

    sessionStub.returns(
      new DatasetMockSession([mockOutputColumn, mockOutputData]),
    );

    const libraryAdapter = new ItcLibraryAdapter();
    const expectedTableData: TableData = {
      rows: [
        { columns: ["INDEX", "first", "last"] },
        { cells: ["1", "Peter", "Parker"] },
        { cells: ["2", "Tony", "Stark"] },
      ],
      count: -1,
    };

    const tableData = await libraryAdapter.getRowsAsCSV(item, 0, 100);

    expect(tableData).to.eql(expectedTableData);
  });

  it("gets table row count", async () => {
    const item: LibraryItem = {
      uid: "test",
      type: "table",
      id: "test",
      name: "TEST",
      readOnly: true,
    };
    const libraryAdapter = new ItcLibraryAdapter();

    const response = await libraryAdapter.getTableRowCount(item);
    expect(response.rowCount).to.equal(1234);
  });

  it("loads a list of tables", async () => {
    const library: LibraryItem = {
      uid: "lib",
      id: "lib",
      name: "lib",
      type: "library",
      readOnly: true,
    };

    const mockOutput = JSON.stringify({
      tables: ["test1", "test2"],
      count: 2,
    });

    sessionStub.returns(new DatasetMockSession([mockOutput]));

    const expectedTables: LibraryItem[] = [
      {
        library: "lib",
        uid: "lib.test1",
        id: "test1",
        name: "test1",
        type: "table",
        readOnly: true,
      },
      {
        library: "lib",
        uid: "lib.test2",
        id: "test2",
        name: "test2",
        type: "table",
        readOnly: true,
      },
    ];

    const libraryAdapter = new ItcLibraryAdapter();
    const response = await libraryAdapter.getTables(library);

    expect(response.items).to.eql(expectedTables);
    expect(response.count).to.equal(-1);
  });

  it("returns no results for invalid filter and all results when filter is cleared", async () => {
    const item: LibraryItem = {
      uid: "test",
      type: "table",
      id: "test",
      name: "TEST",
      readOnly: true,
    };

    const allRowsOutput = JSON.stringify({
      rows: [
        ["Peter", "Parker"],
        ["Tony", "Stark"],
        ["Bruce", "Banner"],
      ],
      count: 3,
    });

    const noRowsOutput = JSON.stringify({
      rows: [],
      count: 0,
    });

    const executeRawCodeStub = sinon
      .stub()
      .onFirstCall()
      .resolves(noRowsOutput)
      .onSecondCall()
      .resolves(allRowsOutput);

    const codeRunner = {
      executeRawCode: executeRawCodeStub,
      runCode: sinon.stub(),
    };

    const ItcLibraryAdapterWithStub = proxyquire(
      "../../../src/connection/itc/ItcLibraryAdapter",
      {
        "./CodeRunner": codeRunner,
      },
    ).default;

    const libraryAdapter = new ItcLibraryAdapterWithStub();

    // Test 1: Invalid filter returns no results
    const tableDataWithFilter = await libraryAdapter.getRows(item, 0, 100, [], {
      filterValue: "TEST=1",
    });

    expect(tableDataWithFilter).to.eql({ rows: [], count: 0 });

    // Test 2: Clearing filter returns all rows
    const tableDataWithoutFilter = await libraryAdapter.getRows(
      item,
      0,
      100,
      [],
    );

    expect(tableDataWithoutFilter).to.eql({
      rows: [
        { cells: ["1", "Peter", "Parker"] },
        { cells: ["2", "Tony", "Stark"] },
        { cells: ["3", "Bruce", "Banner"] },
      ],
      count: 3,
    });
  });
});
