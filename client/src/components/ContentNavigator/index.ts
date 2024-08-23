// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  ConfigurationChangeEvent,
  Disposable,
  Event,
  ExtensionContext,
  OpenDialogOptions,
  ProgressLocation,
  Uri,
  commands,
  l10n,
  window,
  workspace,
} from "vscode";

import { profileConfig } from "../../commands/profile";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { ConnectionType } from "../profile";
import ContentAdapterFactory from "./ContentAdapterFactory";
import ContentDataProvider from "./ContentDataProvider";
import { ContentModel } from "./ContentModel";
import { Messages } from "./const";
import { NotebookToFlowConverter } from "./convert";
import {
  ContentAdapter,
  ContentItem,
  ContentNavigatorConfig,
  ContentSourceType,
  FileManipulationEvent,
} from "./types";
import { isContainer as getIsContainer, isItemInRecycleBin } from "./utils";

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
  private contentModel: ContentModel;
  private sourceType: ContentNavigatorConfig["sourceType"];

  constructor(context: ExtensionContext, config: ContentNavigatorConfig) {
    this.contentModel = new ContentModel(
      this.contentAdapterForConnectionType(),
    );
    this.contentDataProvider = new ContentDataProvider(
      this.contentModel,
      context.extensionUri,
      config,
    );
    this.sourceType = config.sourceType;

    workspace.registerFileSystemProvider(
      config.sourceType,
      this.contentDataProvider,
    );
    workspace.registerTextDocumentContentProvider(
      `${config.sourceType}ReadOnly`,
      this.contentDataProvider,
    );
  }

  get onDidManipulateFile(): Event<FileManipulationEvent> {
    return this.contentDataProvider.onDidManipulateFile;
  }

  public getSubscriptions(): Disposable[] {
    const SAS = `SAS.${this.sourceType === ContentSourceType.SASContent ? "content" : "server"}`;
    return [
      ...this.contentDataProvider.getSubscriptions(),
      commands.registerCommand(
        `${SAS}.deleteResource`,
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
        `${SAS}.restoreResource`,
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
      commands.registerCommand(`${SAS}.emptyRecycleBin`, async () => {
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
      commands.registerCommand(`${SAS}.refreshContent`, () =>
        this.contentDataProvider.refresh(),
      ),
      commands.registerCommand(
        `${SAS}.addFileResource`,
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
        `${SAS}.addFolderResource`,
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
        `${SAS}.renameResource`,
        async (resource: ContentItem) => {
          const isContainer = getIsContainer(resource);

          const name = await window.showInputBox({
            prompt: Messages.RenamePrompt,
            title: isContainer
              ? Messages.RenameFolderTitle
              : Messages.RenameFileTitle,
            value: resource.name,
            validateInput: isContainer ? folderValidator : fileValidator,
          });
          if (!name || name === resource.name) {
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

          this.contentDataProvider.refresh();
        },
      ),
      commands.registerCommand(
        `${SAS}.addToFavorites`,
        async (item: ContentItem) => {
          this.treeViewSelections(item).forEach(
            async (resource: ContentItem) => {
              if (
                !(await this.contentDataProvider.addToMyFavorites(resource))
              ) {
                window.showErrorMessage(Messages.AddToFavoritesError);
              }
            },
          );
        },
      ),
      commands.registerCommand(
        `${SAS}.removeFromFavorites`,
        async (item: ContentItem) => {
          this.treeViewSelections(item).forEach(
            async (resource: ContentItem) => {
              if (
                !(await this.contentDataProvider.removeFromMyFavorites(
                  resource,
                ))
              ) {
                window.showErrorMessage(Messages.RemoveFromFavoritesError);
              }
            },
          );
        },
      ),
      commands.registerCommand(`${SAS}.collapseAllContent`, () => {
        commands.executeCommand(
          "workbench.actions.treeView.contentdataprovider.collapseAll",
        );
      }),
      commands.registerCommand(
        `${SAS}.convertNotebookToFlow`,
        async (resource: ContentItem | Uri) => {
          const notebookToFlowConverter = new NotebookToFlowConverter(
            resource,
            this.contentModel,
            this.viyaEndpoint(),
          );

          const inputName = notebookToFlowConverter.inputName;
          // Open window to chose the name and location of the new .flw file
          const outputName = await window.showInputBox({
            prompt: Messages.ConvertNotebookToFlowPrompt,
            value: inputName.replace(".sasnb", ".flw"),
            validateInput: flowFileValidator,
          });

          if (!outputName) {
            // User canceled the input box
            return;
          }

          await window.withProgress(
            {
              location: ProgressLocation.Notification,
              title: l10n.t("Converting SAS notebook to flow..."),
            },
            async () => {
              if (!(await notebookToFlowConverter.establishConnection())) {
                window.showErrorMessage(Messages.StudioConnectionError);
                return;
              }

              let parentItem;
              try {
                const response =
                  await notebookToFlowConverter.convert(outputName);
                parentItem = response.parentItem;
                if (!response.folderName) {
                  throw new Error(Messages.NotebookToFlowConversionError);
                }

                window.showInformationMessage(
                  l10n.t(Messages.NotebookToFlowConversionSuccess, {
                    folderName: response.folderName,
                  }),
                );

                this.contentDataProvider.refresh();
              } catch (e) {
                window.showErrorMessage(e.message);
                this.contentDataProvider.reveal(parentItem);
              }
            },
          );
        },
      ),
      commands.registerCommand(
        `${SAS}.downloadResource`,
        async (resource: ContentItem) => {
          const selections = this.treeViewSelections(resource);
          const uris = await window.showOpenDialog({
            title: l10n.t("Choose where to save your files."),
            openLabel: l10n.t("Save"),
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
          });
          const uri = uris && uris.length > 0 ? uris[0] : undefined;

          if (!uri) {
            return;
          }

          await window.withProgress(
            {
              location: ProgressLocation.Notification,
              title: l10n.t("Downloading files..."),
            },
            async () => {
              await this.contentDataProvider.downloadContentItems(
                uri,
                selections,
                this.contentDataProvider.treeView.selection,
              );
            },
          );
        },
      ),
      // Below, we have three commands to upload files. Mac is currently the only
      // platform that supports uploading both files and folders. So, for any platform
      // that isn't Mac, we list a distinct upload file(s) or upload folder(s) command.
      // See the `OpenDialogOptions` interface for more information.
      commands.registerCommand(
        `${SAS}.uploadResource`,
        async (resource: ContentItem) => this.uploadResource(resource),
      ),
      commands.registerCommand(
        `${SAS}.uploadFileResource`,
        async (resource: ContentItem) =>
          this.uploadResource(resource, { canSelectFolders: false }),
      ),
      commands.registerCommand(
        `${SAS}.uploadFolderResource`,
        async (resource: ContentItem) =>
          this.uploadResource(resource, { canSelectFiles: false }),
      ),
      workspace.onDidChangeConfiguration(
        async (event: ConfigurationChangeEvent) => {
          if (event.affectsConfiguration("SAS.connectionProfiles")) {
            const endpoint = this.viyaEndpoint();
            if (endpoint) {
              await this.contentDataProvider.connect(endpoint);
            }
          }
        },
      ),
    ];
  }

  private async uploadResource(
    resource: ContentItem,
    openDialogOptions: Partial<OpenDialogOptions> = {},
  ) {
    const uris: Uri[] = await window.showOpenDialog({
      canSelectFolders: true,
      canSelectMany: true,
      canSelectFiles: true,
      ...openDialogOptions,
    });
    if (!uris) {
      return;
    }

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t("Uploading files..."),
      },
      async () => {
        await this.contentDataProvider.uploadUrisToTarget(uris, resource);
      },
    );
  }

  private viyaEndpoint(): string {
    const activeProfile = profileConfig.getProfileByName(
      profileConfig.getActiveProfile(),
    );
    return activeProfile &&
      activeProfile.connectionType === ConnectionType.Rest &&
      !activeProfile.serverId
      ? activeProfile.endpoint
      : "";
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

  private contentAdapterForConnectionType(): ContentAdapter | undefined {
    const activeProfile = profileConfig.getProfileByName(
      profileConfig.getActiveProfile(),
    );

    if (!activeProfile) {
      return;
    }

    return new ContentAdapterFactory().create(
      activeProfile.connectionType,
      this.sourceType,
    );
  }
}

export default ContentNavigator;
