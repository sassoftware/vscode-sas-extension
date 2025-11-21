// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  CancellationToken,
  DataTransfer,
  DataTransferItem,
  Disposable,
  DocumentDropEdit,
  Event,
  EventEmitter,
  FileChangeEvent,
  FileStat,
  FileSystemProvider,
  FileType,
  Position,
  ProviderResult,
  TabInputNotebook,
  TabInputText,
  TextDocument,
  TextDocumentContentProvider,
  TreeDataProvider,
  TreeDragAndDropController,
  TreeItem,
  TreeItemCollapsibleState,
  TreeView,
  Uri,
  commands,
  l10n,
  languages,
  window,
  workspace,
} from "vscode";

import { lstat, lstatSync, readFile, readdir } from "fs";
import { basename, join } from "path";
import { promisify } from "util";

import { profileConfig } from "../../commands/profile";
import { getResourceId } from "../../connection/rest/util";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { ViyaProfile } from "../profile";
import { ContentModel } from "./ContentModel";
import {
  FAVORITES_FOLDER_TYPE,
  Messages,
  ROOT_FOLDER_TYPE,
  SERVER_HOME_FOLDER_TYPE,
  SERVER_ROOT_FOLDER_TYPE,
  STOP_SIGN,
  TRASH_FOLDER_TYPE,
} from "./const";
import {
  ContentItem,
  ContentNavigatorConfig,
  FileManipulationEvent,
} from "./types";
import {
  getEditorTabsForItem,
  getFileStatement,
  isContainer as getIsContainer,
} from "./utils";

const SAS_FILE_SEPARATOR = "~fs~";

class ContentDataProvider
  implements
    TreeDataProvider<ContentItem>,
    FileSystemProvider,
    TextDocumentContentProvider,
    SubscriptionProvider,
    TreeDragAndDropController<ContentItem>
{
  private _onDidManipulateFile: EventEmitter<FileManipulationEvent>;
  private _onDidChangeFile: EventEmitter<FileChangeEvent[]>;
  private _onDidChangeTreeData: EventEmitter<ContentItem | undefined>;
  private _onDidChange: EventEmitter<Uri>;
  private _treeView: TreeView<ContentItem>;
  private _dropEditProvider: Disposable;
  private model: ContentModel;
  private extensionUri: Uri;
  private mimeType: string;

  public dropMimeTypes: string[];
  public dragMimeTypes: string[];

  private uriToParentMap = new Map<string, string>();

  get treeView(): TreeView<ContentItem> {
    return this._treeView;
  }

  constructor(
    model: ContentModel,
    extensionUri: Uri,
    { mimeType, treeIdentifier }: ContentNavigatorConfig,
  ) {
    this._onDidManipulateFile = new EventEmitter<FileManipulationEvent>();
    this._onDidChangeFile = new EventEmitter<FileChangeEvent[]>();
    this._onDidChangeTreeData = new EventEmitter<ContentItem | undefined>();
    this._onDidChange = new EventEmitter<Uri>();
    this.model = model;
    this.extensionUri = extensionUri;
    this.dropMimeTypes = [mimeType, "text/uri-list"];
    this.dragMimeTypes = [mimeType];
    this.mimeType = mimeType;

    this._treeView = window.createTreeView(treeIdentifier, {
      treeDataProvider: this,
      dragAndDropController: this,
      canSelectMany: true,
    });
    this._dropEditProvider = languages.registerDocumentDropEditProvider(
      { language: "sas" },
      this,
    );

    this._treeView.onDidChangeVisibility(async () => {
      if (this._treeView.visible) {
        const activeProfile: ViyaProfile = profileConfig.getProfileByName(
          profileConfig.getActiveProfile(),
        );
        await this.connect(activeProfile.endpoint);
      }
    });
  }

  public useModel(contentModel: ContentModel) {
    this.model = contentModel;
  }

  public async handleDrop(
    target: ContentItem,
    sources: DataTransfer,
  ): Promise<void> {
    for (const mimeType of this.dropMimeTypes) {
      const item = sources.get(mimeType);
      if (!item || !item.value) {
        continue;
      }

      switch (mimeType) {
        case this.mimeType:
          await Promise.all(
            item.value.map(
              async (contentItem: ContentItem) =>
                await this.handleContentItemDrop(target, contentItem),
            ),
          );
          break;
        case "text/uri-list":
          await this.handleDataTransferItemDrop(target, item);
          break;
        default:
          break;
      }
    }
  }

  public handleDrag(
    source: ContentItem[],
    dataTransfer: DataTransfer,
  ): void | Thenable<void> {
    const dataTransferItem = new DataTransferItem(source);
    dataTransfer.set(this.dragMimeTypes[0], dataTransferItem);
  }

  public async provideDocumentDropEdits(
    document: TextDocument,
    position: Position,
    dataTransfer: DataTransfer,
    token: CancellationToken,
  ): Promise<DocumentDropEdit | undefined> {
    const dataTransferItem = dataTransfer.get(this.dragMimeTypes[0]);
    const contentItem =
      dataTransferItem && JSON.parse(dataTransferItem.value)[0];
    if (token.isCancellationRequested || !contentItem) {
      return undefined;
    }

    const fileFolderPath = await this.model.getFileFolderPath(contentItem);
    if (!fileFolderPath) {
      return undefined;
    }

    return {
      insertText: getFileStatement(
        contentItem.name,
        document.getText(),
        fileFolderPath,
      ),
    };
  }

  public getSubscriptions(): Disposable[] {
    return [this._treeView, this._dropEditProvider];
  }

  get onDidChangeFile(): Event<FileChangeEvent[]> {
    return this._onDidChangeFile.event;
  }

  get onDidChangeTreeData(): Event<ContentItem> {
    return this._onDidChangeTreeData.event;
  }

  get onDidChange(): Event<Uri> {
    return this._onDidChange.event;
  }

  get onDidManipulateFile(): Event<FileManipulationEvent> {
    return this._onDidManipulateFile.event;
  }

  public async connect(baseUrl: string): Promise<void> {
    await this.model.connect(baseUrl);
    this.refresh();
  }

  public async getTreeItem(item: ContentItem): Promise<TreeItem> {
    const isContainer = getIsContainer(item);
    const uri = await this.model.getUri(item, false);

    // Cache the URI to parent mapping
    this.uriToParentMap.set(
      item.uri,
      item.parentFolderUri ? item.parentFolderUri : STOP_SIGN,
    );

    return {
      collapsibleState: isContainer
        ? TreeItemCollapsibleState.Collapsed
        : undefined,
      command: isContainer
        ? undefined
        : {
            command: "vscode.open",
            arguments: [uri],
            title: "Open SAS File",
          },
      contextValue: item.contextValue || undefined,
      iconPath: this.iconPathForItem(item),
      id: item.uid,
      label: item.name,
      resourceUri: uri,
    };
  }

  public async provideTextDocumentContent(uri: Uri): Promise<string> {
    // use text document content provider to display the readonly editor for the files in the recycle bin
    return await this.model.getContentByUri(uri);
  }

  public getChildren(item?: ContentItem): ProviderResult<ContentItem[]> {
    return this.model.getChildren(item);
  }

  public watch(): Disposable {
    // ignore, fires for all changes...
    return new Disposable(() => {});
  }

  public async stat(uri: Uri): Promise<FileStat> {
    return await this.model
      .getResourceByUri(uri)
      .then((resource): FileStat => resource.fileStat);
  }

  public async readFile(uri: Uri): Promise<Uint8Array> {
    return await this.model
      .getContentByUri(uri)
      .then((content) => new TextEncoder().encode(content));
  }

  public async createFolder(
    item: ContentItem,
    folderName: string,
  ): Promise<Uri | undefined> {
    const newItem = await this.model.createFolder(item, folderName);
    if (newItem) {
      this.refresh();
      return newItem.vscUri;
    }
  }

  public async createFile(
    item: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ): Promise<Uri | undefined> {
    const newItem = await this.model.createFile(item, fileName, buffer);
    if (newItem) {
      this.refresh();
      return newItem.vscUri;
    }
  }

  public async renameResource(
    item: ContentItem,
    name: string,
  ): Promise<Uri | undefined> {
    const closing = closeFileIfOpen(item);
    const removedTabUris = await closing;
    if (!removedTabUris) {
      return;
    }

    const newItem = await this.model.renameResource(item, name);
    if (!newItem) {
      return;
    }

    const newUri = newItem.vscUri;
    const oldUriToNewUriMap = [[item.vscUri, newUri]];
    const newItemIsContainer = getIsContainer(newItem);
    if (closing !== true && !newItemIsContainer) {
      await commands.executeCommand("vscode.open", newUri);
    }
    if (closing !== true && newItemIsContainer) {
      const urisToOpen = getPreviouslyOpenedChildItems(
        await this.getChildren(newItem),
      );
      for (const [, newUri] of urisToOpen) {
        await commands.executeCommand("vscode.open", newUri);
      }
      oldUriToNewUriMap.push(...urisToOpen);
    }
    oldUriToNewUriMap.forEach(([uri, newUri]) =>
      this._onDidManipulateFile.fire({
        type: "rename",
        uri,
        newUri,
      }),
    );
    return newUri;

    function getPreviouslyOpenedChildItems(childItems: ContentItem[]) {
      const loadChildItems = closing !== true && newItemIsContainer;
      if (!Array.isArray(removedTabUris) || !loadChildItems) {
        return [];
      }
      // Here's where things get a little weird. When we rename folders in
      // sas content, we _don't_ close those files. It doesn't matter since
      // their path isn't hierarchical. In sas file system, the path is hierarchical,
      // thus we need to re-open all the closed files. This does that by getting
      // children and comparing the removedTabUris
      const filteredChildItems = childItems
        .map((childItem) => {
          const matchingUri = removedTabUris.find((uri) =>
            uri.path.endsWith(childItem.name),
          );
          if (!matchingUri) {
            return;
          }

          return [matchingUri, childItem.vscUri];
        })
        .filter((exists) => exists);

      return filteredChildItems;
    }
  }

  public writeFile(uri: Uri, content: Uint8Array): void | Promise<void> {
    return this.model.saveContentToUri(uri, new TextDecoder().decode(content));
  }

  public async deleteResource(item: ContentItem): Promise<boolean> {
    if (!(await closeFileIfOpen(item))) {
      return false;
    }
    const success = await this.model.delete(item);
    if (success) {
      this.refresh();
      this._onDidManipulateFile.fire({ type: "delete", uri: item.vscUri });
    }
    return success;
  }

  public canRecycleResource(item: ContentItem): boolean {
    return this.model.canRecycleResource(item);
  }

  public async recycleResource(item: ContentItem): Promise<boolean> {
    if (!(await closeFileIfOpen(item))) {
      return false;
    }

    const { newUri, oldUri } = await this.model.recycleResource(item);

    if (newUri) {
      this.refresh();
      // update the text document content as well just in case that this file was just restored and updated
      this._onDidChange.fire(newUri);
      this._onDidManipulateFile.fire({
        type: "recycle",
        uri: oldUri,
      });
    }

    return !!newUri;
  }

  public async restoreResource(item: ContentItem): Promise<boolean> {
    if (!(await closeFileIfOpen(item))) {
      return false;
    }
    const success = await this.model.restoreResource(item);
    if (success) {
      this.refresh();
    }

    return success;
  }

  public async emptyRecycleBin(): Promise<boolean> {
    const recycleBin = this.model.getDelegateFolder("@myRecycleBin");
    const children = await this.getChildren(recycleBin);
    const result = await Promise.all(
      children.map((child) => this.deleteResource(child)),
    );
    const success = result.length === children.length;
    if (success) {
      this.refresh();
    }
    return success;
  }

  public async addToMyFavorites(item: ContentItem): Promise<boolean> {
    const success = await this.model.addFavorite(item);
    if (success) {
      this.refresh();
    }
    return success;
  }

  public async removeFromMyFavorites(item: ContentItem): Promise<boolean> {
    const success = await this.model.removeFavorite(item);
    if (success) {
      this.refresh();
    }
    return success;
  }

  public async handleCreationResponse(
    resource: ContentItem,
    newUri: Uri | undefined,
    errorMessage: string,
  ): Promise<void> {
    if (!newUri) {
      window.showErrorMessage(errorMessage);
      return;
    }

    this.reveal(resource);
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
    this.uriToParentMap.clear();
  }

  public async getParent(
    element: ContentItem,
  ): Promise<ContentItem | undefined> {
    return await this.model.getParent(element);
  }

  public async delete(): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public rename(): void | Promise<void> {
    throw new Error("Method not implemented.");
  }

  public readDirectory():
    | [string, FileType][]
    | Thenable<[string, FileType][]> {
    throw new Error("Method not implemented.");
  }

  public createDirectory(): void | Thenable<void> {
    throw new Error("Method not implemented.");
  }

  public reveal(item: ContentItem): void {
    this._treeView.reveal(item, {
      expand: true,
      select: false,
      focus: false,
    });
  }

  public async uploadUrisToTarget(
    uris: Uri[],
    target: ContentItem,
  ): Promise<void> {
    const failedUploads = [];
    for (let i = 0; i < uris.length; ++i) {
      const uri = uris[i];
      const fileName = basename(uri.fsPath);
      if (lstatSync(uri.fsPath).isDirectory()) {
        const success = await this.handleFolderDrop(target, uri.fsPath, false);
        !success && failedUploads.push(fileName);
      } else {
        const file = await workspace.fs.readFile(uri);
        const newUri = await this.createFile(target, fileName, file);
        !newUri && failedUploads.push(fileName);
      }
    }

    if (failedUploads.length > 0) {
      this.handleCreationResponse(
        target,
        undefined,
        l10n.t(Messages.FileUploadError),
      );
    }
  }

  public async checkFolderDirty(resource: ContentItem): Promise<boolean> {
    if (!resource.vscUri) {
      return false;
    }

    const targetFolderUri = resource.uri;

    // Check for dirty text documents
    const dirtyTextFiles = workspace.textDocuments
      .filter((doc) => {
        if (!doc.isDirty) {
          return false;
        }

        const scheme = doc.uri.scheme;
        return (
          scheme === "sasContent" ||
          scheme === "sasServer" ||
          scheme === "sasContentReadOnly" ||
          scheme === "sasServerReadOnly"
        );
      })
      .map((doc) => doc.uri);

    // Check for dirty notebook documents (SASNB files)
    const dirtyNotebookFiles = workspace.notebookDocuments
      .filter((notebook) => {
        if (!notebook.isDirty) {
          return false;
        }

        const scheme = notebook.uri.scheme;
        return (
          scheme === "sasContent" ||
          scheme === "sasServer" ||
          scheme === "sasContentReadOnly" ||
          scheme === "sasServerReadOnly"
        );
      })
      .map((notebook) => notebook.uri);

    const allDirtyFiles = [...dirtyTextFiles, ...dirtyNotebookFiles];

    if (allDirtyFiles.length === 0) {
      return false;
    }

    for (const dirtyFileUri of allDirtyFiles) {
      if (
        await this.isDescendantOf(getResourceId(dirtyFileUri), targetFolderUri)
      ) {
        return true;
      }
    }

    return false;
  }

  private async isDescendantOf(
    fileUri: string,
    ancestorFolderUri: string,
  ): Promise<boolean> {
    let currentParentUri = this.uriToParentMap.get(fileUri);

    // If the cache doesn't contain the uri, it's acceptable to not pop up
    // This can happen when switching Viya profiles where the dirty file
    // is from a different server context
    if (!currentParentUri) {
      return false;
    }

    let depth = 0;
    while (currentParentUri || depth <= 10) {
      if (currentParentUri === ancestorFolderUri) {
        return true;
      }

      if (currentParentUri === STOP_SIGN) {
        return false;
      }

      const nextParentUri = this.uriToParentMap.get(currentParentUri);

      if (nextParentUri) {
        currentParentUri = nextParentUri;
      } else {
        // If the cache doesn't contain the parent uri, stop traversing
        // rather than making a server call which could be for a different server
        break;
      }
      depth++;
    }

    return false;
  }

  public async downloadContentItems(
    folderUri: Uri,
    selections: ContentItem[],
    allSelections: readonly ContentItem[],
  ): Promise<void> {
    for (let i = 0; i < selections.length; ++i) {
      const selection = selections[i];
      if (getIsContainer(selection)) {
        const newFolderUri = Uri.joinPath(folderUri, selection.name);
        const selectionsWithinFolder = await this.childrenSelections(
          selection,
          allSelections,
        );
        await workspace.fs.createDirectory(newFolderUri);
        await this.downloadContentItems(
          newFolderUri,
          selectionsWithinFolder,
          allSelections,
        );
      } else {
        await workspace.fs.writeFile(
          Uri.joinPath(folderUri, selection.name),
          await this.model.downloadFile(selection),
        );
      }
    }
  }

  public async getPathOfItem(item: ContentItem) {
    return await this.model.getPathOfItem(item);
  }

  private async childrenSelections(
    selection: ContentItem,
    allSelections: readonly ContentItem[],
  ): Promise<ContentItem[]> {
    const foundSelections = allSelections.filter(
      (foundSelection) => foundSelection.parentFolderUri === selection.uri,
    );
    if (foundSelections.length > 0) {
      return foundSelections;
    }

    // If we don't have any child selections, then the folder must have been
    // closed and therefore, we expect to select _all_ children
    return this.getChildren(selection);
  }

  private async moveItem(
    item: ContentItem,
    targetUri: string,
  ): Promise<boolean> {
    if (!targetUri) {
      return false;
    }
    const closing = closeFileIfOpen(item);
    const closedFiles = await closing;
    if (!closedFiles) {
      return false;
    }

    const newUri = await this.model.moveTo(item, targetUri);
    if (Array.isArray(closedFiles) && closedFiles.length > 0) {
      // Reopen only the files that were closed
      for (const closedFileUri of closedFiles) {
        // Calculate the new URI for each closed file
        const newFileUri = this.calculateNewFileUri(
          closedFileUri,
          item,
          newUri,
        );
        if (newFileUri) {
          await commands.executeCommand("vscode.open", newFileUri);
        }
      }
    }

    return !!newUri;
  }

  private calculateNewFileUri(
    closedFileUri: Uri,
    movedItem: ContentItem,
    newItemUri: boolean | Uri,
  ): Uri | null {
    if (typeof newItemUri === "boolean" || !newItemUri) {
      return null;
    }

    const isFolder = getIsContainer(movedItem);

    // If the moved item is a file and matches the closed file, return the new URI
    if (
      !isFolder &&
      closedFileUri.toString() === movedItem.vscUri?.toString()
    ) {
      return newItemUri;
    }

    // If the moved item is a folder, calculate the new path for files within it
    if (isFolder && movedItem.vscUri) {
      const extractPathFromUri = (uri: string): string => {
        try {
          const queryStart = uri.indexOf("?");
          if (queryStart === -1) {
            return "";
          }

          const queryString = uri.substring(queryStart + 1);

          const decodedQuery = decodeURIComponent(queryString);
          const idMatch = decodedQuery.match(/id=(.+)/);
          if (!idMatch || !idMatch[1]) {
            return "";
          }
          const uriWithoutPrefix = idMatch[1].replace(
            /\/compute\/sessions\/[a-zA-Z0-9-]*\/files\//,
            "",
          );
          try {
            return decodeURIComponent(uriWithoutPrefix);
          } catch (error) {
            console.error("Failed to decode URI component:", error);
            return uriWithoutPrefix;
          }
        } catch (error) {
          console.error("Failed to extract path from URI:", error);
          return "";
        }
      };

      const oldBasePath = extractPathFromUri(movedItem.vscUri.toString());
      const closedFilePath = extractPathFromUri(closedFileUri.toString());

      // Check if the closed file was inside the moved folder
      if (
        oldBasePath &&
        closedFilePath &&
        closedFilePath.startsWith(oldBasePath + SAS_FILE_SEPARATOR)
      ) {
        try {
          const relativePath = closedFilePath.substring(oldBasePath.length);
          const filename = relativePath.replace(/^~fs~/, "");
          const newUriStr = newItemUri.toString();
          // Extract and modify the query to append the filename path
          const queryMatch = newUriStr.match(/\?(.+)$/);
          if (!queryMatch) {
            return null;
          }

          const decodedQuery = decodeURIComponent(queryMatch[1]);
          const newQuery = decodedQuery.replace(
            /(\/files\/[^&]*)/,
            `$1~fs~${filename}`,
          );

          return Uri.parse(
            `${newItemUri.scheme}:/${filename}?${encodeURIComponent(newQuery)}`,
          );
        } catch (error) {
          console.error("Failed to construct new file URI:", error);
          return null;
        }
      }
    }

    return null;
  }

  private async handleContentItemDrop(
    target: ContentItem,
    item: ContentItem,
  ): Promise<void> {
    let success = false;
    let message = Messages.FileDropError;
    if (item.flags?.isInRecycleBin) {
      message = Messages.FileDragFromTrashError;
    } else if (item.isReference) {
      message = Messages.FileDragFromFavorites;
    } else if (target.type === TRASH_FOLDER_TYPE) {
      success = await this.recycleResource(item);
    } else if (target.type === FAVORITES_FOLDER_TYPE) {
      success = await this.addToMyFavorites(item);
    } else {
      const targetUri = target.resourceId ?? target.uri;
      success = await this.moveItem(item, targetUri);
      if (success) {
        this.refresh();
      }
    }

    if (!success) {
      window.showErrorMessage(
        l10n.t(message, {
          name: item.name,
        }),
      );
    }
  }

  private async handleFolderDrop(
    target: ContentItem,
    path: string,
    displayErrorMessages: boolean = true,
  ): Promise<boolean> {
    const folderName = basename(path);
    const folder = await this.model.createFolder(target, folderName);
    let success = true;
    if (!folder) {
      displayErrorMessages &&
        window.showErrorMessage(
          l10n.t(Messages.FileDropError, {
            name: folderName,
          }),
        );

      return false;
    }

    // Read all the files in the folder and upload them
    const filesOrFolders = await promisify(readdir)(path);
    await Promise.all(
      filesOrFolders.map(async (fileOrFolderName: string) => {
        const fileOrFolder = join(path, fileOrFolderName);
        const isDirectory = (
          await promisify(lstat)(fileOrFolder)
        ).isDirectory();
        if (isDirectory) {
          success = await this.handleFolderDrop(folder, fileOrFolder);
        } else {
          const name = basename(fileOrFolder);
          const fileCreated = await this.createFile(
            folder,
            name,
            await promisify(readFile)(fileOrFolder),
          );
          if (!fileCreated) {
            success = false;
            displayErrorMessages &&
              window.showErrorMessage(
                l10n.t(Messages.FileDropError, {
                  name,
                }),
              );
          }
        }
      }),
    );

    return success;
  }

  private async handleDataTransferItemDrop(
    target: ContentItem,
    item: DataTransferItem,
  ): Promise<void> {
    // If a user drops multiple files, there will be multiple
    // uris separated by newlines
    await Promise.all(
      item.value.split("\n").map(async (uri: string) => {
        const itemUri = Uri.parse(uri.trim());
        const name = basename(itemUri.path);
        const isDirectory = (
          await promisify(lstat)(itemUri.fsPath)
        ).isDirectory();

        if (isDirectory) {
          const success = await this.handleFolderDrop(target, itemUri.fsPath);
          if (success) {
            this.refresh();
          }

          return;
        }

        const fileCreated = await this.createFile(
          target,
          name,
          await promisify(readFile)(itemUri.fsPath),
        );

        if (!fileCreated) {
          window.showErrorMessage(
            l10n.t(Messages.FileDropError, {
              name,
            }),
          );
        }
      }),
    );
  }

  private iconPathForItem(
    item: ContentItem,
  ): undefined | { light: Uri; dark: Uri } {
    const isContainer = getIsContainer(item);
    let icon = "";
    if (isContainer) {
      const type = item.typeName;
      switch (type) {
        case ROOT_FOLDER_TYPE:
          icon = "sasFolders";
          break;
        case TRASH_FOLDER_TYPE:
          icon = "delete";
          break;
        case FAVORITES_FOLDER_TYPE:
          icon = "favoritesFolder";
          break;
        case SERVER_HOME_FOLDER_TYPE:
          icon = "userWorkspace";
          break;
        case SERVER_ROOT_FOLDER_TYPE:
          icon = "server";
          break;
        default:
          icon = "folder";
          break;
      }
    }

    return icon !== ""
      ? {
          dark: Uri.joinPath(this.extensionUri, `icons/dark/${icon}Dark.svg`),
          light: Uri.joinPath(
            this.extensionUri,
            `icons/light/${icon}Light.svg`,
          ),
        }
      : undefined;
  }
}

export default ContentDataProvider;

const closeFileIfOpen = (item: ContentItem): Promise<Uri[]> | boolean => {
  const tabs = getEditorTabsForItem(item);
  if (tabs.length > 0) {
    return new Promise((resolve, reject) => {
      Promise.all(tabs.map((tab) => window.tabGroups.close(tab)))
        .then(() =>
          resolve(
            tabs
              .map(
                (tab) =>
                  (tab.input instanceof TabInputText ||
                    tab.input instanceof TabInputNotebook) &&
                  tab.input.uri,
              )
              .filter((exists) => exists),
          ),
        )
        .catch(reject);
    });
  }
  return true;
};
