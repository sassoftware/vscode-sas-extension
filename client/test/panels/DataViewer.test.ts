// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri, Webview, WebviewPanel, window } from "vscode";

import { expect } from "chai";
import { SinonSandbox, SinonStub, createSandbox } from "sinon";
import { StubbedInstance, stubInterface } from "ts-sinon";

import PaginatedResultSet from "../../src/components/LibraryNavigator/PaginatedResultSet";
import type {
  TableData,
  TableQuery,
} from "../../src/components/LibraryNavigator/types";
import DataViewer from "../../src/panels/DataViewer";

class TestDataViewer extends DataViewer {
  public attachPanel(panel: WebviewPanel): void {
    this.panel = panel;
  }
}

class DataViewerMessageEvent extends Event {
  public constructor(
    public readonly command: string,
    public readonly key: string = "request-key",
    public readonly data?: {
      start?: number;
      end?: number;
      sortModel?: [];
      columnName?: string;
      query: TableQuery | undefined;
    },
  ) {
    super("message");
  }
}

describe("DataViewer panel", () => {
  const initialTimestamp = "2026-11-03T00:00:00";
  const updatedTimestamp = "2026-11-04T00:00:00";

  let sandbox: SinonSandbox;
  let webview: StubbedInstance<Webview>;
  let fetchColumns: SinonStub;
  let loadColumnProperties: SinonStub;
  let getTableInfo: SinonStub;
  let showErrorMessage: SinonStub;
  let viewer: TestDataViewer;

  beforeEach(() => {
    sandbox = createSandbox();

    webview = stubInterface<Webview>();
    const panel = stubInterface<WebviewPanel>();

    fetchColumns = sandbox.stub();
    loadColumnProperties = sandbox.stub();
    getTableInfo = sandbox.stub().resolves({
      modifiedTimeStamp: initialTimestamp,
    });
    showErrorMessage = sandbox.stub(window, "showErrorMessage");

    Object.defineProperty(panel, "webview", {
      configurable: true,
      value: webview,
    });

    const paginator = new PaginatedResultSet<{
      data: TableData;
      error?: Error;
    }>(async () => ({
      data: {
        rows: [],
        count: 0,
      },
    }));

    viewer = new TestDataViewer(
      Uri.file("/extension"),
      "TEST.TABLE",
      paginator,
      fetchColumns,
      loadColumnProperties,
      false,
      getTableInfo,
    );

    viewer.attachPanel(panel);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("invalidates columns in the webview", () => {
    viewer.invalidateColumns();

    expect(webview.postMessage.calledOnce).to.equal(true);
    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      command: "panel:invalidateColumns",
    });
  });

  it("refreshes data in the webview", async () => {
    await viewer.refreshData();

    expect(webview.postMessage.calledOnce).to.equal(true);
    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      command: "panel:refreshData",
    });
  });

  it("initializes the timestamp and reports no change when unchanged", async () => {
    await viewer.initializeModifiedTimeStamp();

    expect(getTableInfo.calledOnce).to.equal(true);

    await viewer.processMessage(
      new DataViewerMessageEvent("request:refreshData"),
    );

    expect(getTableInfo.calledTwice).to.equal(true);
    expect(webview.postMessage.calledOnce).to.equal(true);
    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      command: "panel:refreshData",
      data: {
        hasChanged: false,
        modifiedTimeStamp: initialTimestamp,
      },
    });
  });

  it("detects timestamp changes and synchronizes the new timestamp", async () => {
    await viewer.initializeModifiedTimeStamp();

    getTableInfo.resolves({
      modifiedTimeStamp: updatedTimestamp,
    });

    await viewer.processMessage(
      new DataViewerMessageEvent("request:refreshData"),
    );

    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      command: "panel:refreshData",
      data: {
        hasChanged: true,
        modifiedTimeStamp: updatedTimestamp,
      },
    });

    webview.postMessage.resetHistory();

    await viewer.refreshData(true);

    expect(webview.postMessage.calledOnce).to.equal(true);
    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      command: "panel:refreshData",
      data: {
        hasChanged: false,
        modifiedTimeStamp: updatedTimestamp,
      },
    });
  });

  it("forces refresh after session invalidation", async () => {
    await viewer.initializeModifiedTimeStamp();

    viewer.invalidateSession();

    await viewer.refreshData(true);

    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      command: "panel:refreshData",
      data: {
        hasChanged: true,
        modifiedTimeStamp: initialTimestamp,
      },
    });

    webview.postMessage.resetHistory();

    await viewer.refreshData(true);

    expect(webview.postMessage.calledOnce).to.equal(true);
    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      command: "panel:refreshData",
      data: {
        hasChanged: false,
        modifiedTimeStamp: initialTimestamp,
      },
    });
  });

  it("ignores overlapping manual refresh requests", async () => {
    let resolveMetadata!: (value: { modifiedTimeStamp?: string }) => void;

    const pendingMetadata = new Promise<{
      modifiedTimeStamp?: string;
    }>((resolve) => {
      resolveMetadata = resolve;
    });

    getTableInfo.returns(pendingMetadata);

    const firstRefresh = viewer.refreshData(true);
    const secondRefresh = viewer.refreshData(true);

    expect(getTableInfo.calledOnce).to.equal(true);
    expect(webview.postMessage.called).to.equal(false);

    resolveMetadata({
      modifiedTimeStamp: updatedTimestamp,
    });

    await Promise.all([firstRefresh, secondRefresh]);

    expect(webview.postMessage.calledOnce).to.equal(true);
    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      command: "panel:refreshData",
      data: {
        hasChanged: true,
        modifiedTimeStamp: updatedTimestamp,
      },
    });
  });

  it("returns columns when loading columns succeeds", async () => {
    const columns = [
      {
        name: "NAME",
        type: "CHAR",
      },
      {
        name: "AGE",
        type: "NUM",
      },
    ];

    fetchColumns.returns(columns);

    await viewer.processMessage(
      new DataViewerMessageEvent("request:loadColumns"),
    );

    expect(fetchColumns.calledOnce).to.equal(true);

    expect(webview.postMessage.calledOnce).to.equal(true);
    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      key: "request-key",
      command: "response:loadColumns",
      data: {
        columns,
      },
    });

    expect(showErrorMessage.called).to.equal(false);
  });

  it("loads properties for the requested column", async () => {
    await viewer.processMessage(
      new DataViewerMessageEvent(
        "request:loadColumnProperties",
        "request-key",
        {
          columnName: "NAME",
          query: undefined,
        },
      ),
    );

    expect(loadColumnProperties.calledOnce).to.equal(true);
    expect(loadColumnProperties.calledWithExactly("NAME")).to.equal(true);
  });
});
