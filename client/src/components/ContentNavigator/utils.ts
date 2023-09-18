// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri } from "vscode";

import { parse } from "path";

import {
  FILE_TYPE,
  FOLDER_TYPE,
  FOLDER_TYPES,
  TRASH_FOLDER_TYPE,
} from "./const";
import { ContentItem, Link } from "./types";

export const getLink = (
  links: Array<Link>,
  method: string,
  relationship: string,
): Link | null =>
  !links || links.length === 0
    ? null
    : links.find((link) => link.method === method && link.rel === relationship);

export const getResourceId = (uri: Uri): string => uri.query.substring(3); // ?id=...

export const getId = (item: ContentItem): string | null =>
  item.uid || getLink(item.links, "GET", "self")?.uri + item.type || null;

export const getResourceIdFromItem = (item: ContentItem): string | null => {
  // Only members have uri attribute.
  if (item.uri) {
    return item.uri;
  }

  return getLink(item.links, "GET", "self")?.uri || null;
};

export const getLabel = (item: ContentItem): string => item.name;

export const getTypeName = (item: ContentItem): string =>
  item.contentType || item.type;

export const isContainer = (item: ContentItem, bStrict?: boolean): boolean => {
  const typeName = getTypeName(item);
  if (!bStrict && isItemInRecycleBin(item) && isReference(item)) {
    return false;
  }
  if (FOLDER_TYPES.indexOf(typeName) >= 0) {
    return true;
  }
  return false;
};

export const resourceType = (item: ContentItem): string | undefined => {
  if (!isValidItem(item)) {
    return;
  }
  const { write, delete: del, addMember } = item.permission;
  const isRecycled = isItemInRecycleBin(item);
  const actions = [
    addMember && !isRecycled && "createChild",
    del && !item.flags?.isInMyFavorites && "delete",
    write && (!isRecycled ? "update" : "restore"),
  ].filter((action) => !!action);

  const type = getTypeName(item);
  if (type === TRASH_FOLDER_TYPE && item?.memberCount) {
    actions.push("empty");
  }

  if (item.flags?.isInMyFavorites || item.flags?.hasFavoriteId) {
    actions.push("removeFromFavorites");
  } else if (
    item.type !== "reference" &&
    [FOLDER_TYPE, FILE_TYPE].includes(type) &&
    !isRecycled
  ) {
    actions.push("addToFavorites");
  }

  // if item is a notebook file add action
  if (item?.name?.endsWith(".sasnb")) {
    actions.push("convertNotebookToFlow");
  }

  if (actions.length === 0) {
    return;
  }

  return actions.sort().join("-");
};

export const getUri = (item: ContentItem, readOnly?: boolean): Uri =>
  Uri.parse(
    `${readOnly ? "sasReadOnly" : "sas"}:/${getLabel(
      item,
    )}?id=${getResourceIdFromItem(item)}`,
  );

export const getModifyDate = (item: ContentItem): number =>
  item.modifiedTimeStamp;

export const getCreationDate = (item: ContentItem): number =>
  item.creationTimeStamp;

export const isReference = (item: ContentItem): boolean =>
  !!item && item?.type === "reference";

export const isValidItem = (item: ContentItem): boolean =>
  !!item && !!item.id && !!item.name && !!item.links;

export const isItemInRecycleBin = (item: ContentItem): boolean =>
  !!item && item.flags?.isInRecycleBin;

export const isContentItem = (item): item is ContentItem => isValidItem(item);

/**
 * This attempts to create a new variabe in our SAS program using the following rules:
 * - First, we attempt to use only the alphanumeric characters from contentItem.name as
 *   as our variable name (without the file extension).
 * - If that's empty, we instead use `<extension>file`
 * - Next, we add a numeric suffix to the variable name, and check documentContent to make
 *   sure what we're creating isn't already in use.
 * - If the current variable is in use, we continue to increment our numeric suffix until
 *   we find one that doesn't exist in our document.
 *
 * @param contentItemName ContentItem.name used for creating variable name.
 * @param documentContent The contents of the editor we're dropping into.
 *
 * @returns string our new variable name.
 */
const extractVariableName = (
  contentItemName: string,
  documentContent: string,
): string => {
  const filePieces = parse(contentItemName);
  const partialFileName = (
    filePieces.name.replace(/[^a-zA-Z0-9]/g, "") ||
    `${filePieces.ext.replace(".", "")}file`
  ).toLocaleLowerCase();

  let idx = 0;
  const lowercaseDocumentContent = documentContent.toLocaleLowerCase();
  while (
    // The trailing space is intentional here so we don't confuse things like
    // `csvfile11` for `csvfile1`
    lowercaseDocumentContent.indexOf(`${partialFileName}${++idx} `) !== -1
  ) {
    /* empty */
  }

  return `${partialFileName}${idx}`;
};

// A document uses uppercase letters _if_ there is more than one
// word (where word means gte 3 characters) that is all uppercase
const documentUsesUppercase = (documentContent: string) =>
  (
    documentContent
      // Exclude anything in quotes from our calculations
      .replace(/('|")([^('|")]*)('|")/g, "")
      .match(/([A-Z]{3,})\S/g) || []
  ).length > 1;

export const getFileStatement = (
  contentItemName: string,
  documentContent: string,
  fileFolderPath: string,
): string => {
  const filename = extractVariableName(contentItemName, documentContent);
  const usesUppercase = documentUsesUppercase(documentContent);
  const cmd = `filename ${filename} filesrvc folderpath='$1' filename='$2';\n`;
  return (usesUppercase ? cmd.toUpperCase() : cmd)
    .replace("$1", fileFolderPath)
    .replace("$2", contentItemName);
};
