import { Uri } from "vscode";

import { expect } from "chai";
import * as sinon from "sinon";

import LibraryNavigator from "../../../src/components/LibraryNavigator";
import PaginatedResultSet from "../../../src/components/LibraryNavigator/PaginatedResultSet";
import type { RunResult } from "../../../src/connection";
import { Session } from "../../../src/connection/session";
import DataViewer from "../../../src/panels/DataViewer";
import TablePropertiesViewer from "../../../src/panels/TablePropertiesViewer";

interface WebviewMessagePanel {
  webview: {
    postMessage: (message: { command: string }) => boolean;
  };
}

class RefreshTrackingPanel {
  public readonly refreshData = sinon.spy();
  public readonly invalidateColumns = sinon.spy();
}

class MockSession extends Session {
  protected async establishConnection(): Promise<void> {}

  protected _run(): Promise<RunResult> {
    throw new Error("Method not implemented.");
  }

  protected _close(): Promise<void> | void {}

  public sessionId(): string | undefined {
    return;
  }
}

const createDataViewer = () =>
  new DataViewer(
    Uri.file("C:/temp"),
    "WORK.T_REFRESH",
    new PaginatedResultSet(async () => ({ data: { rows: [], count: 0 } })),
    () => [],
    () => {},
  );

const createTablePropertiesViewer = () =>
  new TablePropertiesViewer(
    Uri.file("C:/temp"),
    "WORK.T_REFRESH",
    {
      name: "T_REFRESH",
      libref: "WORK",
    },
    [
      {
        name: "date",
        type: "num",
        format: "YYMMDD10.",
        index: 2,
        formatCategory: "date",
      },
    ],
    false,
    "",
    async () => ({ name: "T_REFRESH", libref: "WORK" }),
    async () => [
      {
        name: "updatedDate",
        type: "num",
        format: "YYMMDD10.",
        index: 2,
        formatCategory: "date",
      },
    ],
  );

const createNavigatorForSessionChange = (
  panels: Record<string, unknown>,
): LibraryNavigator => {
  const navigator: LibraryNavigator = Object.create(LibraryNavigator.prototype);

  Object.defineProperty(navigator, "libraryDataProvider", {
    value: {
      getSubscriptions: () => [],
    },
  });

  Object.defineProperty(navigator, "webviewManager", {
    value: {
      panels,
    },
  });

  return navigator;
};

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

  it("refreshOpenTableViewers refreshes open DataViewer and TablePropertiesViewer panels", () => {
    const navigator: LibraryNavigator = Object.create(
      LibraryNavigator.prototype,
    );

    const tableViewer = createDataViewer();
    const tableViewerRefresh = sinon.stub(tableViewer, "refreshData");
    const tablePropertiesViewer = createTablePropertiesViewer();
    const tablePropertiesViewerRefresh = sinon.stub(
      tablePropertiesViewer,
      "refreshData",
    );
    const nonTablePanel = new RefreshTrackingPanel();
    const webviewManager = {
      panels: {
        table: tableViewer,
        tableProperties: tablePropertiesViewer,
        other: nonTablePanel,
      },
    };

    Object.defineProperty(navigator, "webviewManager", {
      value: webviewManager,
    });

    navigator.refreshOpenTableViewers();

    expect(tableViewerRefresh.calledOnce).to.equal(true);
    expect(tablePropertiesViewerRefresh.calledOnce).to.equal(true);
    expect(nonTablePanel.refreshData.called).to.equal(false);
  });

  it("invalidates an open DataViewer when the session changes", () => {
    const tableViewer = createDataViewer();
    const invalidateColumns = sinon.stub(tableViewer, "invalidateColumns");

    const navigator = createNavigatorForSessionChange({
      table: tableViewer,
    });

    const subscriptions = navigator.getSubscriptions();

    const session = new MockSession();

    session.close();

    expect(invalidateColumns.calledOnce).to.equal(true);

    subscriptions.forEach((subscription) => subscription.dispose());
  });

  it("does not invalidate non-DataViewer panels when the session changes", () => {
    const tableViewer = createDataViewer();
    const invalidateColumns = sinon.stub(tableViewer, "invalidateColumns");

    const nonDataViewer = new RefreshTrackingPanel();

    const navigator = createNavigatorForSessionChange({
      table: tableViewer,
      other: nonDataViewer,
    });

    const subscriptions = navigator.getSubscriptions();

    const session = new MockSession();

    session.close();

    expect(invalidateColumns.calledOnce).to.equal(true);
    expect(nonDataViewer.invalidateColumns.called).to.equal(false);

    subscriptions.forEach((subscription) => subscription.dispose());
  });
});
