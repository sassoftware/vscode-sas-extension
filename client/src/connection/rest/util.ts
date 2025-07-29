// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { Uri } from "vscode";

import {
  DATAFLOW_TYPE,
  FAVORITES_FOLDER_TYPE,
  FILE_TYPES,
  FOLDER_TYPE,
  TRASH_FOLDER_TYPE,
} from "../../components/ContentNavigator/const";
import {
  ContentItem,
  ContentSourceType,
  Link,
  Permission,
} from "../../components/ContentNavigator/types";
import {
  getTypeName,
  isRootFolder,
} from "../../components/ContentNavigator/utils";

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

export const getSasContentUri = (item: ContentItem, readOnly?: boolean): Uri =>
  Uri.parse(
    `${readOnly ? `${ContentSourceType.SASContent}ReadOnly` : ContentSourceType.SASContent}:/${
      item.name
        ? item.name.replace(/#/g, "%23").replace(/\?/g, "%3F")
        : item.name
    }?id=${getResourceIdFromItem(item)}`,
  );

export const getSasServerUri = (item: ContentItem, readOnly?: boolean): Uri =>
  Uri.parse(
    `${readOnly ? `${ContentSourceType.SASServer}ReadOnly` : ContentSourceType.SASServer}:/${
      item.name
        ? item.name.replace(/#/g, "%23").replace(/\?/g, "%3F")
        : item.name
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
  if (itemIsReference || isRootFolder(item)) {
    return undefined;
  }

  if (item.contentType === DATAFLOW_TYPE) {
    return "application/json";
  }

  return "application/vnd.sas.file+json";
};

export const getResourceId = (uri: Uri): string => uri.query.substring(3); // ?id=...
