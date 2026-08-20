import { Uri } from "vscode";

import { expect } from "chai";
import * as sinon from "sinon";

import LibraryNavigator from "../../../src/components/LibraryNavigator";
import PaginatedResultSet from "../../../src/components/LibraryNavigator/PaginatedResultSet";
import DataViewer from "../../../src/panels/DataViewer";

interface WebviewMessagePanel {
  webview: {
    postMessage: (message: { command: string }) => boolean;
  };
}

class RefreshTrackingPanel {
  public readonly refreshData = sinon.spy();
}

const createDataViewer = () =>
  new DataViewer(
    Uri.file("C:/temp"),
    "WORK.T_REFRESH",
    new PaginatedResultSet(async () => ({ data: { rows: [], count: 0 } })),
    () => [],
    () => {},
  );

describe("LibraryNavigator refresh flow", async function () {
  it("DataViewer.refreshData posts panel refresh message", () => {
    const dataViewer = createDataViewer();
    const postMessage = sinon.spy();

    const panel: WebviewMessagePanel = {
      webview: {
        postMessage,
      },
    };

    Object.defineProperty(dataViewer, "panel", {
      value: panel,
    });

    dataViewer.refreshData();

    expect(
      postMessage.calledOnceWithExactly({
        command: "panel:refreshData",
      }),
    ).to.equal(true);
  });

  it("refreshOpenTableViewers refreshes only open DataViewer panels", () => {
    const navigator: LibraryNavigator = Object.create(
      LibraryNavigator.prototype,
    );

    const tableViewer = createDataViewer();
    const tableViewerRefresh = sinon.stub(tableViewer, "refreshData");
    const nonTablePanel = new RefreshTrackingPanel();
    const webviewManager = {
      panels: {
        table: tableViewer,
        other: nonTablePanel,
      },
    };

    Object.defineProperty(navigator, "webviewManager", {
      value: webviewManager,
    });

    navigator.refreshOpenTableViewers();

    expect(tableViewerRefresh.calledOnce).to.equal(true);
    expect(nonTablePanel.refreshData.called).to.equal(false);
  });
});
