// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  commands,
  ConfigurationChangeEvent,
  Disposable,
  ExtensionContext,
  l10n,
  TextDocumentChangeEvent,
  window,
  workspace,
} from "vscode";

import { profileConfig } from "../../commands/profile";
import { ConnectionType } from "../profile";
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
    value,
  )
    ? null
    : Messages.FileValidationError;

const flowFileValidator = (value: string): string | null => {
  let res = fileValidator(value);
  if (!value.endsWith(".flw")) {
    res = Messages.InvalidFlowFileNameError;
  }
  return res;
};

const folderValidator = (value: string): string | null =>
  value.length <= 100 ? null : Messages.FolderValidationError;

class ContentNavigator implements SubscriptionProvider {
  private contentDataProvider: ContentDataProvider;

  private dirtyFiles: Record<string, boolean>;

  constructor(context: ExtensionContext) {
    this.contentDataProvider = new ContentDataProvider(
      new ContentModel(),
      context.extensionUri,
    );

    workspace.registerFileSystemProvider("sas", this.contentDataProvider);
    workspace.registerTextDocumentContentProvider(
      "sasReadOnly",
      this.contentDataProvider,
    );
    this.watchForFileChanges();
  }

  public getSubscriptions(): Disposable[] {
    return [
      ...this.contentDataProvider.getSubscriptions(),
      commands.registerCommand(
        "SAS.deleteResource",
        async (item: ContentItem) => {
          this.treeViewSelections(item).forEach(
            async (resource: ContentItem) => {
              const isContainer = getIsContainer(resource);
              const moveToRecycleBin =
                !isItemInRecycleBin(resource) && resource.permission.write;
              if (
                !moveToRecycleBin &&
                !(await window.showWarningMessage(
                  l10n.t(Messages.DeleteWarningMessage, {
                    name: resource.name,
                  }),
                  { modal: true },
                  Messages.DeleteButtonLabel,
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
                    : Messages.FileDeletionError,
                );
              }
            },
          );
        },
      ),
      commands.registerCommand(
        "SAS.restoreResource",
        async (item: ContentItem) => {
          this.treeViewSelections(item).forEach(
            async (resource: ContentItem) => {
              const isContainer = getIsContainer(resource);
              if (!(await this.contentDataProvider.restoreResource(resource))) {
                window.showErrorMessage(
                  isContainer
                    ? Messages.FolderRestoreError
                    : Messages.FileRestoreError,
                );
              }
            },
          );
        },
      ),
      commands.registerCommand("SAS.emptyRecycleBin", async () => {
        if (
          !(await window.showWarningMessage(
            Messages.EmptyRecycleBinWarningMessage,
            { modal: true },
            Messages.DeleteButtonLabel,
          ))
        ) {
          return;
        }
        if (!(await this.contentDataProvider.emptyRecycleBin())) {
          window.showErrorMessage(Messages.EmptyRecycleBinError);
        }
      }),
      commands.registerCommand("SAS.refreshContent", () =>
        this.contentDataProvider.refresh(),
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
            fileName,
          );
          this.contentDataProvider.handleCreationResponse(
            resource,
            newUri,
            l10n.t(Messages.NewFileCreationError, { name: fileName }),
          );

          if (newUri) {
            await commands.executeCommand("vscode.open", newUri);
          }
        },
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
            folderName,
          );
          this.contentDataProvider.handleCreationResponse(
            resource,
            newUri,
            l10n.t(Messages.NewFolderCreationError, { name: folderName }),
          );
        },
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
            name,
          );

          if (!newUri) {
            window.showErrorMessage(
              l10n.t(Messages.RenameError, {
                oldName: resource.name,
                newName: name,
              }),
            );
            return;
          }

          try {
            !isContainer && (await window.showTextDocument(newUri));
          } catch (error) {
            // If we fail to show the file, there's nothing extra to do
          }

          this.contentDataProvider.refresh();
        },
      ),
      commands.registerCommand(
        "SAS.addToFavorites",
        async (resource: ContentItem) => {
          if (!(await this.contentDataProvider.addToMyFavorites(resource))) {
            window.showErrorMessage(Messages.AddToFavoritesError);
          }
        },
      ),
      commands.registerCommand(
        "SAS.removeFromFavorites",
        async (resource: ContentItem) => {
          if (
            !(await this.contentDataProvider.removeFromMyFavorites(resource))
          ) {
            window.showErrorMessage(Messages.RemoveFromFavoritesError);
          }
        },
      ),
      commands.registerCommand("SAS.collapseAllContent", () => {
        commands.executeCommand(
          "workbench.actions.treeView.contentdataprovider.collapseAll",
        );
      }),
      commands.registerCommand(
        "SAS.convertNotebookToFlow",
        async (resource: ContentItem) => {
          // Open window to chose the name and location of the new .flw file
          const name = await window.showInputBox({
            prompt: Messages.ConvertNotebookToFlowPrompt,
            value: resource.name
              .replace(".sasnb", ".flw")
              .replace(".ipynb", ".flw"),
            validateInput: flowFileValidator,
          });

          if (!name) {
            // User canceled the input box
            return;
          }

          if (
            (await this.contentDataProvider.testStudioConnection()) === false
          ) {
            window.showErrorMessage(Messages.StudioConnectionError);
            return;
          }

          if (
            await this.contentDataProvider.convertNotebookToFlow(resource, name)
          ) {
            window.showInformationMessage(
              Messages.NotebookToFlowConversionSuccess,
            );
          } else {
            window.showErrorMessage(Messages.NotebookToFlowConversionError);
          }
        },
      ),
      workspace.onDidChangeConfiguration(
        async (event: ConfigurationChangeEvent) => {
          if (event.affectsConfiguration("SAS.connectionProfiles")) {
            const activeProfile = profileConfig.getProfileByName(
              profileConfig.getActiveProfile(),
            );
            if (activeProfile) {
              if (
                activeProfile.connectionType === ConnectionType.Rest &&
                !activeProfile.serverId
              ) {
                await this.contentDataProvider.connect(activeProfile.endpoint);
              }
            }
          }
        },
      ),
    ];
  }

  private watchForFileChanges(): void {
    this.dirtyFiles = {};
    workspace.onDidChangeTextDocument((e: TextDocumentChangeEvent) => {
      this.dirtyFiles[e.document.uri.query] = e.document.isDirty;
    });
  }

  private treeViewSelections(item: ContentItem): ContentItem[] {
    const items =
      this.contentDataProvider.treeView.selection.length > 1
        ? this.contentDataProvider.treeView.selection
        : [item];
    const uris: string[] = items.map(({ uri }: ContentItem) => uri);

    // If we have a selection that is a child of something we've already selected,
    // lets filter it out (i.e. we don't need to include it twice)
    return items.filter(
      ({ parentFolderUri }: ContentItem) => !uris.includes(parentFolderUri),
    );
  }
}

export default ContentNavigator;
