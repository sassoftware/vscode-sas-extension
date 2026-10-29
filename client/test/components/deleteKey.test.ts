// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  Disposable,
  FileType,
  TreeView,
  Uri,
  commands,
  l10n,
  window,
  workspace,
} from "vscode";

import { expect } from "chai";
import { readFileSync } from "fs";
import { resolve } from "path";
import * as sinon from "sinon";
import { stubInterface } from "ts-sinon";

import ContentNavigator from "../../src/components/ContentNavigator";
import ContentDataProvider from "../../src/components/ContentNavigator/ContentDataProvider";
import { ContentModel } from "../../src/components/ContentNavigator/ContentModel";
import { Messages as ContentMessages } from "../../src/components/ContentNavigator/const";
import {
  ContentItem,
  ContentSourceType,
} from "../../src/components/ContentNavigator/types";
import * as extensionContext from "../../src/components/ExtensionContext";
import LibraryNavigator from "../../src/components/LibraryNavigator";
import LibraryDataProvider from "../../src/components/LibraryNavigator/LibraryDataProvider";
import LibraryModel from "../../src/components/LibraryNavigator/LibraryModel";
import { Messages as LibraryMessages } from "../../src/components/LibraryNavigator/const";
import {
  LibraryAdapter,
  LibraryItem,
} from "../../src/components/LibraryNavigator/types";

interface Manifest {
  contributes: {
    keybindings: { key: string; command: string; when: string }[];
    menus: {
      "view/item/context": { command: string; when: string }[];
    };
  };
}

const manifest: Manifest = JSON.parse(
  readFileSync(resolve(__dirname, "../../../../package.json"), "utf8"),
);

const deleteBinding = (view: string) => {
  const bindings = manifest.contributes.keybindings.filter(
    ({ key, when }) => key === "delete" && when === `focusedView == ${view}`,
  );
  expect(bindings).to.have.lengthOf(1);
  const binding = bindings[0];
  expect(
    manifest.contributes.menus["view/item/context"].some(
      ({ command, when }) =>
        command === binding.command && when.includes(`view == ${view}`),
    ),
  ).to.equal(true);
  return binding;
};

const contentItem = (
  name: string,
  type: FileType = FileType.File,
  isInRecycleBin = false,
): ContentItem => ({
  creationTimeStamp: 0,
  modifiedTimeStamp: 0,
  id: name,
  uid: name,
  name,
  uri: `/files/${name}`,
  vscUri: Uri.from({ scheme: "sasContent", path: `/${name}` }),
  links: [],
  permission: { write: true, delete: true, addMember: true },
  contextValue: "delete",
  fileStat: { type, ctime: 0, mtime: 0, size: 0 },
  flags: { isInRecycleBin },
});

describe("Navigator Delete key routing", () => {
  let registerCommand: sinon.SinonStub;
  let subscriptions: Disposable[];

  beforeEach(() => {
    subscriptions = [];
    registerCommand = sinon
      .stub(commands, "registerCommand")
      .callsFake(() => new Disposable(() => {}));
  });

  afterEach(() => {
    subscriptions.forEach((subscription) => subscription.dispose());
    sinon.restore();
  });

  const commandHandler = (command: string) => {
    const registration = registerCommand
      .getCalls()
      .find(({ args }) => args[0] === command);
    expect(registration, `${command} is registered`).not.to.equal(undefined);
    return registration.args[1];
  };

  const setupContent = (selection: ContentItem[]) => {
    sinon.stub(workspace, "fs").value({
      ...workspace.fs,
      delete: sinon.stub().resolves(),
    });
    const provider = sinon.createStubInstance(ContentDataProvider);
    const tree = stubInterface<TreeView<ContentItem>>();
    Object.defineProperty(tree, "selection", { value: selection });
    sinon.stub(provider, "treeView").get(() => tree);
    provider.getSubscriptions.returns([]);
    provider.canRecycleResource.callsFake(
      (item) => !item.flags?.isInRecycleBin,
    );
    provider.checkFolderDirty.resolves(false);
    provider.recycleResource.resolves(true);
    provider.deleteResource.resolves(true);
    const model = sinon.createStubInstance(ContentModel);
    const navigator: ContentNavigator = Object.create(
      ContentNavigator.prototype,
    );
    Object.defineProperties(navigator, {
      contentDataProvider: { value: provider },
      contentModel: { value: model },
      sourceType: { value: ContentSourceType.SASContent },
      temporaryImageUris: { value: new Map<string, Uri>() },
    });
    subscriptions = navigator.getSubscriptions();
    return { provider, model };
  };

  const setupLibrary = (selection: LibraryItem[]) => {
    const adapter = stubInterface<LibraryAdapter>();
    adapter.deleteTable.resolves();
    const provider = new LibraryDataProvider(
      new LibraryModel(adapter),
      Uri.file(__dirname),
    );
    const tree = stubInterface<TreeView<LibraryItem>>();
    Object.defineProperty(tree, "selection", { value: selection });
    sinon.stub(provider, "treeView").get(() => tree);
    const navigator: LibraryNavigator = Object.create(
      LibraryNavigator.prototype,
    );
    Object.defineProperty(navigator, "libraryDataProvider", {
      value: provider,
    });
    subscriptions = navigator.getSubscriptions();
    return adapter;
  };

  const table: LibraryItem = {
    id: "WORK.TEST",
    uid: "WORK.TEST",
    name: "TEST",
    library: "WORK",
    type: "table",
    readOnly: false,
  };

  const readOnlyTable: LibraryItem = {
    ...table,
    id: "WORK.READONLY",
    uid: "WORK.READONLY",
    name: "READONLY",
    readOnly: true,
  };

  const library: LibraryItem = {
    id: "WORK",
    uid: "WORK",
    name: "WORK",
    type: "library",
    readOnly: false,
  };

  for (const invocation of ["keyboard", "context menu"]) {
    for (const item of [
      readOnlyTable,
      library,
      { ...library, readOnly: true },
    ]) {
      it(`ignores ${item.readOnly ? "read-only" : "actionable"} ${item.type} via ${invocation}`, async () => {
        const adapter = setupLibrary([item]);
        const warning = sinon.stub(window, "showWarningMessage");
        const handler = commandHandler(
          deleteBinding("librarydataprovider").command,
        );

        await handler(invocation === "keyboard" ? undefined : item);

        expect(warning.called).to.equal(false);
        expect(adapter.deleteTable.called).to.equal(false);
      });
    }

    it(`deletes only actionable tables in a mixed selection via ${invocation}`, async () => {
      const secondTable: LibraryItem = {
        ...table,
        id: "WORK.SECOND",
        uid: "WORK.SECOND",
        name: "SECOND",
      };
      const adapter = setupLibrary([
        readOnlyTable,
        table,
        library,
        secondTable,
      ]);
      const warning: sinon.SinonStub = sinon.stub(window, "showWarningMessage");
      warning.resolves("Delete");
      const handler = commandHandler(
        deleteBinding("librarydataprovider").command,
      );

      await handler(invocation === "keyboard" ? undefined : table);

      expect(
        adapter.deleteTable.getCalls().map(({ args }) => args[0]),
      ).to.deep.equal([table, secondTable]);
      expect(
        warning.calledOnceWithExactly(
          l10n.t(LibraryMessages.TablesDeletionWarning),
          { modal: true },
          "Delete",
        ),
      ).to.equal(true);
    });

    it(`deletes an actionable table via ${invocation}`, async () => {
      const adapter = setupLibrary([table]);
      const warning: sinon.SinonStub = sinon.stub(window, "showWarningMessage");
      warning.resolves("Delete");
      const handler = commandHandler(
        deleteBinding("librarydataprovider").command,
      );

      await handler(invocation === "keyboard" ? undefined : table);

      expect(adapter.deleteTable.calledOnceWithExactly(table)).to.equal(true);
      expect(warning.calledOnce).to.equal(true);
    });
  }

  it("does not confirm or delete a selection containing only protected Library items", async () => {
    const adapter = setupLibrary([readOnlyTable, library]);
    const warning = sinon.stub(window, "showWarningMessage");

    await commandHandler(deleteBinding("librarydataprovider").command)();

    expect(warning.called).to.equal(false);
    expect(adapter.deleteTable.called).to.equal(false);
  });

  it("routes Library Delete to the existing confirmation and table deletion using selection", async () => {
    const binding = deleteBinding("librarydataprovider");
    expect(binding.command).to.equal("SAS.deleteTable");
    const adapter = setupLibrary([table]);
    const warning: sinon.SinonStub = sinon.stub(window, "showWarningMessage");
    warning.resolves("Delete");

    await commandHandler(binding.command)();

    expect(
      warning.calledOnceWithExactly(
        l10n.t(LibraryMessages.TablesDeletionWarning),
        { modal: true },
        "Delete",
      ),
    ).to.equal(true);
    expect(adapter.deleteTable.calledOnceWithExactly(table)).to.equal(true);
  });

  it("does not delete a Library table when confirmation is cancelled", async () => {
    const adapter = setupLibrary([table]);
    sinon.stub(window, "showWarningMessage").resolves(undefined);

    await commandHandler(deleteBinding("librarydataprovider").command)();

    expect(adapter.deleteTable.called).to.equal(false);
  });

  it("does nothing for an empty Library selection", async () => {
    const adapter = setupLibrary([]);
    const warning = sinon.stub(window, "showWarningMessage");

    await commandHandler(deleteBinding("librarydataprovider").command)();

    expect(warning.called).to.equal(false);
    expect(adapter.deleteTable.called).to.equal(false);
  });

  it("routes Content Delete to the existing recycle workflow without an explicit item", async () => {
    const binding = deleteBinding("contentdataprovider");
    expect(binding.command).to.equal("SAS.content.deleteResource");
    const item = contentItem("program.sas");
    const { provider } = setupContent([item]);
    const warning = sinon.stub(window, "showWarningMessage");

    await commandHandler(binding.command)();

    expect(provider.recycleResource.calledOnceWithExactly(item)).to.equal(true);
    expect(provider.deleteResource.called).to.equal(false);
    expect(warning.called).to.equal(false);
  });

  for (const type of [FileType.File, FileType.Directory]) {
    it(`uses the same permanent-delete flow for Recycle Bin ${FileType[type]} via keyboard and context menu`, async () => {
      const item = contentItem("recycled", type, true);
      const { provider } = setupContent([item]);
      const warning: sinon.SinonStub = sinon.stub(window, "showWarningMessage");
      warning.resolves("Delete");
      const handler = commandHandler(
        deleteBinding("contentdataprovider").command,
      );

      await handler();
      await handler(item);

      expect(provider.deleteResource.callCount).to.equal(2);
      expect(provider.deleteResource.alwaysCalledWithExactly(item)).to.equal(
        true,
      );
      expect(provider.recycleResource.called).to.equal(false);
      expect(provider.checkFolderDirty.called).to.equal(false);
      expect(warning.callCount).to.equal(2);
      expect(
        warning.alwaysCalledWithExactly(
          l10n.t(ContentMessages.DeleteWarningMessage, { name: item.name }),
          { modal: true },
          ContentMessages.DeleteButtonLabel,
        ),
      ).to.equal(true);
    });
  }

  it("preserves Recycle Bin multi-selection and capability filtering", async () => {
    const file = contentItem("recycled.sas", FileType.File, true);
    const folder = contentItem("recycled-folder", FileType.Directory, true);
    const child = contentItem("child.sas", FileType.File, true);
    child.parentFolderUri = folder.uri;
    const protectedItem = contentItem("protected");
    protectedItem.contextValue = "restore";
    const { provider } = setupContent([file, folder, child, protectedItem]);
    const warning: sinon.SinonStub = sinon.stub(window, "showWarningMessage");
    warning.resolves("Delete");

    await commandHandler(deleteBinding("contentdataprovider").command)();

    expect(
      provider.deleteResource.getCalls().map(({ args }) => args[0]),
    ).to.deep.equal([file, folder]);
    expect(provider.recycleResource.called).to.equal(false);
    expect(
      warning.calledOnceWithExactly(
        l10n.t(ContentMessages.DeleteDirtyItemsWarningMessage, { count: 2 }),
        { modal: true },
        ContentMessages.DeleteButtonLabel,
      ),
    ).to.equal(true);
  });

  it("does not permanently delete when the existing confirmation is cancelled", async () => {
    const { provider } = setupContent([
      contentItem("recycled.sas", FileType.File, true),
    ]);
    sinon.stub(window, "showWarningMessage").resolves(undefined);

    await commandHandler(deleteBinding("contentdataprovider").command)();

    expect(provider.deleteResource.called).to.equal(false);
    expect(provider.recycleResource.called).to.equal(false);
  });

  it("does nothing when no Content selection has delete capability", async () => {
    const item = contentItem("protected");
    item.contextValue = "restore";
    const { provider } = setupContent([item]);
    const warning = sinon.stub(window, "showWarningMessage");

    await commandHandler(deleteBinding("contentdataprovider").command)();

    expect(provider.canRecycleResource.called).to.equal(false);
    expect(provider.deleteResource.called).to.equal(false);
    expect(provider.recycleResource.called).to.equal(false);
    expect(warning.called).to.equal(false);
  });

  for (const recycled of [false, true]) {
    it(`preserves tree focus when opening a ${recycled ? "Recycle Bin" : "Content"} file`, async () => {
      const item = contentItem("program.sas", FileType.File, recycled);
      const { model } = setupContent([item]);
      model.getUri.resolves(item.vscUri);
      const execute = sinon.stub(commands, "executeCommand").resolves();

      await commandHandler("SAS.content.openResource")(item);

      expect(
        execute.calledOnceWithExactly("vscode.open", item.vscUri, {
          preserveFocus: true,
        }),
      ).to.equal(true);
    });
  }

  it("preserves tree focus when opening an image preview", async () => {
    const item = contentItem("image.png");
    const { model } = setupContent([item]);
    model.getContentByUri.resolves(new Uint8Array([1, 2, 3]));
    sinon
      .stub(extensionContext, "getGlobalStorageUri")
      .returns(Uri.file(__dirname));
    sinon
      .stub(Uri, "joinPath")
      .returns(Uri.file(resolve(__dirname, "image-preview.png")));
    sinon.stub(workspace.fs, "readDirectory").resolves([]);
    sinon.stub(workspace.fs, "writeFile").resolves();
    const execute = sinon.stub(commands, "executeCommand").resolves();

    await commandHandler("SAS.content.openResource")(item);

    expect(execute.calledOnce).to.equal(true);
    expect(execute.firstCall.args[0]).to.equal("vscode.openWith");
    expect(execute.firstCall.args[2]).to.equal("imagePreview.previewEditor");
    expect(execute.firstCall.args[3]).to.deep.equal({
      preserveFocus: true,
    });
  });
});
