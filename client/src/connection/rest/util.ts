// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri } from "vscode";

import {
  DATAFLOW_TYPE,
  FAVORITES_FOLDER_TYPE,
  FILE_TYPES,
  FOLDER_TYPE,
  FOLDER_TYPES,
  TRASH_FOLDER_TYPE,
} from "../../components/ContentNavigator/const";
import {
  ContentItem,
  ContentSourceType,
  Link,
  Permission,
} from "../../components/ContentNavigator/types";
import {
  isItemInRecycleBin,
  isReference,
  isValidItem,
} from "../../components/ContentNavigator/utils";

export const isContainer = (item: ContentItem, bStrict?: boolean): boolean => {
  const typeName = item.typeName;
  if (!bStrict && isItemInRecycleBin(item) && isReference(item)) {
    return false;
  }
  if (FOLDER_TYPES.indexOf(typeName) >= 0) {
    return true;
  }
  return false;
};

export const getLink = (
  links: Array<Link>,
  method: string,
  relationship: string,
): Link | null =>
  !links || links.length === 0
    ? null
    : links.find((link) => link.method === method && link.rel === relationship);

export const getResourceIdFromItem = (item: ContentItem): string | null => {
  // Only members have uri attribute.
  if (item.uri) {
    return item.uri;
  }

  return getLink(item.links, "GET", "self")?.uri || null;
};

export const resourceType = (item: ContentItem): string | undefined => {
  if (!isValidItem(item)) {
    return;
  }
  const { write, delete: del, addMember } = getPermission(item);
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

export const getSasContentUri = (item: ContentItem, readOnly?: boolean): Uri =>
  Uri.parse(
    `${readOnly ? `${ContentSourceType.SASContent}ReadOnly` : ContentSourceType.SASContent}:/${
      item.name
    }?id=${getResourceIdFromItem(item)}`,
  );

export const getSasServerUri = (item: ContentItem, readOnly?: boolean): Uri =>
  Uri.parse(
    `${readOnly ? `${ContentSourceType.SASServer}ReadOnly` : ContentSourceType.SASServer}:/${
      item.name
    }?id=${getResourceIdFromItem(item)}`,
  );

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

export const getResourceId = (uri: Uri): string => uri.query.substring(3); // ?id=...

export const getTypeName = (item: ContentItem): string =>
  item.contentType || item.type;
