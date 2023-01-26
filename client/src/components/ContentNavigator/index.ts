import ContentDataProvider from "./ContentDataProvider";
import {
  ExtensionContext,
  Uri,
  commands,
  window,
  workspace,
  TextDocument,
  TextEditor,
  TextDocumentChangeEvent,
} from "vscode";
import { profileConfig } from "../../commands/profile";
import { DataDescriptor } from "./viya/DataDescriptor";
import { ContentModel } from "./viya/ContentModel";
import { ContentItem } from "./types";

const createFileValidator =
  (errorMessage: string) =>
  (value: string): string | null =>
    /^([a-zA-Z0-9\s._-]+)\.\w+$/.test(value) ? null : errorMessage;

const createFolderValidator =
  (errorMessage: string) =>
  (value: string): string | null =>
    /^([a-zA-Z0-9\s_-]+)$/.test(value) ? null : errorMessage;

class ContentNavigator {
  private dirtyFiles: Record<string, boolean>;

  constructor(context: ExtensionContext) {
    const dataDescriptor = new DataDescriptor();
    const treeDataProvider = new ContentDataProvider(
      new ContentModel(
        profileConfig.getActiveProfileDetail()?.profile.endpoint,
        dataDescriptor
      )
    );
    const treeView = window.createTreeView("sas-content-navigator", {
      treeDataProvider,
    });
    treeView.onDidChangeVisibility(async () => {
      if (treeView.visible) {
        await treeDataProvider.setup();
      }
    });

    context.subscriptions.push(treeView);

    workspace.registerFileSystemProvider("sas", treeDataProvider);
    this.registerCommands(treeDataProvider, dataDescriptor);
    this.watchForFileChanges();
  }

  private watchForFileChanges(): void {
    this.dirtyFiles = {};
    workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
      this.dirtyFiles[e.document.uri.query] = e.document.isDirty;
    });
  }

  private registerCommands(
    treeDataProvider: ContentDataProvider,
    dataDescriptor: DataDescriptor
  ): void {
    commands.registerCommand(
      "SAS.openSASfile",
      async (document: TextDocument) => await window.showTextDocument(document)
    );

    commands.registerCommand(
      "SAS.deleteResource",
      async (resource: ContentItem) => {
        if (!(await treeDataProvider.deleteResource(resource))) {
          window.showErrorMessage("Unable to delete file");
        }
      }
    );

    commands.registerCommand("SAS.refreshResources", () =>
      treeDataProvider.refresh()
    );

    commands.registerCommand(
      "SAS.addFileResource",
      async (resource: ContentItem) => {
        const fileName = await window.showInputBox({
          prompt: "Please enter a file name",
          title: "New file",
          validateInput: createFileValidator("Invalid file name"),
        });
        if (!fileName) {
          return;
        }

        const success = await treeDataProvider.createFile(resource, fileName);
        if (!success) {
          window.showErrorMessage(`Unable to create file "${fileName}"`);
        }
      }
    );

    commands.registerCommand(
      "SAS.addFolderResource",
      async (resource: ContentItem) => {
        const folderName = await window.showInputBox({
          prompt: "Please enter a folder name",
          title: "New folder",
          validateInput: createFolderValidator("Invalid folder name"),
        });
        if (!folderName) {
          return;
        }

        const success = await treeDataProvider.createFolder(
          resource,
          folderName
        );
        if (!success) {
          window.showErrorMessage(`Unable to create folder "${folderName}"`);
        }
      }
    );

    commands.registerCommand(
      "SAS.renameResource",
      async (resource: ContentItem) => {
        const isContainer = dataDescriptor.isContainer(resource);
        const resourceUri = dataDescriptor.getUri(resource);

        // Make sure the file is saved before renaming
        if (this.dirtyFiles[resourceUri.query]) {
          window.showErrorMessage("Please save your file first");
          return;
        }

        const name = await window.showInputBox({
          prompt: "Please enter a new name",
          title: isContainer ? "Rename folder" : "Rename file",
          value: resource.name,
          validateInput: isContainer
            ? createFolderValidator("Invalid folder name")
            : createFileValidator("Invalid file name"),
        });

        if (name === resource.name) {
          return;
        }

        // This could be improved up. We don't know if the old document is actually
        // open. This forces it open then closes it, only to re-open it again after
        // it's renamed.
        await window.showTextDocument(resourceUri).then(() => {
          commands.executeCommand("workbench.action.closeActiveEditor");
        });

        const newUri = await treeDataProvider.renameResource(resource, name);
        if (!newUri) {
          window.showErrorMessage(
            `Unable to rename "${resource.name} to ${name}"`
          );
        }

        await window.showTextDocument(newUri);
      }
    );
  }
}

export default ContentNavigator;
