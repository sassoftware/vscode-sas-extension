import { ThemeIcon } from "vscode";

const CONTENT_FOLDER_ID = "CONTENT_FOLDER_ID";
const ROOT_FOLDER_TYPE = "RootFolder";

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
export const FOLDER_TYPE = "folder";
export const TRASH_FOLDER = "trashFolder";
export const FILE_TYPES = [FILE_TYPE];
export const FAVORITES_FOLDER = "favoritesFolder";
export const FOLDER_TYPES = [
  ROOT_FOLDER_TYPE,
  FOLDER_TYPE,
  "myFolder",
  FAVORITES_FOLDER,
  "userFolder",
  "userRoot",
  // TODO #109 Include recycle bin in next iteration
  // TRASH_FOLDER,
];

export const Messages = {
  FileDeletionError: "Unable to delete file",
  FileOpenError: "The file type is unsupported",
  FileValidationError: "Invalid file name",
  FolderValidationError: "Invalid folder name",
  NewFileCreationError: 'Unable to create file "%(name)s"',
  NewFilePrompt: "Please enter a file name",
  NewFileTitle: "New file",
  NewFolderCreationError: 'Unable to create folder "%(name)s"',
  NewFolderPrompt: "Please enter a folder name",
  NewFolderTitle: "New folder",
  RenameError: 'Unable to rename "%(oldName)s" to "%(newName)s"',
  RenameFileTitle: "Rename file",
  RenameFolderTitle: "Rename folder",
  RenamePrompt: "Please enter a new name",
  RenameUnsavedFileError: "Please save your file first",
};
