// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { l10n } from "vscode";

import { createStaticFolder } from "./utils";

export const DEFAULT_FILE_CONTENT_TYPE = "text/plain";

const CONTENT_FOLDER_ID = "CONTENT_FOLDER_ID";
export const ROOT_FOLDER_TYPE = "RootFolder";
export const ROOT_FOLDER = createStaticFolder(
  CONTENT_FOLDER_ID,
  "SAS Content",
  ROOT_FOLDER_TYPE,
  "/folders/folders",
);

export const SERVER_FOLDER_ID = "SERVER_FOLDER_ID";
export const SERVER_ROOT_FOLDER_TYPE = "ServerRootFolder";
export const SERVER_HOME_FOLDER_TYPE = "ServerHomeFolder";
export const SAS_SERVER_ROOT_FOLDER = createStaticFolder(
  SERVER_FOLDER_ID,
  "SAS Server",
  SERVER_ROOT_FOLDER_TYPE,
  "/",
  "getDirectoryMembers",
);

export const FILE_TYPE = "file";
export const DATAFLOW_TYPE = "dataFlow";
export const FILE_TYPES = [FILE_TYPE, DATAFLOW_TYPE];
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

export const SAS_CONTENT_ROOT_FOLDERS = [
  "@myFavorites",
  "@myFolder",
  "@sasRoot",
  "@myRecycleBin",
];

export const SAS_SERVER_ROOT_FOLDERS = ["@sasServerRoot"];

export const ALL_ROOT_FOLDERS = [
  ...SAS_CONTENT_ROOT_FOLDERS,
  ...SAS_SERVER_ROOT_FOLDERS,
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
  FileDownloadError: l10n.t("Unable to download files."),
  FileDragFromFavorites: l10n.t("Unable to drag files from my favorites."),
  FileDragFromTrashError: l10n.t("Unable to drag files from trash."),
  FileDropError: l10n.t('Unable to drop item "{name}".'),
  FileNavigationRootError: l10n.t(
    'SAS Server files cannot be loaded with the specified path "fileNavigationCustomRootPath: {path}"',
  ),
  FileOpenError: l10n.t("The file type is unsupported."),
  FileRestoreError: l10n.t("Unable to restore file."),
  FileUploadError: l10n.t("Unable to upload files."),
  FileValidationError: l10n.t("Invalid file name."),
  FolderDeletionError: l10n.t("Unable to delete folder."),
  FolderRestoreError: l10n.t("Unable to restore folder."),
  FolderValidationError: l10n.t(
    "The folder name cannot contain more than 100 characters or have invalid characters.",
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
