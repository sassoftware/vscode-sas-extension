import { expect } from "chai";
import proxyquire from "proxyquire";
import sinon from "sinon";
import * as uuid from "uuid";

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
  let uuidStub: sinon.SinonStub;
  let ItcLibraryAdapter;
  beforeEach(() => {
    now = new Date();
    clock = sinon.useFakeTimers(now.getTime());
    sessionStub = sinon.stub(connection, "getSession");
    sessionStub.returns(new MockSession(mockOutput()));
    uuidStub = sinon.stub(uuid, "v4");
    uuidStub.returns("mocked-uuid");
    const codeRunner = proxyquire("../../../src/connection/itc/CodeRunner", {
      uuid: {
        v4: uuidStub,
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
    uuidStub.restore();
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

    const tableData = await libraryAdapter.getRows(item, 0, 100);

    expect(tableData).to.eql(expectedTableData);
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
});
