import { Uri, TreeItemCollapsibleState } from "vscode";
import LibraryDataProvider from "../../../src/components/LibraryNavigator/LibraryDataProvider";
import LibraryModel from "../../../src/components/LibraryNavigator/LibraryModel";
import {
  Icons,
  Messages,
} from "../../../src/components/LibraryNavigator/const";
import { DataAccessApi } from "../../../src/connection/rest/api/compute";
import { getApiConfig } from "../../../src/connection/rest/common";
import { expect } from "chai";
import { sprintf } from "sprintf-js";
import * as nock from "nock";
import { LibraryItem } from "../../../src/components/LibraryNavigator/types";

class MockLibraryModel extends LibraryModel {
  constructor() {
    super();
    const apiConfig = getApiConfig();
    apiConfig.baseOptions.baseURL = "http://test.local";
    this.dataAccessApi = DataAccessApi(apiConfig);
    this.sessionId = "1234";
  }
}

const libraryDataProvider = () =>
  new LibraryDataProvider(new MockLibraryModel(), Uri.from({ scheme: "file" }));

describe("LibraryDataProvider", async function () {
  it("getChildren - returns tables with a content item", async () => {
    const library: LibraryItem = {
      uid: "lib",
      id: "lib",
      name: "lib",
      type: "library",
      readOnly: false,
    };

    nock("http://test.local")
      .get("/sessions/1234/data/lib?start=0&limit=100")
      .reply(200, {
        items: [
          {
            id: "table",
            name: "table",
          },
        ],
        count: 0,
      });

    const provider = libraryDataProvider();
    const children = await provider.getChildren(library);

    expect(children[0]).to.deep.equal({
      library: library.id,
      uid: `${library.id}.table`,
      id: "table",
      name: "table",
      type: "table",
      readOnly: library.readOnly,
    });
  });

  it("getChildren - returns libraries without content item", async () => {
    // One call to get libraries
    nock("http://test.local")
      .get("/sessions/1234/data?start=0&limit=100")
      .reply(200, {
        items: [
          {
            id: "library",
            name: "library",
          },
        ],
        count: 0,
      });

    // One to get
    nock("http://test.local").get("/sessions/1234/data/library").reply(200, {
      readOnly: true,
    });

    const provider = libraryDataProvider();
    const children = await provider.getChildren();

    expect(children[0]).to.deep.equal({
      library: undefined,
      uid: `.library`,
      id: "library",
      name: "library",
      type: "library",
      readOnly: true,
    });
  });

  it("getTreeItem - returns table tree item", async () => {
    const item: LibraryItem = {
      uid: "test",
      id: "test",
      name: "test",
      type: "table",
      readOnly: false,
    };

    const provider = libraryDataProvider();
    const treeItem = await provider.getTreeItem(item);
    expect(treeItem.id).to.equal(item.id);
    expect(Object.values(treeItem.iconPath)[0].path).to.contain(
      Icons.DataSet.light,
    );
    expect(treeItem.contextValue).to.contain("table-actionable");
    expect(treeItem.collapsibleState).to.equal(TreeItemCollapsibleState.None);
    expect(treeItem.command).to.contain({ command: "SAS.viewTable" });
  });

  it("getTreeItem - returns read only library", async () => {
    const item: LibraryItem = {
      uid: "test",
      id: "test",
      name: "test",
      type: "library",
      readOnly: true,
    };

    const provider = libraryDataProvider();
    const treeItem = await provider.getTreeItem(item);
    expect(treeItem.id).to.equal(item.id);
    expect(Object.values(treeItem.iconPath)[0].path).to.contain(
      Icons.ReadOnlyLibrary.light,
    );
    expect(treeItem.contextValue).to.contain("library-readonly");
    expect(treeItem.collapsibleState).to.equal(
      TreeItemCollapsibleState.Collapsed,
    );
    expect(treeItem.command === undefined).to.equal(true);
  });

  it("getTreeItem - returns regular library", async () => {
    const item: LibraryItem = {
      uid: "test",
      id: "test",
      name: "test",
      type: "library",
      readOnly: false,
    };

    const provider = libraryDataProvider();
    const treeItem = await provider.getTreeItem(item);
    expect(treeItem.id).to.equal(item.id);
    expect(Object.values(treeItem.iconPath)[0].path).to.contain(
      Icons.Library.light,
    );
    expect(treeItem.contextValue).to.contain("library-actionable");
    expect(treeItem.collapsibleState).to.equal(
      TreeItemCollapsibleState.Collapsed,
    );
    expect(treeItem.command === undefined).to.equal(true);
  });

  it("getTreeItem - returns work library", async () => {
    const item: LibraryItem = {
      uid: "WORK",
      id: "WORK",
      name: "WORK",
      type: "library",
      readOnly: false,
    };

    const provider = libraryDataProvider();
    const treeItem = await provider.getTreeItem(item);
    expect(treeItem.id).to.equal(item.id);
    expect(Object.values(treeItem.iconPath)[0].path).to.contain(
      Icons.WorkLibrary.light,
    );
    expect(treeItem.contextValue).to.contain("library-actionable");
    expect(treeItem.collapsibleState).to.equal(
      TreeItemCollapsibleState.Collapsed,
    );
    expect(treeItem.command === undefined).to.equal(true);
  });

  it("deleteTable - deletes a table successfully", async () => {
    const item: LibraryItem = {
      uid: "test",
      id: "test",
      name: "test",
      type: "table",
      readOnly: false,
      library: "lib",
    };

    nock("http://test.local").delete("/sessions/1234/data/lib/test").reply(200);

    const provider = libraryDataProvider();
    await provider.deleteTable(item);
  });

  it("deleteTable - fails with error message", async () => {
    const item: LibraryItem = {
      uid: "test",
      id: "test",
      name: "test",
      type: "table",
      readOnly: false,
      library: "lib",
    };

    nock("http://test.local").delete("/sessions/1234/data/lib/test").reply(500);

    const provider = libraryDataProvider();
    try {
      await provider.deleteTable(item);
    } catch (error) {
      expect(error.message).to.equal(
        new Error(sprintf(Messages.TableDeletionError, { tableName: "test" }))
          .message,
      );
    }
  });
});
