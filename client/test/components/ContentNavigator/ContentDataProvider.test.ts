import axios from "axios";
import { expect } from "chai";
import * as sinon from "sinon";
import { FileStat, FileType, ThemeIcon, TreeItem, Uri } from "vscode";
import { ROOT_FOLDER } from "../../../src/components/ContentNavigator/const";
import ContentDataProvider from "../../../src/components/ContentNavigator/ContentDataProvider";
import { ContentModel } from "../../../src/components/ContentNavigator/ContentModel";
import { ContentItem } from "../../../src/components/ContentNavigator/types";
import { getUri } from "../../../src/components/ContentNavigator/utils";

let stub;

const processRequest =
  (requestMap: Record<string, any>) =>
  async (request: string, payload?: any) => {
    return new Promise((resolve, reject) => {
      if (!requestMap[request]) {
        return reject(new Error());
      }

      if (!requestMap[request].responseData) {
        return resolve({
          data: requestMap[request],
          headers: { etag: "1234", "last-modified": "5678" },
        });
      }

      const { responseData, requestData } = requestMap[request];

      if (payload && requestData) {
        expect(payload).to.deep.equal(requestData);
      }

      return resolve({
        data: responseData,
        headers: { etag: "1234", "last-modified": "5678" },
      });
    });
  };

const mockRequests = (requestMap: Record<string, any>) => {
  if (stub) {
    stub.restore();
  }

  stub = sinon.stub(axios, "create").returns({
    get: processRequest(requestMap),
    post: processRequest(requestMap),
    patch: processRequest(requestMap),
    put: processRequest(requestMap),
    delete: processRequest(requestMap),
    defaults: {
      headers: {
        common: {
          Authorization: "",
        },
      },
    },
  });
};

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
  ...contentItem,
});

describe("ContentDataProvider", async function () {
  afterEach(() => {
    if (stub) {
      stub.restore();
    }
  });

  it("getTreeItem - returns a file tree item for file reference", async () => {
    const contentItem: ContentItem = mockContentItem();
    const dataProvider = new ContentDataProvider(new ContentModel());

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
    const dataProvider = new ContentDataProvider(new ContentModel());

    const treeItem = await dataProvider.getTreeItem(contentItem);
    const expectedTreeItem: TreeItem = {
      iconPath: ThemeIcon.Folder,
      id: "uri://selffolder",
      label: "testFolder",
    };

    expect(treeItem).to.deep.include(expectedTreeItem);
  });

  it("getChildren - returns no children if not authorized", async () => {
    const dataProvider = new ContentDataProvider(new ContentModel());
    const children = await dataProvider.getChildren();
    expect(children.length).to.equal(0);
  });

  it("getChildren - returns root children without content item", async function () {
    const dataProvider = new ContentDataProvider(new ContentModel());
    mockRequests({
      "/folders/folders/@myFavorites": mockContentItem({
        name: "@myFavorites",
        type: "folder",
      }),
      "/folders/folders/@myFolder": mockContentItem({
        name: "@myFolder",
        type: "folder",
      }),
      "/folders/folders/@sasRoot": mockContentItem({
        name: "@sasRoot",
        type: "folder",
      }),
    });

    dataProvider.connect("http://test.io");

    const children = await dataProvider.getChildren();
    expect(children.length).to.equal(3);
    expect(children[0].name).to.equal("@myFavorites");
    expect(children[1].name).to.equal("@myFolder");
    expect(children[2]).to.equal(ROOT_FOLDER);
  });

  it("getChildren - returns children with content item", async function () {
    const childItem = mockContentItem();
    const dataProvider = new ContentDataProvider(new ContentModel());
    mockRequests({
      "uri://myFolders?limit=1000000&filter=in(contentType,'file','RootFolder','folder','myFolder','favoritesFolder','userFolder','userRoot')":
        {
          items: [childItem],
        },
    });

    dataProvider.connect("http://test.io");

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
    const dataProvider = new ContentDataProvider(new ContentModel());
    mockRequests({
      "uri://test": childItem,
    });

    dataProvider.connect("http://test.io");
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
    const dataProvider = new ContentDataProvider(new ContentModel());
    mockRequests({
      "uri://test": childItem,
    });

    dataProvider.connect("http://test.io");
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
    const dataProvider = new ContentDataProvider(new ContentModel());
    mockRequests({
      "uri://test/content": "/* file content */",
    });

    dataProvider.connect("http://test.io");
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
    const dataProvider = new ContentDataProvider(new ContentModel());
    mockRequests({
      "/folders/folders?parentFolderUri=uri://parent-folder": {
        responseData: createdFolder,
        requestData: { name: "folder-test" },
      },
    });

    dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.createFolder(parentItem, "folder-test");
    expect(uri).to.deep.equal(getUri(createdFolder));
  });

  it("createFolder - fails to create a folder without parent folder", async function () {
    const parentItem = mockContentItem({ type: "folder", uri: "" });
    const dataProvider = new ContentDataProvider(new ContentModel());

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

    const dataProvider = new ContentDataProvider(new ContentModel());
    mockRequests({
      "/files/files#rawUpload?typeDefName=programFile": {
        responseData: createdFile,
        requestData: Buffer.from("", "binary"),
      },
      "uri://addMember": {
        responseData: {},
        requestData: {
          uri: "uri://self",
          type: "CHILD",
          name: "file.sas",
          contentType: "programFile",
        },
      },
    });

    dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.createFile(parentItem, "file.sas");
    expect(uri).to.deep.equal(getUri(createdFile));
  });

  it("renameResource - renames resource and returns uri", async function () {
    const item = mockContentItem({
      type: "file",
      name: "file.sas",
      uri: "uri://rename",
    });

    const dataProvider = new ContentDataProvider(new ContentModel());
    mockRequests({
      "uri://rename": {
        responseData: item,
        requestData: { name: "new-file.sas" },
      },
    });

    dataProvider.connect("http://test.io");
    const uri: Uri = await dataProvider.renameResource(item, "new-file.sas");
    expect(uri).to.deep.equal(getUri(item));
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

    const dataProvider = new ContentDataProvider(new ContentModel());
    mockRequests({
      "uri://self": {
        responseData: item,
        requestData: { name: "favorite-link.sas" },
      },
      "uri://rename": {
        responseData: referencedFile,
      },
    });

    dataProvider.connect("http://test.io");
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

    const dataProvider = new ContentDataProvider(new ContentModel());

    // Make initial request and store file token data
    mockRequests({
      "uri://test/content": "/* file content */",
    });
    dataProvider.connect("http://test.io");
    await dataProvider.readFile(getUri(item));

    mockRequests({
      "uri://test/content": {
        responseData: item,
        requestData: "/* This is the content */",
      },
    });
    dataProvider.connect("http://test.io");
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

    const dataProvider = new ContentDataProvider(new ContentModel());

    mockRequests({
      "uri://delete": {
        responseData: {},
      },
      "uri://delete-resource": {
        responseData: {},
      },
    });

    dataProvider.connect("http://test.io");
    const deleted = await dataProvider.deleteResource(item);

    expect(deleted).to.equal(true);
  });
});
