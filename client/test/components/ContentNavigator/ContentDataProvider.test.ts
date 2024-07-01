import {
  DataTransfer,
  DataTransferItem,
  FileStat,
  FileType,
  ThemeIcon,
  TreeItem,
  Uri,
  authentication,
} from "vscode";

import axios, { AxiosInstance, HeadersDefaults } from "axios";
import { expect } from "chai";
import * as sinon from "sinon";
import { StubbedInstance, stubInterface } from "ts-sinon";

import ContentDataProvider from "../../../src/components/ContentNavigator/ContentDataProvider";
import { ContentModel } from "../../../src/components/ContentNavigator/ContentModel";
import {
  FAVORITES_FOLDER_TYPE,
  ROOT_FOLDER,
  TRASH_FOLDER_TYPE,
} from "../../../src/components/ContentNavigator/const";
import { ContentItem } from "../../../src/components/ContentNavigator/types";
import {
  getLink,
  getUri,
} from "../../../src/components/ContentNavigator/utils";
import { getUri as getTestUri } from "../../utils";

let stub;
let axiosInstance: StubbedInstance<AxiosInstance>;

const mockContentItem = (
  contentItem: Partial<ContentItem> = {},
): ContentItem => ({
  id: "abc123",
  type: "file",
  creationTimeStamp: 1234,
  links: [
    {
      rel: "self",
      uri: "uri://self",
      method: "GET",
      href: "uri://self",
      type: "test",
    },
  ],
  modifiedTimeStamp: 1234,
  name: "testFile",
  uri: "uri://test",
  permission: {
    write: false,
    addMember: false,
    delete: false,
  },
  flags: {
    isInRecycleBin: false,
    isInMyFavorites: false,
  },
  uid: "unique-id",
  ...contentItem,
});

const createDataProvider = () => {
  const model = new ContentModel();
  const mockGetDelegateFolder = sinon.stub(model, "getDelegateFolder");
  mockGetDelegateFolder.withArgs("@myRecycleBin").returns(
    mockContentItem({
      type: "trashFolder",
      name: "Recycle Bin",
      links: [
        {
          rel: "self",
          uri: "uri://self",
          method: "GET",
          href: "uri://self",
          type: "test",
        },
      ],
      uri: "uri://recyleBin",
    }),
  );
  mockGetDelegateFolder.withArgs("@myFavorites").returns(
    mockContentItem({
      type: "favoritesFolder",
      name: "My Favorites",
      links: [
        {
          rel: "addMember",
          uri: "uri://addMember",
          method: "POST",
          href: "uri://addMember",
          type: "test",
        },
      ],
      uri: "uri://myFavorites",
    }),
  );
  return new ContentDataProvider(model, Uri.from({ scheme: "http" }));
};

describe("ContentDataProvider", async function () {
  let authStub;
  beforeEach(() => {
    authStub = sinon.stub(authentication, "getSession").resolves({
      accessToken: "12345",
      account: { id: "id", label: "label" },
      id: "id",
      scopes: [],
    });

    axiosInstance = stubInterface<AxiosInstance>();
    axiosInstance.interceptors.response = {
      use: () => null,
      eject: () => null,
      clear: () => null,
    };
    const defaultHeader: HeadersDefaults = {
      common: {
        Authorization: "",
      },
      put: {},
      post: {},
      patch: {},
      delete: {},
      head: {},
      get: {},
    };
    axiosInstance.defaults = {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      headers: defaultHeader as AxiosInstance["defaults"]["headers"],
    };

    stub = sinon.stub(axios, "create").returns(axiosInstance);
  });

  afterEach(() => {
    if (stub) {
      stub.restore();
    }
    authStub.restore();
    axiosInstance = undefined;
  });

  it("getTreeItem - returns a file tree item for file reference", async () => {
    const contentItem: ContentItem = mockContentItem();
    const dataProvider = createDataProvider();

    const treeItem = await dataProvider.getTreeItem(contentItem);
    // TODO FIX ME!
    const uri = await dataProvider.getUri(contentItem, false);
    const expectedTreeItem: TreeItem = {
      iconPath: ThemeIcon.File,
      id: "unique-id",
      label: "testFile",
      command: {
        command: "vscode.open",
        arguments: [uri],
        title: "Open SAS File",
      },
    };

    expect(treeItem).to.deep.include(expectedTreeItem);
  });

  it("getTreeItem - returns a folder tree item for file reference", async () => {
    const contentItem: ContentItem = mockContentItem({
      type: "folder",
      name: "testFolder",
    });
    const dataProvider = createDataProvider();

    const treeItem = await dataProvider.getTreeItem(contentItem);
    const expectedTreeItem: TreeItem = {
      id: "unique-id",
      label: "testFolder",
    };

    expect(treeItem).to.deep.include(expectedTreeItem);
  });

  it("getChildren - returns no children if not authorized", async () => {
    const dataProvider = createDataProvider();
    const children = await dataProvider.getChildren();
    expect(children.length).to.equal(0);
  });

  it("getChildren - returns root children without content item", async function () {
    const dataProvider = createDataProvider();

    axiosInstance.get.withArgs("/folders/folders/@myFavorites").resolves({
      data: mockContentItem({
        name: "@myFavorites",
        type: "folder",
      }),
    });

    axiosInstance.get.withArgs("/folders/folders/@myFolder").resolves({
      data: mockContentItem({
        name: "@myFolder",
        type: "folder",
      }),
    });

    axiosInstance.get.withArgs("/folders/folders/@myRecycleBin").resolves({
      data: mockContentItem({
        name: "@myRecycleBin",
        type: "folder",
      }),
    });

    await dataProvider.connect("http://test.io");

    const children = await dataProvider.getChildren();
    expect(children.length).to.equal(4);
    expect(children[0].name).to.equal("@myFavorites");
    expect(children[1].name).to.equal("@myFolder");
    expect(children[2].name).to.equal(ROOT_FOLDER.name);
    expect(children[3].name).to.equal("@myRecycleBin");
  });

  it("getChildren - returns children with content item", async function () {
    const childItem = mockContentItem({
      flags: {
        isInMyFavorites: true,
        isInRecycleBin: false,
      },
      uid: "my-favorite/0",
    });
    const dataProvider = createDataProvider();

    axiosInstance.get.withArgs("/deploymentData/cadenceVersion").resolves({
      data: { cadenceVersion: "2023.07" },
    });

    axiosInstance.get
      .withArgs(
        "uri://myFavorites?limit=1000000&filter=in(contentType,'file','dataFlow','RootFolder','folder','myFolder','favoritesFolder','userFolder','userRoot','trashFolder')&sortBy=eq(contentType,'folder'):descending,name:primary:ascending,type:ascending",
      )
      .resolves({
        data: {
          items: [childItem],
        },
      });

    await dataProvider.connect("http://test.io");

    const children = await dataProvider.getChildren(
      mockContentItem({
        name: "@myFavorites",
        type: "folder",
        links: [
          {
            rel: "members",
            uri: "uri://myFavorites",
            method: "GET",
            href: "uri://@myFavorites",
            type: "test",
          },
        ],
        uri: "uri://myFavorites",
        uid: "my-favorite",
      }),
    );

    expect(children.length).to.equal(1);
    expect(children[0]).to.deep.include(childItem);
  });

  it("stat - returns file data", async function () {
    const childItem = mockContentItem();
    const dataProvider = createDataProvider();

    axiosInstance.get.withArgs("uri://test").resolves({
      data: childItem,
      headers: { etag: "1234", "last-modified": "5678" },
    });

    await dataProvider.connect("http://test.io");
    const fileData: FileStat = await dataProvider.stat(getUri(childItem));

    expect(fileData).to.deep.include({
      type: FileType.File,
      ctime: 1234,
      mtime: 1234,
      size: 0,
    });
  });

  it("stat - returns folder data", async function () {
    const childItem = mockContentItem({ type: "folder" });
    const dataProvider = createDataProvider();

    axiosInstance.get.withArgs("uri://test").resolves({
      data: childItem,
      headers: { etag: "1234", "last-modified": "5678" },
    });

    await dataProvider.connect("http://test.io");
    const folderData: FileStat = await dataProvider.stat(getUri(childItem));

    expect(folderData).to.deep.include({
      type: FileType.Directory,
      ctime: 1234,
      mtime: 1234,
      size: 0,
    });
  });

  it("readFile - returns file contents", async function () {
    const childItem = mockContentItem();
    const dataProvider = createDataProvider();

    axiosInstance.get.withArgs("uri://test/content").resolves({
      data: "/* file content */",
      headers: { etag: "1234", "last-modified": "5678" },
    });

    await dataProvider.connect("http://test.io");
    const fileData: Uint8Array = await dataProvider.readFile(getUri(childItem));

    expect(new TextDecoder().decode(fileData)).to.equal("/* file content */");
  });

  it("createFolder - creates a folder", async function () {
    const parentItem = mockContentItem({
      type: "folder",
      uri: "uri://parent-folder",
    });
    const createdFolder = mockContentItem({
      type: "folder",
      name: "folder-test",
    });
    const dataProvider = createDataProvider();

    axiosInstance.post
      .withArgs("/folders/folders?parentFolderUri=uri://parent-folder", {
        name: "folder-test",
      })
      .resolves({
        data: createdFolder,
      });

    await dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.createFolder(parentItem, "folder-test");
    expect(uri).to.deep.equal(getUri(createdFolder));
  });

  it("createFolder - fails to create a folder without parent folder", async function () {
    const parentItem = mockContentItem({ type: "folder", uri: "" });
    const dataProvider = createDataProvider();

    const item = await dataProvider.createFolder(parentItem, "folder-test");

    expect(item).to.equal(undefined);
  });

  it("createFile - creates a file and adds it to a folder", async function () {
    const parentItem = mockContentItem({
      type: "folder",
      uri: "uri://parent-folder",
      links: [
        {
          rel: "addMember",
          uri: "uri://addMember",
          method: "POST",
          href: "uri://addMember",
          type: "test",
        },
      ],
    });
    const createdFile = mockContentItem({
      type: "file",
      name: "file.sas",
    });

    const dataProvider = createDataProvider();

    axiosInstance.post
      .withArgs(
        "/files/files#rawUpload?typeDefName=programFile",
        Buffer.from("", "binary"),
      )
      .resolves({
        data: createdFile,
      });

    axiosInstance.post
      .withArgs("uri://addMember", {
        uri: "uri://self",
        type: "CHILD",
        name: "file.sas",
        contentType: "programFile",
      })
      .resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.createFile(parentItem, "file.sas");
    expect(uri).to.deep.equal(getUri(createdFile));
  });

  it("renameResource - fail if the new name is conflicted", async function () {
    const origItem = mockContentItem({
      type: "file",
      name: "file.sas",
      uri: "uri://rename",
      links: [
        {
          method: "PUT",
          rel: "validateRename",
          uri: "uri://validate?value={newname}&type={newtype}",
          href: "uri://validate?value={newname}&type={newtype}",
          type: "test",
        },
      ],
    });

    axiosInstance.get.withArgs("uri://rename").resolves({
      data: origItem,
      headers: { etag: "1234", "last-modified": "5678" },
    });
    axiosInstance.put
      .withArgs("uri://validate?value=new-file.sas&type=file")
      .rejects({
        data: {
          status: 409,
        },
      });

    const dataProvider = createDataProvider();

    await dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.renameResource(
      origItem,
      "new-file.sas",
    );
    expect(uri).to.equal(undefined);
  });

  it("renameResource - renames resource and returns uri", async function () {
    const origItem = mockContentItem({
      type: "file",
      name: "file.sas",
      uri: "uri://rename",
    });

    const newItem = mockContentItem({
      type: "file",
      name: "new-file.sas",
      uri: "uri://rename",
    });

    axiosInstance.get.withArgs("uri://rename").resolves({
      data: origItem,
      headers: { etag: "1234", "last-modified": "5678" },
    });
    axiosInstance.put
      .withArgs("uri://rename", { ...origItem, name: "new-file.sas" })
      .resolves({
        data: { ...origItem, name: "new-file.sas" },
        headers: { etag: "1234", "last-modified": "5678" },
      });

    const dataProvider = createDataProvider();

    await dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.renameResource(
      origItem,
      "new-file.sas",
    );
    expect(uri).to.deep.equal(getUri(newItem));
  });

  it("renameResource - renames reference resource and returns uri of referenced item", async function () {
    const item = mockContentItem({
      type: "reference",
      name: "favorite-link.sas",
      uri: "uri://rename",
    });

    const referencedFile = mockContentItem({
      type: "file",
      name: "the-real-file.sas",
    });

    const dataProvider = createDataProvider();

    axiosInstance.get.withArgs("uri://self").resolves({
      data: item,
      headers: { etag: "1234", "last-modified": "5678" },
    });
    axiosInstance.put
      .withArgs("uri://self", { ...item, name: "favorite-link.sas" })
      .resolves({
        data: { ...item, name: "favorite-link.sas" },
        headers: { etag: "1234", "last-modified": "5678" },
      });
    axiosInstance.get.withArgs("uri://rename").resolves({
      data: referencedFile,
      headers: { etag: "1234", "last-modified": "5678" },
    });

    await dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.renameResource(
      item,
      "favorite-link.sas",
    );

    expect(uri).to.deep.equal(getUri(referencedFile));
  });

  it("writeFile - saves text based content to file", async function () {
    const item = mockContentItem({
      type: "file",
      name: "file.sas",
    });

    const dataProvider = createDataProvider();

    // Make initial request and store file token data
    axiosInstance.get.withArgs("uri://test/content").resolves({
      data: "/* file content */",
      headers: { etag: "1234", "last-modified": "5678" },
    });

    await dataProvider.connect("http://test.io");

    axiosInstance.put
      .withArgs("uri://test/content", "/* This is the content */")
      .resolves({
        data: item,
        headers: { etag: "1234", "last-modified": "5678" },
      });

    await dataProvider.connect("http://test.io");
    await dataProvider.writeFile(
      getUri(item),
      new TextEncoder().encode("/* This is the content */"),
    );
  });

  it("delete - deletes item and underlying resource", async function () {
    const item = mockContentItem({
      type: "file",
      name: "file.sas",
      links: [
        {
          rel: "delete",
          uri: "uri://delete",
          method: "DELETE",
          href: "uri://delete",
          type: "test",
        },
        {
          rel: "deleteResource",
          uri: "uri://delete-resource",
          method: "DELETE",
          href: "uri://delete-resource",
          type: "test",
        },
      ],
    });

    const dataProvider = createDataProvider();

    axiosInstance.delete.withArgs("uri://delete").resolves({ data: {} });
    axiosInstance.delete
      .withArgs("uri://delete-resource")
      .resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const deleted = await dataProvider.deleteResource(item);

    expect(deleted).to.equal(true);
  });

  it("recycleResource - move item to the recycle bin", async function () {
    const item = mockContentItem({
      type: "file",
      name: "file.sas",
      links: [
        {
          rel: "update",
          uri: "uri://update",
          method: "PUT",
          href: "uri://update",
          type: "test",
        },
      ],
    });
    const dataProvider = createDataProvider();

    axiosInstance.put.withArgs("uri://update").resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const recycled = await dataProvider.recycleResource(item);

    expect(recycled).to.equal(true);
  });

  it("restoreResource - restore item to the previous parent folder", async function () {
    const item = mockContentItem({
      type: "file",
      name: "file.sas",
      links: [
        {
          rel: "update",
          uri: "uri://update",
          method: "PUT",
          href: "uri://update",
          type: "test",
        },
        {
          rel: "previousParent",
          uri: "uri://previous.parent",
          method: "GET",
          href: "previousParent",
          type: "test",
        },
      ],
    });

    const dataProvider = createDataProvider();

    axiosInstance.put.withArgs("uri://update").resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const deleted = await dataProvider.restoreResource(item);

    expect(deleted).to.equal(true);
  });

  it("add to favorites - Add the reference of an item to My Favorites folder", async function () {
    const item = mockContentItem({
      type: "file",
      name: "file.sas",
      links: [
        {
          rel: "getResource",
          uri: "uri://resource",
          method: "GET",
          href: "uri://resource",
          type: "test",
        },
      ],
    });

    const dataProvider = createDataProvider();

    axiosInstance.post.withArgs("uri://addMember").resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const success = await dataProvider.addToMyFavorites(item);

    expect(success).to.equal(true);
  });

  it("remove from favorites - Remove the reference of an item from My Favorites folder", async function () {
    const item = mockContentItem({
      type: "reference",
      name: "file.sas",
      links: [
        {
          rel: "delete",
          uri: "uri://delete",
          method: "DELETE",
          href: "uri://delete",
          type: "test",
        },
      ],
      flags: {
        isInMyFavorites: true,
      },
    });
    const dataProvider = createDataProvider();

    axiosInstance.delete.withArgs("uri://delete").resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const success = await dataProvider.removeFromMyFavorites(item);

    expect(success).to.equal(true);
  });

  it("remove from favorites - Remove the reference of an item from the resource", async function () {
    const item = mockContentItem({
      type: "file",
      name: "file.sas",
      flags: {},
    });
    const dataProvider = createDataProvider();

    axiosInstance.delete
      .withArgs("uri://myFavorites/members/favorite-id")
      .resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const success = await dataProvider.removeFromMyFavorites(item);

    expect(success).to.equal(true);
  });

  it("handleDrop - allows dropping files", async function () {
    const parentItem = mockContentItem({
      type: "folder",
      name: "parent",
    });

    const uri = getTestUri("SampleCode.sas").toString();
    const item = mockContentItem();

    const model = new ContentModel();
    const stub: sinon.SinonStub = sinon.stub(model, "createFile");

    const dataProvider = new ContentDataProvider(
      model,
      Uri.from({ scheme: "http" }),
    );

    const dataTransfer = new DataTransfer();
    const dataTransferItem = new DataTransferItem(uri);
    dataTransfer.set("text/uri-list", dataTransferItem);

    stub.returns(new Promise((resolve) => resolve(item)));

    await dataProvider.handleDrop(parentItem, dataTransfer);

    expect(stub.calledOnceWith(parentItem, "SampleCode.sas")).to.be.true;
  });

  it("handleDrop - allows dropping folder", async function () {
    const parentItem = mockContentItem({
      type: "folder",
      name: "parent",
    });
    const newParentItem = mockContentItem({
      type: "folder",
      name: "new-parent",
    });

    const uriObject = getTestUri("TestFolder");
    const uri = uriObject.toString();
    const item = mockContentItem();

    const model = new ContentModel();
    const createFileStub: sinon.SinonStub = sinon.stub(model, "createFile");
    const createFolderStub: sinon.SinonStub = sinon.stub(model, "createFolder");

    const dataProvider = new ContentDataProvider(
      model,
      Uri.from({ scheme: "http" }),
    );

    const dataTransfer = new DataTransfer();
    const dataTransferItem = new DataTransferItem(uri);
    dataTransfer.set("text/uri-list", dataTransferItem);

    createFileStub.returns(new Promise((resolve) => resolve(item)));
    createFolderStub.returns(new Promise((resolve) => resolve(newParentItem)));

    await dataProvider.handleDrop(parentItem, dataTransfer);

    expect(createFolderStub.calledWith(parentItem, "TestFolder")).to.be.true;
    expect(createFileStub.calledWith(newParentItem, "SampleCode1.sas")).to.be
      .true;
    expect(createFolderStub.calledWith(newParentItem, "TestSubFolder")).to.be
      .true;
    expect(createFileStub.calledWith(newParentItem, "SampleCode2.sas")).to.be
      .true;
  });

  it("handleDrop - allows dropping content items", async function () {
    const parentItem = mockContentItem({
      type: "folder",
      name: "parent",
    });
    const item = mockContentItem();

    const model = new ContentModel();
    const stub: sinon.SinonStub = sinon.stub(model, "moveTo");
    stub.returns(new Promise((resolve) => resolve(true)));

    const dataProvider = new ContentDataProvider(
      model,
      Uri.from({ scheme: "http" }),
    );

    const dataTransfer = new DataTransfer();
    const dataTransferItem = new DataTransferItem([item]);
    dataTransfer.set(
      "application/vnd.code.tree.contentdataprovider",
      dataTransferItem,
    );

    await dataProvider.handleDrop(parentItem, dataTransfer);

    expect(stub.calledWith(item, parentItem.uri)).to.be.true;
  });

  it("handleDrop - allows dropping content items to favorites", async function () {
    const parentItem = mockContentItem({
      type: FAVORITES_FOLDER_TYPE,
      name: "favorites",
      links: [
        {
          rel: "addMember",
          uri: "uri://addfav",
          method: "POST",
          href: "uri://addfav",
          type: "test",
        },
      ],
    });
    const item = mockContentItem({
      uri: "uri://favitem",
      links: [
        {
          rel: "getResource",
          uri: "uri://favitem",
          method: "GET",
          href: "uri://favitem",
          type: "test",
        },
      ],
    });

    const model = new ContentModel();
    const stub: sinon.SinonStub = sinon.stub(model, "addMember");
    stub.returns(new Promise((resolve) => resolve(true)));

    sinon.stub(model, "getDelegateFolder").returns(parentItem);

    const dataProvider = new ContentDataProvider(
      model,
      Uri.from({ scheme: "http" }),
    );

    const dataTransfer = new DataTransfer();
    const dataTransferItem = new DataTransferItem([item]);
    dataTransfer.set(
      "application/vnd.code.tree.contentdataprovider",
      dataTransferItem,
    );

    await dataProvider.handleDrop(parentItem, dataTransfer);

    expect(stub.calledWith("uri://favitem", "uri://addfav")).to.be.true;
  });

  it("handleDrop - allows dropping content items to trash", async function () {
    const parentItem = mockContentItem({
      type: TRASH_FOLDER_TYPE,
      name: "trash",
      links: [
        {
          rel: "self",
          uri: "uri://trash",
          method: "GET",
          href: "uri://trash",
          type: "test",
        },
      ],
    });
    const item = mockContentItem();

    const model = new ContentModel();
    const stub: sinon.SinonStub = sinon.stub(model, "moveTo");
    stub.returns(new Promise((resolve) => resolve(true)));

    sinon.stub(model, "getDelegateFolder").returns(parentItem);

    const dataProvider = new ContentDataProvider(
      model,
      Uri.from({ scheme: "http" }),
    );

    const dataTransfer = new DataTransfer();
    const dataTransferItem = new DataTransferItem([item]);
    dataTransfer.set(
      "application/vnd.code.tree.contentdataprovider",
      dataTransferItem,
    );

    await dataProvider.handleDrop(parentItem, dataTransfer);

    expect(stub.calledWith(item, getLink(parentItem.links, "GET", "self")?.uri))
      .to.be.true;
  });

  it("getFileFolderPath - returns empty path for folder", async function () {
    const item = mockContentItem({
      type: "folder",
      name: "folder",
    });

    const model = new ContentModel();
    const dataProvider = new ContentDataProvider(
      model,
      Uri.from({ scheme: "http" }),
    );

    await dataProvider.connect("http://test.io");
    const path = await model.getFileFolderPath(item);

    expect(path).to.equal("");
  });

  it("getFileFolderPath - traverses parentFolderUri to find path", async function () {
    const grandparent = mockContentItem({
      type: "folder",
      name: "grandparent",
      id: "/id/grandparent",
    });
    const parent = mockContentItem({
      type: "folder",
      name: "parent",
      id: "/id/parent",
      parentFolderUri: "/id/grandparent",
    });
    const item = mockContentItem({
      type: "file",
      name: "file.sas",
      parentFolderUri: "/id/parent",
    });
    const item2 = mockContentItem({
      type: "file",
      name: "file2.sas",
      parentFolderUri: "/id/parent",
    });

    const model = new ContentModel();
    const dataProvider = new ContentDataProvider(
      model,
      Uri.from({ scheme: "http" }),
    );

    axiosInstance.get.withArgs("/id/parent").resolves({
      data: parent,
    });
    axiosInstance.get.withArgs("/id/grandparent").resolves({
      data: grandparent,
    });

    await dataProvider.connect("http://test.io");

    // We expect both files to have the same folder path
    expect(await model.getFileFolderPath(item)).to.equal("/grandparent/parent");
    expect(await model.getFileFolderPath(item2)).to.equal(
      "/grandparent/parent",
    );
  });
});
