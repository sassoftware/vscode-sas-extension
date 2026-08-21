// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n, window } from "vscode";

import { expect } from "chai";
import * as sinon from "sinon";

import ContentNavigator from "../../../src/components/ContentNavigator";
import { Messages } from "../../../src/components/ContentNavigator/const";
import { ContentItem } from "../../../src/components/ContentNavigator/types";

interface DeleteState {
  resource: ContentItem;
  isContainer: boolean;
  hasUnsavedFiles: boolean;
  moveToRecycleBin: boolean;
}

const createItem = (name: string): ContentItem => ({
  creationTimeStamp: 0,
  id: name,
  links: [],
  modifiedTimeStamp: 0,
  name,
  permission: {
    addMember: true,
    delete: true,
    write: true,
  },
  uri: `uri://${name}`,
});

const callConfirmDelete = (deleteStates: DeleteState[]) => {
  const navigator = Object.create(ContentNavigator.prototype);
  return navigator.confirmDelete(deleteStates);
};

describe("ContentNavigator confirmDelete", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("returns true and skips confirmation for clean recyclable selection", async () => {
    const showWarningMessageStub = sinon.stub(window, "showWarningMessage");

    const confirmed = await callConfirmDelete([
      {
        hasUnsavedFiles: false,
        isContainer: true,
        moveToRecycleBin: true,
        resource: createItem("folder-a"),
      },
      {
        hasUnsavedFiles: false,
        isContainer: true,
        moveToRecycleBin: true,
        resource: createItem("folder-b"),
      },
    ]);

    expect(confirmed).to.equal(true);
    expect(showWarningMessageStub.called).to.equal(false);
  });

  it("shows single permanent-delete message for one non-recyclable item", async () => {
    const showWarningMessageStub = sinon
      .stub(window, "showWarningMessage")
      .callsFake(async () => ({ title: Messages.DeleteButtonLabel }));

    const resource = createItem("single-folder");
    const confirmed = await callConfirmDelete([
      {
        hasUnsavedFiles: false,
        isContainer: true,
        moveToRecycleBin: false,
        resource,
      },
    ]);

    expect(confirmed).to.equal(true);
    expect(showWarningMessageStub.calledOnce).to.equal(true);
    const args = showWarningMessageStub.getCall(0).args;
    expect(args[0]).to.equal(
      l10n.t(Messages.DeleteWarningMessage, {
        name: resource.name,
      }),
    );
    expect(args[1]).to.deep.equal({ modal: true });
    expect(args[2]).to.equal(Messages.DeleteButtonLabel);
  });

  it("shows multiple permanent-delete message with item count", async () => {
    const showWarningMessageStub = sinon
      .stub(window, "showWarningMessage")
      .callsFake(async () => ({ title: Messages.DeleteButtonLabel }));

    const deleteStates: DeleteState[] = [
      {
        hasUnsavedFiles: false,
        isContainer: true,
        moveToRecycleBin: true,
        resource: createItem("folder-a"),
      },
      {
        hasUnsavedFiles: false,
        isContainer: true,
        moveToRecycleBin: false,
        resource: createItem("folder-b"),
      },
    ];

    const confirmed = await callConfirmDelete(deleteStates);

    expect(confirmed).to.equal(true);
    expect(showWarningMessageStub.calledOnce).to.equal(true);
    const args = showWarningMessageStub.getCall(0).args;
    expect(args[0]).to.equal(
      l10n.t(Messages.DeleteDirtyItemsWarningMessage, {
        count: deleteStates.length,
      }),
    );
    expect(args[1]).to.deep.equal({ modal: true });
    expect(args[2]).to.equal(Messages.DeleteButtonLabel);
  });

  it("shows dirty warning with Move to Recycle Bin action for recyclable dirty folders", async () => {
    const showWarningMessageStub = sinon
      .stub(window, "showWarningMessage")
      .callsFake(async () => ({ title: Messages.MoveToRecycleBinLabel }));

    const confirmed = await callConfirmDelete([
      {
        hasUnsavedFiles: true,
        isContainer: true,
        moveToRecycleBin: true,
        resource: createItem("dirty-folder"),
      },
    ]);

    expect(confirmed).to.equal(true);
    expect(showWarningMessageStub.calledOnce).to.equal(true);
    const args = showWarningMessageStub.getCall(0).args;
    expect(args[0]).to.equal(l10n.t(Messages.DirtyFolderWarning));
    expect(args[1]).to.deep.equal({ modal: true });
    expect(args[2]).to.equal(Messages.MoveToRecycleBinLabel);
  });

  it("shows dirty warning with Delete action when selection includes permanent delete", async () => {
    const showWarningMessageStub = sinon
      .stub(window, "showWarningMessage")
      .callsFake(async () => ({ title: Messages.DeleteButtonLabel }));

    const confirmed = await callConfirmDelete([
      {
        hasUnsavedFiles: true,
        isContainer: true,
        moveToRecycleBin: true,
        resource: createItem("dirty-folder"),
      },
      {
        hasUnsavedFiles: false,
        isContainer: false,
        moveToRecycleBin: false,
        resource: createItem("non-recyclable-item"),
      },
    ]);

    expect(confirmed).to.equal(true);
    expect(showWarningMessageStub.calledOnce).to.equal(true);
    const args = showWarningMessageStub.getCall(0).args;
    expect(args[0]).to.equal(l10n.t(Messages.DirtyFolderWarning));
    expect(args[1]).to.deep.equal({ modal: true });
    expect(args[2]).to.equal(Messages.DeleteButtonLabel);
  });

  it("returns false when user cancels confirmation", async () => {
    sinon.stub(window, "showWarningMessage").resolves(undefined);

    const confirmed = await callConfirmDelete([
      {
        hasUnsavedFiles: false,
        isContainer: false,
        moveToRecycleBin: false,
        resource: createItem("single-item"),
      },
    ]);

    expect(confirmed).to.equal(false);
  });
});
