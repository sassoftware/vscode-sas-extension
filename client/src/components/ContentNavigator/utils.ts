// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { SnippetString, Uri } from "vscode";

import {
  DATAFLOW_TYPE,
  DEFAULT_FILE_CONTENT_TYPE,
  FAVORITES_FOLDER_TYPE,
  FILE_TYPES,
  FOLDER_TYPE,
  FOLDER_TYPES,
  TRASH_FOLDER_TYPE,
} from "./const";
import mimeTypes from "./mime-types";
import { ContentItem, Link, Permission } from "./types";

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

  if (item.flags?.isInMyFavorites) {
    actions.push("removeFromFavorites");
  } else if (
    item.type !== "reference" &&
    [FOLDER_TYPE, ...FILE_TYPES].includes(type) &&
    !isRecycled
  ) {
    actions.push("addToFavorites");
  }

  // if item is a notebook file add action
  if (item?.name?.endsWith(".sasnb")) {
    actions.push("convertNotebookToFlow");
  }

  if (!isContainer(item)) {
    actions.push("allowDownload");
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

export const getPermission = (item: ContentItem): Permission => {
  const itemType = getTypeName(item);
  return [FOLDER_TYPE, ...FILE_TYPES].includes(itemType) // normal folders and files
    ? {
        write: !!getLink(item.links, "PUT", "update"),
        delete: !!getLink(item.links, "DELETE", "deleteResource"),
        addMember: !!getLink(item.links, "POST", "createChild"),
      }
    : {
        // delegate folders, user folder and user root folder
        write: false,
        delete: false,
        addMember:
          itemType !== TRASH_FOLDER_TYPE &&
          itemType !== FAVORITES_FOLDER_TYPE &&
          !!getLink(item.links, "POST", "createChild"),
      };
};

export const getFileContentType = (fileName: string) =>
  mimeTypes[fileName.split(".").pop().toLowerCase()] ||
  DEFAULT_FILE_CONTENT_TYPE;

export const getItemContentType = (item: ContentItem): string | undefined => {
  const itemIsReference = item.type === "reference";
  if (itemIsReference || isContainer(item)) {
    return undefined;
  }

  if (item.contentType === DATAFLOW_TYPE) {
    return "application/json";
  }

  return "application/vnd.sas.file+json";
};
