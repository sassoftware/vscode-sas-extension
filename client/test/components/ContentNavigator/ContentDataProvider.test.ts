import axios, { AxiosInstance } from "axios";
import { StubbedInstance, stubInterface } from "ts-sinon";
import { expect } from "chai";
import * as sinon from "sinon";
import {
  authentication,
  FileStat,
  FileType,
  ThemeIcon,
  TreeItem,
  Uri,
} from "vscode";
import { ROOT_FOLDER } from "../../../src/components/ContentNavigator/const";
import ContentDataProvider from "../../../src/components/ContentNavigator/ContentDataProvider";
import { ContentModel } from "../../../src/components/ContentNavigator/ContentModel";
import { ContentItem } from "../../../src/components/ContentNavigator/types";
import { getUri } from "../../../src/components/ContentNavigator/utils";

let stub;
let axiosInstance: StubbedInstance<AxiosInstance>;

const mockContentItem = (
  contentItem: Partial<ContentItem> = {}
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
  __trash__: false,
  permission: {
    write: false,
    addMember: false,
    delete: false,
  },
  ...contentItem,
});

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
    };
    axiosInstance.defaults = {
      headers: {
        common: {
          Authorization: "",
        },
        put: {},
        post: {},
        patch: {},
        delete: {},
        head: {},
        get: {},
      },
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
    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

    const treeItem = await dataProvider.getTreeItem(contentItem);
    const expectedTreeItem: TreeItem = {
      iconPath: ThemeIcon.File,
      id: "uri://selffile",
      label: "testFile",
      command: {
        command: "SAS.openSASfile",
        arguments: [contentItem],
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
    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

    const treeItem = await dataProvider.getTreeItem(contentItem);
    const expectedTreeItem: TreeItem = {
      iconPath: ThemeIcon.Folder,
      id: "uri://selffolder",
      label: "testFolder",
    };

    expect(treeItem).to.deep.include(expectedTreeItem);
  });

  it("getChildren - returns no children if not authorized", async () => {
    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );
    const children = await dataProvider.getChildren();
    expect(children.length).to.equal(0);
  });

  it("getChildren - returns root children without content item", async function () {
    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

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
    const childItem = mockContentItem();
    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

    axiosInstance.get
      .withArgs(
        "uri://myFolders?limit=1000000&filter=in(contentType,'file','RootFolder','folder','myFolder','favoritesFolder','userFolder','userRoot','trashFolder')"
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
            uri: "uri://myFolders",
            method: "GET",
            href: "uri://@myFolders",
            type: "test",
          },
        ],
      })
    );

    expect(children.length).to.equal(1);
    expect(children[0]).to.deep.include(childItem);
    expect(children[0].uid).to.equal("abc123@myFavorites");
  });

  it("stat - returns file data", async function () {
    const childItem = mockContentItem();
    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

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
    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

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
    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

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
    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

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
    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

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

    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

    axiosInstance.post
      .withArgs(
        "/files/files#rawUpload?typeDefName=programFile",
        Buffer.from("", "binary")
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

    const dataProvider = new ContentDataProvider(new ContentModel());

    await dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.renameResource(
      origItem,
      "new-file.sas"
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
    axiosInstance.patch
      .withArgs("uri://rename", { name: "new-file.sas" })
      .resolves({
        data: newItem,
        headers: { etag: "1234", "last-modified": "5678" },
      });

    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

    await dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.renameResource(
      origItem,
      "new-file.sas"
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

    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

    axiosInstance.get.withArgs("uri://self").resolves({
      data: item,
      headers: { etag: "1234", "last-modified": "5678" },
    });
    axiosInstance.patch
      .withArgs("uri://self", { name: "favorite-link.sas" })
      .resolves({
        data: item,
        headers: { etag: "1234", "last-modified": "5678" },
      });
    axiosInstance.get.withArgs("uri://rename").resolves({
      data: referencedFile,
      headers: { etag: "1234", "last-modified": "5678" },
    });

    await dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.renameResource(
      item,
      "favorite-link.sas"
    );

    expect(uri).to.deep.equal(getUri(referencedFile));
  });

  it("writeFile - saves text based content to file", async function () {
    const item = mockContentItem({
      type: "file",
      name: "file.sas",
    });

    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

    // Make initial request and store file token data
    axiosInstance.get.withArgs("uri://test/content").resolves({
      data: "/* file content */",
      headers: { etag: "1234", "last-modified": "5678" },
    });

    await dataProvider.connect("http://test.io");
    await dataProvider.readFile(getUri(item));

    axiosInstance.put
      .withArgs("uri://test/content", "/* This is the content */")
      .resolves({
        data: item,
        headers: { etag: "1234", "last-modified": "5678" },
      });

    await dataProvider.connect("http://test.io");
    await dataProvider.writeFile(
      getUri(item),
      new TextEncoder().encode("/* This is the content */")
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

    const dataProvider = new ContentDataProvider(
      new ContentModel(),
      Uri.from({ scheme: "http" })
    );

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
    const model = new ContentModel();
    sinon.stub(model, "getDelegateFolder").returns(
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
      })
    );
    const dataProvider = new ContentDataProvider(model);

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

    const dataProvider = new ContentDataProvider(new ContentModel());

    axiosInstance.put.withArgs("uri://update").resolves({ data: {} });

    await dataProvider.connect("http://test.io");
    const deleted = await dataProvider.restoreResource(item);

    expect(deleted).to.equal(true);
  });
});
