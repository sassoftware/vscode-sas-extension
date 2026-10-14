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
  let sandbox: SinonSandbox;
  let webview: StubbedInstance<Webview>;
  let fetchColumns: SinonStub;
  let loadColumnProperties: SinonStub;
  let showErrorMessage: SinonStub;
  let viewer: TestDataViewer;

  beforeEach(() => {
    sandbox = createSandbox();

    webview = stubInterface<Webview>();
    const panel = stubInterface<WebviewPanel>();

    fetchColumns = sandbox.stub();
    loadColumnProperties = sandbox.stub();
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

  it("refreshes data in the webview", () => {
    viewer.refreshData();

    expect(webview.postMessage.calledOnce).to.equal(true);
    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      command: "panel:refreshData",
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

  it("returns an error when loading columns fails", async () => {
    fetchColumns.throws(new Error("Unable to fetch columns"));

    await viewer.processMessage(
      new DataViewerMessageEvent("request:loadColumns"),
    );

    expect(fetchColumns.calledOnce).to.equal(true);

    expect(webview.postMessage.calledOnce).to.equal(true);
    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      key: "request-key",
      command: "response:loadColumns",
      error: "Unable to fetch columns",
    });
  });

  it("shows an error when loading columns fails", async () => {
    fetchColumns.throws(new Error("Unable to fetch columns"));

    await viewer.processMessage(
      new DataViewerMessageEvent("request:loadColumns"),
    );

    expect(showErrorMessage.calledOnce).to.equal(true);
    expect(
      showErrorMessage.calledWithExactly("Unable to fetch columns"),
    ).to.equal(true);
  });

  it("converts a non-Error column loading failure to a message", async () => {
    fetchColumns.callsFake(() => {
      throw "Unable to fetch columns";
    });

    await viewer.processMessage(
      new DataViewerMessageEvent("request:loadColumns"),
    );

    expect(webview.postMessage.calledOnce).to.equal(true);
    expect(webview.postMessage.firstCall.args[0]).to.deep.equal({
      key: "request-key",
      command: "response:loadColumns",
      error: "Unable to fetch columns",
    });

    expect(
      showErrorMessage.calledWithExactly("Unable to fetch columns"),
    ).to.equal(true);
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
