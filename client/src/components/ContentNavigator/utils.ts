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

import { DEFAULT_FILE_CONTENT_TYPE } from "./const";
import mimeTypes from "./mime-types";
import { ContentItem } from "./types";

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

export const getEditorTabsForItem = (item: ContentItem) => {
  const fileUri = item.vscUri;
  // TODO FIX ME
  if (!item.vscUri) {
    return [];
  }
  const tabs: Tab[] = window.tabGroups.all.map((tg) => tg.tabs).flat();
  return tabs.filter(
    (tab) =>
      (tab.input instanceof TabInputText ||
        tab.input instanceof TabInputNotebook) &&
      tab.input.uri.query.includes(fileUri.query), // compare the file id
  );
};
