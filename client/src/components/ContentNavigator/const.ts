// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

const CONTENT_FOLDER_ID = "CONTENT_FOLDER_ID";
export const ROOT_FOLDER_TYPE = "RootFolder";

export const ROOT_FOLDER = {
  // actual root for service
  id: CONTENT_FOLDER_ID,
  name: "SAS Content",
  type: ROOT_FOLDER_TYPE,
  uri: CONTENT_FOLDER_ID,
  links: [
    {
      method: "GET",
      rel: "members",
      href: "/folders/folders",
      uri: "/folders/folders",
    },
    {
      method: "GET",
      rel: "self",
      href: CONTENT_FOLDER_ID,
      uri: CONTENT_FOLDER_ID,
    },
  ],
};

export const FILE_TYPE = "file";
export const FILE_TYPES = [FILE_TYPE, "dataFlow"];
export const FOLDER_TYPE = "folder";
export const MYFOLDER_TYPE = "myFolder";
export const TRASH_FOLDER_TYPE = "trashFolder";
export const FAVORITES_FOLDER_TYPE = "favoritesFolder";
export const FOLDER_TYPES = [
  ROOT_FOLDER_TYPE,
  FOLDER_TYPE,
  MYFOLDER_TYPE,
  FAVORITES_FOLDER_TYPE,
  "userFolder",
  "userRoot",
  TRASH_FOLDER_TYPE,
];

export const Messages = {
  AddFileToMyFolderFailure: l10n.t("Unable to add file to my folder."),
  AddFileToMyFolderSuccess: l10n.t("File added to my folder."),
  AddToFavoritesError: l10n.t("The item could not be added to My Favorites."),
  DeleteButtonLabel: l10n.t("Delete"),
  DeleteWarningMessage: l10n.t(
    'Are you sure you want to permanently delete the item "{name}"?',
  ),
  EmptyRecycleBinError: l10n.t("Unable to empty the recycle bin."),
  EmptyRecycleBinWarningMessage: l10n.t(
    "Are you sure you want to permanently delete all the items? You cannot undo this action.",
  ),
  FileDeletionError: l10n.t("Unable to delete file."),
  FileDragFromFavorites: l10n.t("Unable to drag files from my favorites."),
  FileDragFromTrashError: l10n.t("Unable to drag files from trash."),
  FileDropError: l10n.t('Unable to drop item "{name}".'),
  FileOpenError: l10n.t("The file type is unsupported."),
  FileRestoreError: l10n.t("Unable to restore file."),
  FileValidationError: l10n.t("Invalid file name."),
  FolderDeletionError: l10n.t("Unable to delete folder."),
  FolderRestoreError: l10n.t("Unable to restore folder."),
  FolderValidationError: l10n.t(
    "The folder name cannot contain more than 100 characters.",
  ),
  NewFileCreationError: l10n.t('Unable to create file "{name}".'),
  NewFilePrompt: l10n.t("Enter a file name."),
  NewFileTitle: l10n.t("New File"),
  NewFolderCreationError: l10n.t('Unable to create folder "{name}".'),
  NewFolderPrompt: l10n.t("Enter a folder name."),
  NewFolderTitle: l10n.t("New Folder"),
  RemoveFromFavoritesError: l10n.t(
    "The item could not be removed from My Favorites.",
  ),
  RenameError: l10n.t('Unable to rename "{oldName}" to "{newName}".'),
  RenameFileTitle: l10n.t("Rename File"),
  RenameFolderTitle: l10n.t("Rename Folder"),
  RenamePrompt: l10n.t("Enter a new name."),
  RenameUnsavedFileError: l10n.t(
    "You must save your file before you can rename it.",
  ),
  ConvertNotebookToFlowPrompt: l10n.t("Enter a name for the new .flw file"),
  NotebookToFlowConversionSuccess: l10n.t(
    "The notebook has been successfully converted to a flow and saved into the following folder: {folderName}. You can now open it in SAS Studio.",
  ),
  NotebookToFlowConversionError: l10n.t(
    "Error converting the notebook file to .flw format.",
  ),
  NoCodeToConvert: l10n.t(
    "The notebook file does not contain any code to convert.",
  ),
  InvalidFlowFileNameError: l10n.t(
    "The output file name must end with the .flw extension.",
  ),
  StudioConnectionError: l10n.t("Cannot connect to SAS Studio service"),
};
