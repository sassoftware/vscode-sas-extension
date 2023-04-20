// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { sprintf } from "sprintf-js";
import {
  commands,
  ConfigurationChangeEvent,
  Disposable,
  ExtensionContext,
  TextDocumentChangeEvent,
  TreeView,
  Uri,
  window,
  workspace,
} from "vscode";
import { profileConfig } from "../../commands/profile";
import { ViyaProfile } from "../profile";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { Messages } from "./const";
import ContentDataProvider from "./ContentDataProvider";
import { ContentModel } from "./ContentModel";
import { ContentItem } from "./types";
import {
  isContainer as getIsContainer,
  getUri,
  isItemInRecycleBin,
} from "./utils";

const fileValidator = (value: string): string | null =>
  /^([^/<>;\\{}?#]+)\.\w+$/.test(
    // file service does not allow /, <, >, ;, \, {, } while vscode does not allow ? and #
    value
  )
    ? null
    : Messages.FileValidationError;
const folderValidator = (value: string): string | null =>
  value.length <= 100 ? null : Messages.FolderValidationError;

class ContentNavigator implements SubscriptionProvider {
  private contentDataProvider: ContentDataProvider;
  private treeView: TreeView<ContentItem>;

  private dirtyFiles: Record<string, boolean>;

  constructor(context: ExtensionContext) {
    this.contentDataProvider = new ContentDataProvider(
      new ContentModel(),
      context.extensionUri
    );
    this.treeView = window.createTreeView("sas-content-navigator", {
      treeDataProvider: this.contentDataProvider,
    });
    this.treeView.onDidChangeVisibility(async () => {
      if (this.treeView.visible) {
        const activeProfile: ViyaProfile = profileConfig.getProfileByName(
          profileConfig.getActiveProfile()
        );
        await this.contentDataProvider.connect(activeProfile.endpoint);
      }
    });

    workspace.registerFileSystemProvider("sas", this.contentDataProvider);
    workspace.registerTextDocumentContentProvider(
      "sasReadOnly",
      this.contentDataProvider
    );
    this.watchForFileChanges();
  }

  private watchForFileChanges(): void {
    this.dirtyFiles = {};
    workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
      this.dirtyFiles[e.document.uri.query] = e.document.isDirty;
    });
  }

  public getSubscriptions(): Disposable[] {
    return [
      this.treeView,
      commands.registerCommand(
        "SAS.deleteResource",
        async (resource: ContentItem) => {
          const isContainer = getIsContainer(resource);
          const moveToRecycleBin =
            !isItemInRecycleBin(resource) && resource.permission.write;
          if (
            !moveToRecycleBin &&
            !(await window.showWarningMessage(
              Messages.DeleteWarningMessage.replace("{name}", resource.name),
              { modal: true },
              Messages.DeleteButtonLabel
            ))
          ) {
            return;
          }
          const deleteResult = moveToRecycleBin
            ? await this.contentDataProvider.recycleResource(resource)
            : await this.contentDataProvider.deleteResource(resource);
          if (!deleteResult) {
            window.showErrorMessage(
              isContainer
                ? Messages.FolderDeletionError
                : Messages.FileDeletionError
            );
          }
        }
      ),
      commands.registerCommand(
        "SAS.restoreResource",
        async (resource: ContentItem) => {
          const isContainer = getIsContainer(resource);
          if (!(await this.contentDataProvider.restoreResource(resource))) {
            window.showErrorMessage(
              isContainer
                ? Messages.FolderRestoreError
                : Messages.FileRestoreError
            );
          }
        }
      ),
      commands.registerCommand("SAS.emptyRecycleBin", async () => {
        if (
          !(await window.showWarningMessage(
            Messages.EmptyRecycleBinWarningMessage,
            { modal: true },
            Messages.DeleteButtonLabel
          ))
        ) {
          return;
        }
        if (!(await this.contentDataProvider.emptyRecycleBin())) {
          window.showErrorMessage(Messages.EmptyRecycleBinError);
        }
      }),
      commands.registerCommand("SAS.refreshContent", () =>
        this.contentDataProvider.refresh()
      ),
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
      ),
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
      ),
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
      ),
      commands.registerCommand("SAS.collapseAllContent", () => {
        commands.executeCommand(
          "workbench.actions.treeView.sas-content-navigator.collapseAll"
        );
      }),
      workspace.onDidChangeConfiguration(
        async (event: ConfigurationChangeEvent) => {
          if (event.affectsConfiguration("SAS.connectionProfiles")) {
            const activeProfile: ViyaProfile = profileConfig.getProfileByName(
              profileConfig.getActiveProfile()
            );
            await this.contentDataProvider.connect(activeProfile.endpoint);
          }
        }
      ),
    ];
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
