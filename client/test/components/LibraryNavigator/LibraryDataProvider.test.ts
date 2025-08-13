import { TreeItemCollapsibleState, Uri, l10n } from "vscode";

import { AxiosResponse } from "axios";
import { expect } from "chai";
import * as sinon from "sinon";

import LibraryDataProvider from "../../../src/components/LibraryNavigator/LibraryDataProvider";
import LibraryModel from "../../../src/components/LibraryNavigator/LibraryModel";
import {
  DefaultRecordLimit,
  Icons,
  Messages,
} from "../../../src/components/LibraryNavigator/const";
import { LibraryItem } from "../../../src/components/LibraryNavigator/types";
import RestLibraryAdapter from "../../../src/connection/rest/RestLibraryAdapter";
import { DataAccessApi } from "../../../src/connection/rest/api/compute";
import { getApiConfig } from "../../../src/connection/rest/common";

class MockRestLibraryAdapter extends RestLibraryAdapter {
  constructor(api: ReturnType<typeof DataAccessApi>) {
    super();
    this.dataAccessApi = api;
    this.sessionId = "1234";
  }
}

class MockLibraryModel extends LibraryModel {
  constructor(api: ReturnType<typeof DataAccessApi>) {
    super(new MockRestLibraryAdapter(api));
  }
}

const dataAccessApi = () => {
  const apiConfig = getApiConfig();
  apiConfig.baseOptions.baseURL = "https://test.local";
  return DataAccessApi(apiConfig);
};

const libraryDataProvider = (
  api: ReturnType<typeof DataAccessApi> = dataAccessApi(),
) =>
  new LibraryDataProvider(
    new MockLibraryModel(api),
    Uri.from({ scheme: "file" }),
  );

describe("LibraryDataProvider", async function () {
  it("getChildren - returns an empty array when no adapter is specified", async () => {
    const libraryDataProvider = new LibraryDataProvider(
      new LibraryModel(undefined),
      Uri.from({ scheme: "file" }),
    );
    const children = await libraryDataProvider.getChildren();

    expect(children.length).to.equal(0);
  });

  it("getChildren - returns tables with a content item", async () => {
    const library: LibraryItem = {
      uid: "lib",
      id: "lib",
      name: "lib",
      type: "library",
      readOnly: false,
    };

    const api = dataAccessApi();
    sinon
      .stub(api, "getTables")
      .withArgs({
        sessionId: "1234",
        libref: library.id,
        limit: DefaultRecordLimit,
        start: 0,
      })
      .resolves({
        data: {
          items: [
            {
              id: "table",
              name: "table",
            },
          ],
          count: 0,
        },
      } as AxiosResponse);

    const provider = libraryDataProvider(api);
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
    const api = dataAccessApi();
    // One call to get libraries
    sinon.stub(api, "getLibraries").resolves({
      data: {
        items: [
          {
            id: "library",
            name: "library",
          },
        ],
        count: 0,
      },
    } as AxiosResponse);

    // One to get library summary
    sinon.stub(api, "getLibrarySummary").resolves({
      data: {
        readOnly: true,
      },
    } as AxiosResponse);

    const provider = libraryDataProvider(api);
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

    const api = dataAccessApi();
    const deleteTableStub = sinon.stub(api, "deleteTable");

    const provider = libraryDataProvider(api);
    await provider.deleteTable(item);
    expect(deleteTableStub.calledOnce).to.equal(true);
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

    const api = dataAccessApi();
    const deleteTableStub = sinon.stub(api, "deleteTable");
    deleteTableStub.throwsException(new Error());

    const provider = libraryDataProvider(api);
    try {
      await provider.deleteTable(item);
    } catch (error) {
      expect(error.message).to.equal(
        new Error(l10n.t(Messages.TableDeletionError, { tableName: "test" }))
          .message,
      );
    }
  });
});
