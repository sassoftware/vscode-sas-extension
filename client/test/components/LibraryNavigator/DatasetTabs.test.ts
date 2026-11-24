// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Disposable, Uri, commands } from "vscode";

import { expect } from "chai";
import * as sinon from "sinon";

import LibraryNavigator from "../../../src/components/LibraryNavigator";
import PaginatedResultSet from "../../../src/components/LibraryNavigator/PaginatedResultSet";
import { LibraryItem } from "../../../src/components/LibraryNavigator/types";
import * as connection from "../../../src/connection";
import { Session } from "../../../src/connection/session";
import DataViewer from "../../../src/panels/DataViewer";
import { WebViewManager } from "../../../src/panels/WebviewManager";

class MockSession extends Session {
  protected async establishConnection(): Promise<void> {}
  protected async _run(): Promise<connection.RunResult> {
    return {};
  }
  protected _close(): void {}
  public sessionId(): undefined {
    return undefined;
  }
}

describe("Dataset tab labels and session changes", () => {
  let manager: WebViewManager;
  let subscriptions: Disposable[];
  const item: LibraryItem = {
    uid: "_XTMP000.CLASS",
    id: "CLASS",
    name: "CLASS",
    library: "_XTMP000",
    type: "table",
    readOnly: true,
  };
  const paginator = new PaginatedResultSet(async () => ({
    data: { rows: [], count: 0 },
  }));

  beforeEach(() => {
    sinon.stub(connection, "getSession").returns(new MockSession());
    sinon.stub(DataViewer.prototype, "render").returnsThis();
    manager = new WebViewManager();
    const navigator: LibraryNavigator = Object.create(
      LibraryNavigator.prototype,
    );
    Object.defineProperties(navigator, {
      extensionUri: { value: Uri.file(__dirname) },
      libraryDataProvider: { value: { getSubscriptions: () => [] } },
      webviewManager: { value: manager },
    });
    subscriptions = navigator.getSubscriptions();
  });

  afterEach(() => {
    Object.values(manager.panels).forEach((viewer) => viewer.dispose());
    subscriptions.forEach((subscription) => subscription.dispose());
    sinon.restore();
  });

  const openTable = (
    fileName?: string,
    table: LibraryItem = item,
    onClose?: () => Promise<void>,
  ) =>
    commands.executeCommand(
      "SAS.viewTable",
      table,
      paginator,
      () => [],
      fileName ? { fileName, onClose } : undefined,
    );

  it("uses the original filename while retaining the table identity", async () => {
    await openTable("class.sas7bdat");
    expect(manager.panels[item.uid].getPanel().title).to.equal(
      "class.sas7bdat",
    );
    expect(Object.keys(manager.panels)).to.deep.equal([item.uid]);
    const first = manager.panels[item.uid];
    await openTable("class.sas7bdat");
    expect(manager.panels[item.uid]).to.equal(first);
  });

  it("closes every dataset tab, case-insensitively, on a session change", async () => {
    await openTable("class.sas7bdat");
    const second = { ...item, uid: "_XTMP000.OTHER", name: "OTHER" };
    await openTable("other.SAS7BDAT", second);
    const firstInvalidation = sinon.spy(
      DataViewer.prototype,
      "invalidateColumns",
    );
    new MockSession().close();
    expect(Object.keys(manager.panels)).to.have.length(0);
    expect(firstInvalidation.called).to.equal(false);
  });

  it("deletes the associated library once when a dataset tab is closed", async () => {
    const onClose = sinon.stub().resolves();
    await openTable("class.SAS7BDAT", item, onClose);
    await openTable("class.SAS7BDAT", item, onClose);
    expect(onClose.called).to.equal(false);
    manager.panels[item.uid].getPanel().dispose();
    expect(onClose.calledOnce).to.equal(true);
    expect(manager.panels[item.uid]).to.equal(undefined);
  });

  it("also deletes the library when a session change closes the dataset tab", async () => {
    const onClose = sinon.stub().resolves();
    await openTable("class.sas7bdat", item, onClose);
    new MockSession().close();
    expect(onClose.calledOnce).to.equal(true);
  });
});
