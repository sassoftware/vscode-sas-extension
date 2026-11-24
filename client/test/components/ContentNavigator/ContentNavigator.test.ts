// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { CancellationTokenSource, Uri, commands, l10n, window } from "vscode";

import { expect } from "chai";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { basename, join } from "path";
import * as sinon from "sinon";

import { profileConfig } from "../../../src/commands/profile";
import ContentNavigator from "../../../src/components/ContentNavigator";
import { Messages } from "../../../src/components/ContentNavigator/const";
import {
  ContentItem,
  ContentSourceType,
} from "../../../src/components/ContentNavigator/types";
import LibraryAdapterFactory from "../../../src/components/LibraryNavigator/LibraryAdapterFactory";
import LibraryModel from "../../../src/components/LibraryNavigator/LibraryModel";
import { LibraryItem } from "../../../src/components/LibraryNavigator/types";
import { ConnectionType } from "../../../src/components/profile";
import RestLibraryAdapter from "../../../src/connection/rest/RestLibraryAdapter";

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

describe("ContentNavigator dataset opening", () => {
  let navigator: ReturnType<typeof Object.create>;
  let acquire: sinon.SinonStub;
  let execute: sinon.SinonStub;
  let getTables: sinon.SinonStub;
  let showError: sinon.SinonStub;
  let deleteLibrary: sinon.SinonStub;
  const table: LibraryItem = {
    uid: "_XTMP000.CLASS",
    id: "CLASS",
    name: "CLASS",
    library: "_XTMP000",
    type: "table",
    readOnly: true,
  };

  beforeEach(() => {
    sinon.stub(profileConfig, "getActiveProfile").returns("test");
    sinon.stub(profileConfig, "getProfileByName").returns({
      connectionType: ConnectionType.Rest,
      endpoint: "https://example.test",
    });
    const adapter = new RestLibraryAdapter();
    sinon.stub(LibraryAdapterFactory.prototype, "create").returns(adapter);
    acquire = sinon.stub(adapter, "acquireTemporaryLibrary");
    deleteLibrary = sinon.stub().resolves();
    acquire.resolves({ name: "_TEMP1", delete: deleteLibrary });
    getTables = sinon
      .stub(LibraryModel.prototype, "getTables")
      .resolves([table]);
    execute = sinon.stub(commands, "executeCommand").resolves();
    showError = sinon.stub(window, "showErrorMessage");
    navigator = Object.create(ContentNavigator.prototype);
    navigator.sourceType = ContentSourceType.SASServer;
    navigator.openDatasetViewers = new Map<string, string>();
    navigator.contentDataProvider = {
      getPathOfItem: sinon.stub().resolves("/data/class.SAS7BDAT"),
    };
  });

  afterEach(() => sinon.restore());

  it("opens the matching dataset through the existing Data Viewer", async () => {
    await navigator.openDataset(createItem("class.SAS7BDAT"));
    expect(acquire.calledOnceWithExactly("/data")).to.equal(true);
    expect(execute.firstCall.args[0]).to.equal("SAS.viewTable");
    expect(execute.firstCall.args[1]).to.deep.equal(table);
    expect(execute.firstCall.args[3]).to.be.a("function");
    expect(execute.firstCall.args[4].fileName).to.equal("class.SAS7BDAT");
    expect(showError.called).to.equal(false);
    expect(deleteLibrary.called).to.equal(false);
    await execute.firstCall.args[4].onClose();
    expect(deleteLibrary.calledOnce).to.equal(true);
  });

  it("reports missing datasets", async () => {
    getTables.resolves([]);
    await navigator.openDataset(createItem("class.sas7bdat"));
    expect(showError.calledOnce).to.equal(true);
    expect(showError.firstCall.args[0]).to.contain("was not found");
    expect(execute.called).to.equal(false);
  });

  it("reports table lookup or opening failures", async () => {
    getTables.rejects(new Error("Cannot list tables"));
    await navigator.openDataset(createItem("class.sas7bdat"));
    expect(showError.firstCall.args[0]).to.contain("Cannot list tables");

    getTables.resolves([table]);
    execute.rejects(new Error("Cannot open viewer"));
    await navigator.openDataset(createItem("class.sas7bdat"));
    expect(showError.secondCall.args[0]).to.contain("Cannot open viewer");
  });

  it("does not interpret a SAS Content URI as a server filesystem path", async () => {
    navigator.sourceType = ContentSourceType.SASContent;
    await navigator.openDataset(createItem("class.sas7bdat"));
    expect(acquire.called).to.equal(false);
    expect(showError.calledOnce).to.equal(true);
  });
});

describe("opening local datasets", () => {
  let navigator: ReturnType<typeof Object.create>;
  let acquire: sinon.SinonStub;
  let execute: sinon.SinonStub;
  let showError: sinon.SinonStub;
  let deleteLibrary: sinon.SinonStub;
  const table: LibraryItem = {
    uid: "_XTMP000.CLASS",
    id: "CLASS",
    name: "CLASS",
    library: "_XTMP000",
    type: "table",
    readOnly: true,
  };

  let localPath: string;
  let localUri: Uri;
  let uploadFolder: ContentItem;
  let uploadedFile: ContentItem;
  let setup: sinon.SinonStub;

  beforeEach(() => {
    sinon.stub(profileConfig, "getActiveProfile").returns("test");
    sinon.stub(profileConfig, "getProfileByName").returns({
      connectionType: ConnectionType.Rest,
      endpoint: "https://example.test",
    });
    const adapter = new RestLibraryAdapter();
    sinon.stub(LibraryAdapterFactory.prototype, "create").returns(adapter);
    acquire = sinon.stub(adapter, "acquireTemporaryLibrary");
    deleteLibrary = sinon.stub().resolves();
    acquire.resolves({ name: "_TEMP1", delete: deleteLibrary });
    sinon.stub(LibraryModel.prototype, "getTables").resolves([table]);
    execute = sinon.stub(commands, "executeCommand").resolves();
    showError = sinon.stub(window, "showErrorMessage");

    navigator = Object.create(ContentNavigator.prototype);
    navigator.sourceType = ContentSourceType.SASServer;
    navigator.openDatasetViewers = new Map<string, string>();
    navigator.contentDataProvider = {
      getPathOfItem: sinon
        .stub()
        .resolves("/tmp/vscode-sas-123/class.sas7bdat"),
    };

    localPath = mkdtempSync(join(tmpdir(), "sas-local-dataset-"));
    writeFileSync(join(localPath, "class.sas7bdat"), Buffer.from([1, 2, 3]));
    localUri = Uri.file(join(localPath, "class.sas7bdat"));
    uploadFolder = {
      ...createItem("vscode-sas-123"),
      uri: "~fs~tmp~fs~vscode-sas-123",
    };
    uploadedFile = {
      ...createItem("class.sas7bdat"),
      uri: "~fs~tmp~fs~vscode-sas-123~fs~class.sas7bdat",
    };
    setup = sinon.stub().resolves();
    navigator.contentModel = {
      getAdapter: sinon.stub().returns({ setup }),
      createFolder: sinon.stub().resolves(uploadFolder),
      createFile: sinon.stub().resolves(uploadedFile),
      delete: sinon.stub().resolves(true),
    };
    sinon
      .stub(window, "withProgress")
      .callsFake((_options, task) =>
        task({ report: () => {} }, new CancellationTokenSource().token),
      );
  });

  afterEach(() => {
    sinon.restore();
    rmSync(localPath, { recursive: true, force: true });
  });

  it("uploads the file to a unique /tmp folder and opens it in the Data Viewer", async () => {
    await navigator.openLocalDataset(localUri);

    expect(setup.calledOnce).to.equal(true);
    const [parentFolder, folderName] =
      navigator.contentModel.createFolder.firstCall.args;
    expect(parentFolder.uri).to.equal("~fs~tmp");
    expect(folderName).to.equal(`local-table-${basename(localPath)}-class`);

    const [targetFolder, fileName, contents] =
      navigator.contentModel.createFile.firstCall.args;
    expect(targetFolder).to.equal(uploadFolder);
    expect(fileName).to.equal("class.sas7bdat");
    expect([...contents]).to.deep.equal([1, 2, 3]);

    expect(acquire.calledOnceWithExactly("/tmp/vscode-sas-123")).to.equal(true);
    expect(execute.firstCall.args[0]).to.equal("SAS.viewTable");
    expect(execute.firstCall.args[1]).to.deep.equal(table);
    expect(execute.firstCall.args[4].fileName).to.equal("class.sas7bdat");
    expect(showError.called).to.equal(false);
    expect(deleteLibrary.called).to.equal(false);
    expect(navigator.contentModel.delete.called).to.equal(false);
  });

  it("removes the library, uploaded file, and folder when the viewer closes", async () => {
    await navigator.openLocalDataset(localUri);
    await execute.firstCall.args[4].onClose();

    expect(deleteLibrary.calledOnce).to.equal(true);
    expect(
      navigator.contentModel.delete.getCalls().map((call) => call.args[0]),
    ).to.deep.equal([uploadedFile, uploadFolder]);
  });
});

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
    expect(args[0]).to.equal(l10n.t(Messages.DirtyFolderWarningSingle));
    expect(args[1]).to.deep.equal({ modal: true });
    expect(args[2]).to.equal(Messages.MoveToRecycleBinLabel);
  });

  it("shows one shared dirty warning for multiple dirty folders", async () => {
    const showWarningMessageStub = sinon
      .stub(window, "showWarningMessage")
      .callsFake(async () => ({ title: Messages.MoveToRecycleBinLabel }));

    const confirmed = await callConfirmDelete([
      {
        hasUnsavedFiles: true,
        isContainer: true,
        moveToRecycleBin: true,
        resource: createItem("testD"),
      },
      {
        hasUnsavedFiles: true,
        isContainer: true,
        moveToRecycleBin: true,
        resource: createItem("NotEmptyFolder"),
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
    expect(args[0]).to.equal(l10n.t(Messages.DirtyFolderWarningSingle));
    expect(args[1]).to.deep.equal({ modal: true });
    expect(args[2]).to.equal(Messages.DeleteButtonLabel);
  });

  it("shows permanent-delete message for recycle bin item even if files were open", async () => {
    // items in Recycle Bin are non-recyclable; caller must pass hasUnsavedFiles: false
    // to reflect that dirty check is skipped for recycled items
    const showWarningMessageStub = sinon
      .stub(window, "showWarningMessage")
      .callsFake(async () => ({ title: Messages.DeleteButtonLabel }));

    const resource = createItem("recycled-folder");
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
      l10n.t(Messages.DeleteWarningMessage, { name: resource.name }),
    );
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

  it("returns false and does not continue when user cancels dirty warning", async () => {
    const showWarningMessageStub = sinon
      .stub(window, "showWarningMessage")
      .resolves(undefined);

    const confirmed = await callConfirmDelete([
      {
        hasUnsavedFiles: true,
        isContainer: true,
        moveToRecycleBin: true,
        resource: createItem("dirty-folder"),
      },
      {
        hasUnsavedFiles: true,
        isContainer: true,
        moveToRecycleBin: true,
        resource: createItem("another-dirty-folder"),
      },
    ]);

    expect(confirmed).to.equal(false);
    expect(showWarningMessageStub.calledOnce).to.equal(true);
  });
});
