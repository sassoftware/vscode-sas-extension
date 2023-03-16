// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import { Uri } from "vscode";
import {
  FAVORITES_FOLDER,
  FILE_TYPE,
  FOLDER_TYPE,
  FOLDER_TYPES,
} from "./const";
import { ContentItem, Link, Permission } from "./types";

export const getLink = (
  links: Array<Link>,
  method: string,
  relationship: string
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
  const { write, delete: del, addMember } = getPermission(item);
  const isRecycled = isItemInRecycleBin(item);
  const actions = [
    addMember && !isRecycled ? "createChild" : undefined,
    del ? "delete" : undefined,
    write && !isRecycled ? "update" : undefined,
    write && isRecycled ? "restore" : undefined,
  ].filter((action) => !!action);

  if (getTypeName(item) === "trashFolder") {
    if (!isNaN(item.memberCount) && item.memberCount > 0) {
      actions.push("empty");
    }
  }

  if (actions.length === 0) {
    return;
  }

  return actions.sort().join("-");
};

export const getUri = (item: ContentItem, readOnly?: boolean): Uri =>
  Uri.parse(
    `${readOnly ? "sasReadOnly" : "sas"}:/${getLabel(
      item
    )}?id=${getResourceIdFromItem(item)}`
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
  !!item && item.__trash__;

export const getPermission = (item: ContentItem): Permission => {
  const itemType = getTypeName(item);
  return [FOLDER_TYPE, FILE_TYPE].includes(itemType) // normal folders and files
    ? {
        write: !!getLink(item.links, "PUT", "update"),
        delete: !!getLink(item.links, "DELETE", "delete"),
        addMember: !!getLink(item.links, "POST", "createChild"),
      }
    : {
        // delegate folders, user folder and user root folder
        write: false,
        delete: false,
        addMember:
          itemType !== "trashFolder" &&
          itemType !== FAVORITES_FOLDER &&
          !!getLink(item.links, "POST", "createChild"),
      };
};
