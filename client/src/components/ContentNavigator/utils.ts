// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import {
  FileType,
  SnippetString,
  Tab,
  TabInputNotebook,
  TabInputText,
  window,
} from "vscode";

import { basename } from "path";

import { ProfileWithFileRootOptions } from "../profile";
import {
  DEFAULT_FILE_CONTENT_TYPE,
  FILE_TYPES,
  FOLDER_TYPE,
  FOLDER_TYPES,
  SERVER_HOME_FOLDER_TYPE,
  TRASH_FOLDER_TYPE,
} from "./const";
import mimeTypes from "./mime-types";
import { ContentItem, Permission } from "./types";

export const isContainer = (item: ContentItem): boolean =>
  item.fileStat.type === FileType.Directory;

export const isReference = (item: ContentItem): boolean =>
  !!item && item?.type === "reference";

export const isValidItem = (item: ContentItem): boolean =>
  !!item && !!item.id && !!item.name && !!item.links;

export const isItemInRecycleBin = (item: ContentItem): boolean =>
  !!item && item.flags?.isInRecycleBin;

export const isContentItem = (item): item is ContentItem => isValidItem(item);

// A document uses uppercase letters _if_ are no words
// (where word means gte 3 characters) that are lowercase.
const documentUsesUppercase = (documentContent: string) =>
  documentContent &&
  !documentContent
    // Exclude anything in quotes from our calculations
    .replace(/('|")([^('|")]*)('|")/g, "")
    .match(/([a-z]{3,})\S/g);

export const getFileStatement = (
  contentItemName: string,
  documentContent: string,
  fileFolderPath: string,
): SnippetString => {
  const usesUppercase = documentUsesUppercase(documentContent);
  const cmd = "filename ${1:fileref} filesrvc folderpath='$1' filename='$2';\n";

  return new SnippetString(
    (usesUppercase ? cmd.toUpperCase() : cmd)
      .replace("$1", fileFolderPath.replace(/'/g, "''"))
      .replace("$2", contentItemName.replace(/'/g, "''")),
  );
};

export const getFileContentType = (fileName: string) =>
  mimeTypes[fileName.split(".").pop().toLowerCase()] ||
  DEFAULT_FILE_CONTENT_TYPE;

export const createStaticFolder = (
  folderId: string,
  name: string,
  type: string,
  membersUri: string,
  membersRel: string = "members",
) => ({
  id: folderId,
  name,
  type: type,
  uri: folderId,
  links: [
    {
      method: "GET",
      rel: membersRel,
      href: membersUri,
      uri: membersUri,
      type: "GET",
    },
    {
      method: "GET",
      rel: "self",
      href: folderId,
      uri: folderId,
      type: "GET",
    },
  ],
});

export const convertStaticFolderToContentItem = (
  staticFolder: ReturnType<typeof createStaticFolder>,
  permission: Permission,
): ContentItem => {
  const item: ContentItem = {
    ...staticFolder,
    uid: staticFolder.id,
    creationTimeStamp: 0,
    modifiedTimeStamp: 0,
    permission,
    fileStat: {
      ctime: 0,
      mtime: 0,
      size: 0,
      type: FileType.Directory,
    },
  };
  item.typeName = staticFolder.type;
  return item;
};

export const getEditorTabsForItem = (item: ContentItem) => {
  const fileUri = item.vscUri;
  const tabs: Tab[] = window.tabGroups.all.map((tg) => tg.tabs).flat();
  return tabs.filter(
    (tab) =>
      (tab.input instanceof TabInputText ||
        tab.input instanceof TabInputNotebook) &&
      tab.input.uri.query.includes(fileUri.query), // compare the file id
  );
};

export const sortedContentItems = (items: ContentItem[]) =>
  items.sort((a, b) => {
    const aIsDirectory = a.fileStat?.type === FileType.Directory;
    const bIsDirectory = b.fileStat?.type === FileType.Directory;
    if (aIsDirectory && !bIsDirectory) {
      return -1;
    } else if (!aIsDirectory && bIsDirectory) {
      return 1;
    } else {
      return a.name.localeCompare(b.name);
    }
  });

export const homeDirectoryName = (
  fileNavigationRoot: ProfileWithFileRootOptions["fileNavigationRoot"],
  fileNavigationCustomRootPath: ProfileWithFileRootOptions["fileNavigationCustomRootPath"],
): string => {
  const defaultName = "Home";
  if (fileNavigationRoot !== "CUSTOM" || !fileNavigationCustomRootPath) {
    return defaultName;
  }

  return basename(fileNavigationCustomRootPath) || defaultName;
};

export const homeDirectoryNameAndType = (
  fileNavigationRoot: ProfileWithFileRootOptions["fileNavigationRoot"],
  fileNavigationCustomRootPath: ProfileWithFileRootOptions["fileNavigationCustomRootPath"],
): [string, string] => {
  const directoryName = homeDirectoryName(
    fileNavigationRoot,
    fileNavigationCustomRootPath,
  );
  if (directoryName === "Home") {
    return [directoryName, SERVER_HOME_FOLDER_TYPE];
  }

  return [directoryName, FOLDER_TYPE];
};

export const getTypeName = (item: ContentItem): string =>
  item.contentType || item.type;

export const isRootFolder = (item: ContentItem, bStrict?: boolean): boolean => {
  const typeName = item.typeName;
  if (!bStrict && isItemInRecycleBin(item) && isReference(item)) {
    return false;
  }
  if (FOLDER_TYPES.indexOf(typeName) >= 0) {
    return true;
  }
  return false;
};

export enum ContextMenuAction {
  CreateChild = "createChild", // Create a new folder _under_ the current one
  Delete = "delete", // The item can be deleted
  Update = "update", // The item can be updated/edited/renamed
  Restore = "restore", // The item can be restored
  CopyPath = "copyPath", // The item path can be copied
  Empty = "empty", // Whether or not children can be deleted permanently (for the recycling bin)
  AddToFavorites = "addToFavorites", // Item can be added to favorites
  RemoveFromFavorites = "removeFromFavorites", // Item can be removed from favorites
  ConvertNotebookToFlow = "convertNotebookToFlow", // Allows sasnb files to be converted to flows
  AllowDownload = "allowDownload", // Allows downloading files / folders
}
export class ContextMenuProvider {
  constructor(
    protected readonly validContextMenuActions: ContextMenuAction[],
    protected readonly enablementOverrides: Partial<
      Record<ContextMenuAction, (item: ContentItem) => boolean>
    > = {},
  ) {}

  public availableActions(item: ContentItem): string {
    if (!isValidItem(item)) {
      return "";
    }

    const { write, delete: canDelete, addMember } = item.permission;
    const isRecycled = isItemInRecycleBin(item);
    const type = getTypeName(item);

    const menuActionEnablement = {
      [ContextMenuAction.CreateChild]: () => addMember && !isRecycled,
      [ContextMenuAction.Delete]: () =>
        canDelete && !item.flags?.isInMyFavorites,
      [ContextMenuAction.Update]: () => write && !isRecycled,
      [ContextMenuAction.Restore]: () => write && isRecycled,
      [ContextMenuAction.CopyPath]: () => (addMember || write) && !isRecycled,
      [ContextMenuAction.Empty]: () =>
        type === TRASH_FOLDER_TYPE && !!item?.memberCount,
      [ContextMenuAction.AddToFavorites]: () =>
        !item.flags?.isInMyFavorites &&
        item.type !== "reference" &&
        [FOLDER_TYPE, ...FILE_TYPES].includes(type) &&
        !isRecycled,
      [ContextMenuAction.RemoveFromFavorites]: () =>
        item.flags?.isInMyFavorites,
      [ContextMenuAction.ConvertNotebookToFlow]: () =>
        item?.name?.endsWith(".sasnb"),
      [ContextMenuAction.AllowDownload]: () => !isRootFolder(item),
      ...(this.enablementOverrides || {}),
    };

    const actions = Object.keys(menuActionEnablement)
      .filter((key: ContextMenuAction) =>
        this.validContextMenuActions.includes(key),
      )
      .filter((key) => menuActionEnablement[key](item))
      .map((key) => key);

    return actions.sort().join("-");
  }
}
