// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { Uri } from "vscode";
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
  if (item?.name?.endsWith(".sasnb") || item?.name?.endsWith(".ipynb")) {
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
