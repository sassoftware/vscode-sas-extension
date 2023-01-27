import ContentDataProvider from "./ContentDataProvider";
import {
  ExtensionContext,
  commands,
  window,
  workspace,
  TextDocument,
  TextDocumentChangeEvent,
  TreeView,
} from "vscode";
import { profileConfig } from "../../commands/profile";
import { DataDescriptor } from "./viya/DataDescriptor";
import { ContentModel } from "./viya/ContentModel";
import { ContentItem } from "./types";
import { Messages } from "./viya/const";
import { sprintf } from "sprintf-js";

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
    this.registerCommands(treeDataProvider, dataDescriptor, treeView);
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
    dataDescriptor: DataDescriptor,
    treeView: TreeView<ContentItem>
  ): void {
    commands.registerCommand(
      "SAS.openSASfile",
      async (document: TextDocument) => await window.showTextDocument(document)
    );

    commands.registerCommand(
      "SAS.deleteResource",
      async (resource: ContentItem) => {
        if (!(await treeDataProvider.deleteResource(resource))) {
          window.showErrorMessage(Messages.FileDeletionError);
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
          prompt: Messages.NewFilePrompt,
          title: Messages.NewFileTitle,
          validateInput: createFileValidator(Messages.FileValidationError),
        });
        if (!fileName) {
          return;
        }

        const newUri = await treeDataProvider.createFile(resource, fileName);
        if (!newUri) {
          window.showErrorMessage(
            sprintf(Messages.NewFileCreationError, { name: fileName })
          );
          return;
        }
        await treeView.reveal(resource, {
          expand: true,
          select: false,
          focus: false,
        });

        await window.showTextDocument(newUri);
      }
    );

    commands.registerCommand(
      "SAS.addFolderResource",
      async (resource: ContentItem) => {
        const folderName = await window.showInputBox({
          prompt: Messages.NewFolderPrompt,
          title: Messages.NewFolderTitle,
          validateInput: createFolderValidator(Messages.FolderValidationError),
        });
        if (!folderName) {
          return;
        }

        const newUri = await treeDataProvider.createFolder(
          resource,
          folderName
        );
        if (!newUri) {
          sprintf(Messages.NewFolderCreationError, { name: folderName });
          return;
        }
        await treeView.reveal(resource, {
          expand: true,
          select: false,
          focus: false,
        });
      }
    );

    commands.registerCommand(
      "SAS.renameResource",
      async (resource: ContentItem) => {
        const isContainer = dataDescriptor.isContainer(resource);
        const resourceUri = dataDescriptor.getUri(resource);

        // Make sure the file is saved before renaming
        if (this.dirtyFiles[resourceUri.query]) {
          window.showErrorMessage(Messages.RenameUnsavedFileError);
          return;
        }

        const name = await window.showInputBox({
          prompt: Messages.RenamePrompt,
          title: isContainer
            ? Messages.RenameFolderTitle
            : Messages.RenameFileTitle,
          value: resource.name,
          validateInput: isContainer
            ? createFolderValidator(Messages.FolderValidationError)
            : createFileValidator(Messages.FileValidationError),
        });

        if (name === resource.name) {
          return;
        }

        // This could be improved upon. We don't know if the old document is actually
        // open. This forces it open then closes it, only to re-open it again after
        // it's renamed.
        await window.showTextDocument(resourceUri).then(() => {
          commands.executeCommand("workbench.action.closeActiveEditor");
        });

        const newUri = await treeDataProvider.renameResource(resource, name);
        if (!newUri) {
          window.showErrorMessage(
            sprintf(Messages.RenameError, {
              oldName: resource.name,
              newName: name,
            })
          );
        }

        await window.showTextDocument(newUri);
      }
    );
  }
}

export default ContentNavigator;
