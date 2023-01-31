// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import ContentDataProvider from "./ContentDataProvider";
import {
  ExtensionContext,
  commands,
  window,
  workspace,
  TextDocument,
  TextDocumentChangeEvent,
  TreeView,
  Uri,
} from "vscode";
import { profileConfig } from "../../commands/profile";
import { DataDescriptor } from "./viya/DataDescriptor";
import { ContentModel } from "./viya/ContentModel";
import { ContentItem } from "./types";
import { Messages } from "./viya/const";
import { sprintf } from "sprintf-js";

const fileValidator = (value: string): string | null =>
  /^([a-zA-Z0-9\s._-]+)\.\w+$/.test(value)
    ? null
    : Messages.FileValidationError;
const foldervalidator = (value: string): string | null =>
  /^([a-zA-Z0-9\s_-]+)$/.test(value) ? null : Messages.FolderValidationError;

class ContentNavigator {
  private dataDescriptor: DataDescriptor;
  private contentDataProvider: ContentDataProvider;
  private treeView: TreeView<ContentItem>;

  private dirtyFiles: Record<string, boolean>;

  constructor(context: ExtensionContext) {
    this.dataDescriptor = new DataDescriptor();
    this.contentDataProvider = new ContentDataProvider(
      new ContentModel(this.dataDescriptor)
    );
    this.treeView = window.createTreeView("sas-content-navigator", {
      treeDataProvider: this.contentDataProvider,
    });
    this.treeView.onDidChangeVisibility(async () => {
      if (this.treeView.visible) {
        await this.contentDataProvider.connect(
          profileConfig.getActiveProfileDetail()?.profile.endpoint
        );
      }
    });

    context.subscriptions.push(this.treeView);

    workspace.registerFileSystemProvider("sas", this.contentDataProvider);
    this.registerCommands();
    this.watchForFileChanges();
  }

  private watchForFileChanges(): void {
    this.dirtyFiles = {};
    workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
      this.dirtyFiles[e.document.uri.query] = e.document.isDirty;
    });
  }

  private registerCommands(): void {
    commands.registerCommand(
      "SAS.openSASfile",
      async (document: TextDocument) => {
        try {
          await window.showTextDocument(document);
        } catch (error) {
          await window.showErrorMessage(Messages.FileOpenError);
        }
      }
    );

    commands.registerCommand(
      "SAS.deleteResource",
      async (resource: ContentItem) => {
        if (!(await this.contentDataProvider.deleteResource(resource))) {
          window.showErrorMessage(Messages.FileDeletionError);
        }
      }
    );

    commands.registerCommand("SAS.refreshResources", () =>
      this.contentDataProvider.refresh()
    );

    commands.registerCommand(
      "SAS.addFileResource",
      async (resource: ContentItem) => {
        const fileName = await window.showInputBox({
          prompt: Messages.NewFilePrompt,
          title: Messages.NewFileTitle,
          validateInput: fileValidator,
        });
        if (!fileName) {
          return;
        }

        const newUri = await this.contentDataProvider.createFile(
          resource,
          fileName
        );
        this.handleCreationResponse(
          resource,
          newUri,
          sprintf(Messages.NewFileCreationError, { name: fileName })
        );

        if (newUri) {
          await window.showTextDocument(newUri);
        }
      }
    );

    commands.registerCommand(
      "SAS.addFolderResource",
      async (resource: ContentItem) => {
        const folderName = await window.showInputBox({
          prompt: Messages.NewFolderPrompt,
          title: Messages.NewFolderTitle,
          validateInput: foldervalidator,
        });
        if (!folderName) {
          return;
        }

        const newUri = await this.contentDataProvider.createFolder(
          resource,
          folderName
        );
        this.handleCreationResponse(
          resource,
          newUri,
          sprintf(Messages.NewFolderCreationError, { name: folderName })
        );
      }
    );

    commands.registerCommand(
      "SAS.renameResource",
      async (resource: ContentItem) => {
        const isContainer = this.dataDescriptor.isContainer(resource);
        const resourceUri = this.dataDescriptor.getUri(resource);

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
          validateInput: isContainer ? foldervalidator : fileValidator,
        });

        if (name === resource.name) {
          return;
        }

        // This could be improved upon. We don't know if the old document is actually
        // open. This forces it open then closes it, only to re-open it again after
        // it's renamed.
        !isContainer &&
          (await window.showTextDocument(resourceUri).then(async () => {
            await commands.executeCommand("workbench.action.closeActiveEditor");
          }));

        const newUri = await this.contentDataProvider.renameResource(
          resource,
          name
        );

        if (!newUri) {
          window.showErrorMessage(
            sprintf(Messages.RenameError, {
              oldName: resource.name,
              newName: name,
            })
          );
          return;
        }

        !isContainer && (await window.showTextDocument(newUri));

        this.contentDataProvider.refresh();
      }
    );

    commands.registerCommand("SAS.collapseAll", () => {
      commands.executeCommand(
        "workbench.actions.treeView.sas-content-navigator.collapseAll"
      );
    });
  }

  private async handleCreationResponse(
    resource: ContentItem,
    newUri: Uri | undefined,
    errorMessage: string
  ): Promise<void> {
    if (!newUri) {
      window.showErrorMessage(errorMessage);
      return;
    }

    this.treeView.reveal(resource, {
      expand: true,
      select: false,
      focus: false,
    });
  }
}

export default ContentNavigator;
