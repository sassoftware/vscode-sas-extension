import { expect } from "chai";
import sinon from "sinon";

import {
  LibraryItem,
  TableData,
} from "../../../src/components/LibraryNavigator/types";
import * as connection from "../../../src/connection";
import ItcLibraryAdapter from "../../../src/connection/itc/ItcLibraryAdapter";
import { MockSession } from "./Coderunner.test";

const mockOutput = (now) => ({
  COLOUTPUT: `
<COLOUTPUT>
first,char,1~last,char,2
</COLOUTPUT>`,
  LIBOUTPUT: `
<LIBOUTPUT>
test1,yes~test2,no
</LIBOUTPUT>
`,
  TABLEDATA: `
<TABLEDATA>
<Count>1234</Count>
{"SASTableData+TEST${now.getHours()}${now.getMinutes()}${now.getSeconds()}0": [["Peter","Parker"],["Tony","Stark"]]}
</TABLEDATA>`,
  "SELECT COUNT(1)": `<Count>1234</Count>`,
  TABLEOUTPUT: `
  <TABLEOUTPUT>
test1~test2
</TABLEOUTPUT>`,
});

describe("ItcLibraryAdapter tests", () => {
  let now;
  let clock;
  let sessionStub;
  before(() => {
    now = new Date();
    clock = sinon.useFakeTimers(now.getTime());
    sessionStub = sinon.stub(connection, "getSession");
    sessionStub.returns(new MockSession(mockOutput(now)));
  });

  after(() => {
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
        index: 1,
      },
      {
        name: "last",
        type: "char",
        index: 2,
      },
    ];

    const response = await libraryAdapter.getColumns(item);

    expect(response.items).to.eql(expectedColumns);
    expect(response.count).to.equal(-1);
  });

  it("loads libraries", async () => {
    const libraryAdapter = new ItcLibraryAdapter();
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
    const libraryAdapter = new ItcLibraryAdapter();
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

    const response = await libraryAdapter.getTables(library);

    expect(response.items).to.eql(expectedTables);
    expect(response.count).to.equal(-1);
  });
});
