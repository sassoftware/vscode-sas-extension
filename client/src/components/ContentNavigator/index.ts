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
  env,
  l10n,
  window,
  workspace,
} from "vscode";

import { profileConfig } from "../../commands/profile";
import { SubscriptionProvider } from "../SubscriptionProvider";
import { ConnectionType, ProfileWithFileRootOptions } from "../profile";
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
import { isContainer as getIsContainer } from "./utils";

const fileValidator = (value: string): string | null =>
  /^([^/<>;\\{}]+)\.\w+$/.test(
    // file service does not allow /, <, >, ;, \, {, }
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

const folderValidator = (
  value: string,
  sourceType: ContentSourceType,
): string | null => {
  const regex =
    sourceType === ContentSourceType.SASServer
      ? new RegExp(/[:/?\\*"|<>]/g)
      : new RegExp(/[/;\\{}<>]/g);

  return value.length <= 100 && !regex.test(value)
    ? null
    : Messages.FolderValidationError;
};

class ContentNavigator implements SubscriptionProvider {
  private contentDataProvider: ContentDataProvider;
  private contentModel: ContentModel;
  private sourceType: ContentNavigatorConfig["sourceType"];
  private treeIdentifier: ContentNavigatorConfig["treeIdentifier"];

  constructor(context: ExtensionContext, config: ContentNavigatorConfig) {
    this.sourceType = config.sourceType;
    this.treeIdentifier = config.treeIdentifier;
    this.contentModel = new ContentModel(
      this.contentAdapterForConnectionType(),
    );
    this.contentDataProvider = new ContentDataProvider(
      this.contentModel,
      context.extensionUri,
      config,
    );

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
              if (!resource.contextValue.includes("delete")) {
                return;
              }
              const isContainer = getIsContainer(resource);
              const hasUnsavedFiles = isContainer
                ? await this.contentDataProvider.checkFolderDirty(resource)
                : isContainer;
              const moveToRecycleBin =
                this.contentDataProvider.canRecycleResource(resource);


              if (resource.contextValue.includes("delete")) {
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
                } else if (moveToRecycleBin && hasUnsavedFiles) {
                  if (
                    !(await window.showWarningMessage(
                      l10n.t(Messages.RecycleDirtyFolderWarning, {
                        name: resource.name,
                      }),
                      { modal: true },
                      Messages.MoveToRecycleBinLabel,
                    ))
                  ) {
                    return;
                  }
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
            validateInput: (folderName) =>
              folderValidator(folderName, this.sourceType),
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
            validateInput: isContainer
              ? (value) => folderValidator(value, this.sourceType)
              : fileValidator,
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
      commands.registerCommand(
        `${SAS}.collapseAllContent`,
        this.collapseAllContent.bind(this),
      ),
      commands.registerCommand(
        `${SAS}.convertNotebookToFlow`,
        async (resource: ContentItem | Uri) => {
          await this.contentModel.connect(this.viyaEndpoint());
          const notebookToFlowConverter = new NotebookToFlowConverter(
            resource,
            this.contentModel,
            this.viyaEndpoint(),
            this.sourceType,
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
      commands.registerCommand(
        `${SAS}.copyPath`,
        async (resource: ContentItem) => {
          const path = await this.contentDataProvider.getPathOfItem(resource);
          if (path) {
            await env.clipboard.writeText(path);
          }
        },
      ),
      workspace.onDidChangeConfiguration(
        async (event: ConfigurationChangeEvent) => {
          if (event.affectsConfiguration("SAS.connectionProfiles")) {
            const endpoint = this.viyaEndpoint();
            this.collapseAllContent();
            const contentModel = new ContentModel(
              this.contentAdapterForConnectionType(),
            );
            this.contentDataProvider.useModel(contentModel);
            this.contentModel = contentModel;
            if (endpoint) {
              await this.contentDataProvider.connect(endpoint);
            } else {
              await this.contentDataProvider.refresh();
            }
          }
        },
      ),
    ];
  }

  private async collapseAllContent() {
    const collapeAllCmd = `workbench.actions.treeView.${this.treeIdentifier}.collapseAll`;
    const commandExists = (await commands.getCommands()).find(
      (c) => c === collapeAllCmd,
    );
    if (commandExists) {
      commands.executeCommand(collapeAllCmd);
    }
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
      this.contentDataProvider.treeView.selection.length > 1 || !item
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

    const profileWithFileRootOptions = getProfileWithFileRootOptions();
    return new ContentAdapterFactory().create(
      activeProfile.connectionType,
      profileWithFileRootOptions?.fileNavigationCustomRootPath,
      profileWithFileRootOptions?.fileNavigationRoot,
      this.sourceType,
    );

    function getProfileWithFileRootOptions():
      | ProfileWithFileRootOptions
      | undefined {
      switch (activeProfile.connectionType) {
        case ConnectionType.Rest:
        case ConnectionType.IOM:
        case ConnectionType.COM:
          return activeProfile;
        default:
          return undefined;
      }
    }
  }
}
export default ContentNavigator;
