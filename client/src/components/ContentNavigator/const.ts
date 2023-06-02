// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

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
export const FILE_TYPES = [FILE_TYPE];
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
  AddToFavoritesError: "The item could not be added to My Favorites.",
  DeleteButtonLabel: "Delete",
  DeleteWarningMessage:
    'Are you sure you want to permanently delete the item "{name}"?',
  EmptyRecycleBinError: "Unable to empty the recycle bin.",
  EmptyRecycleBinWarningMessage:
    "Are you sure you want to permanently delete all the items? You cannot undo this action.",
  FileDeletionError: "Unable to delete file.",
  FileOpenError: "The file type is unsupported.",
  FileRestoreError: "Unable to restore file.",
  FileValidationError: "Invalid file name.",
  FolderDeletionError: "Unable to delete folder.",
  FolderRestoreError: "Unable to restore folder.",
  FolderValidationError:
    "The folder name cannot contain more than 100 characters.",
  NewFileCreationError: 'Unable to create file "%(name)s".',
  NewFilePrompt: "Enter a file name.",
  NewFileTitle: "New File",
  NewFolderCreationError: 'Unable to create folder "%(name)s".',
  NewFolderPrompt: "Enter a folder name.",
  NewFolderTitle: "New Folder",
  RemoveFromFavoritesError: "The item could not be removed from My Favorites.",
  RenameError: 'Unable to rename "%(oldName)s" to "%(newName)s".',
  RenameFileTitle: "Rename File",
  RenameFolderTitle: "Rename Folder",
  RenamePrompt: "Enter a new name.",
  RenameUnsavedFileError: "You must save your file before you can rename it.",
};
