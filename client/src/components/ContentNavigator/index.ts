// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { sprintf } from "sprintf-js";
import {
  commands,
  ExtensionContext,
  TextDocumentChangeEvent,
  TreeView,
  Uri,
  window,
  workspace,
} from "vscode";
import { profileConfig } from "../../commands/profile";
import { ViyaProfile } from "../profile";
import { Messages } from "./const";
import ContentDataProvider from "./ContentDataProvider";
import { ContentModel } from "./ContentModel";
import { ContentItem } from "./types";
import { getUri, isContainer as getIsContainer } from "./utils";

const fileValidator = (value: string): string | null =>
  /^([a-zA-Z0-9\s._-]+)\.\w+$/.test(value)
    ? null
    : Messages.FileValidationError;
const folderValidator = (value: string): string | null =>
  /^([a-zA-Z0-9\s_-]+)$/.test(value) ? null : Messages.FolderValidationError;

class ContentNavigator {
  private contentDataProvider: ContentDataProvider;
  private treeView: TreeView<ContentItem>;

  private dirtyFiles: Record<string, boolean>;

  constructor(context: ExtensionContext) {
    this.contentDataProvider = new ContentDataProvider(new ContentModel());
    this.treeView = window.createTreeView("sas-content-navigator", {
      treeDataProvider: this.contentDataProvider,
    });
    this.treeView.onDidChangeVisibility(async () => {
      if (this.treeView.visible) {
        const profile = profileConfig.getActiveProfileDetail()
          ?.profile as ViyaProfile;

        await this.contentDataProvider.connect(profile.endpoint);
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
    commands.registerCommand("SAS.openSASfile", async (item: ContentItem) => {
      try {
        await window.showTextDocument(
          await this.contentDataProvider.getUri(item)
        );
      } catch (error) {
        await window.showErrorMessage(Messages.FileOpenError);
      }
    });

    commands.registerCommand(
      "SAS.deleteResource",
      async (resource: ContentItem) => {
        const isContainer = getIsContainer(resource);
        if (!(await this.contentDataProvider.deleteResource(resource))) {
          window.showErrorMessage(
            isContainer
              ? Messages.FolderDeletionError
              : Messages.FileDeletionError
          );
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
          validateInput: folderValidator,
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
        const isContainer = getIsContainer(resource);
        const resourceUri = getUri(resource);

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
          validateInput: isContainer ? folderValidator : fileValidator,
        });

        if (name === resource.name) {
          return;
        }

        // This could be improved upon. We don't know if the old document is actually
        // open. This forces it open then closes it, only to re-open it again after
        // it's renamed.
        try {
          !isContainer &&
            (await window.showTextDocument(resourceUri).then(async () => {
              await commands.executeCommand(
                "workbench.action.closeActiveEditor"
              );
            }));
        } catch (error) {
          // If we fail to show the file, there's nothing extra to do
        }

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

        try {
          !isContainer && (await window.showTextDocument(newUri));
        } catch (error) {
          // If we fail to show the file, there's nothing extra to do
        }

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
