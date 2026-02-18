// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { FileStat, Uri } from "vscode";

export interface ContentItem {
  // Data returned from service
  contentType?: string;
  creationTimeStamp: number;
  id: string;
  links: Link[];
  memberCount?: number;
  modifiedTimeStamp: number;
  name: string;
  parentFolderUri?: string;
  type?: string;
  uri: string;
  // UI properties inferred from service data
  contextValue?: string;
  fileStat?: FileStat;
  flags?: {
    isInRecycleBin?: boolean;
    isInMyFavorites?: boolean;
    favoriteUri?: string;
  };
  isReference?: boolean;
  permission: Permission;
  resourceId?: string;
  typeName?: string;
  uid?: string;
  vscUri?: Uri;
}

export interface Link {
  method: string;
  rel: string;
  href: string;
  type: string;
  uri: string;
}

export interface Permission {
  write: boolean;
  delete: boolean;
  addMember: boolean;
}

export interface FileManipulationEvent {
  type: "create" | "recycle" | "rename" | "delete" | "restore";
  uri: Uri;
  newUri?: Uri;
}

export type RootFolderMap = { [name: string]: ContentItem };

export interface AddChildItemProperties {
  name?: string;
  contentType?: string;
  type?: string;
}

export interface ContentAdapter {
  addChildItem: (
    childItemUri: string | undefined,
    parentItemUri: string | undefined,
    properties: AddChildItemProperties,
  ) => Promise<boolean>;
  addItemToFavorites: (item: ContentItem) => Promise<boolean>;
  connect: (baseUrl: string) => Promise<void>;
  connected: () => boolean;
  createNewFolder: (
    parentItem: ContentItem,
    folderName: string,
  ) => Promise<ContentItem | undefined>;
  createNewItem: (
    parentItem: ContentItem,
    fileName: string,
    buffer?: ArrayBufferLike,
  ) => Promise<ContentItem | undefined>;
  deleteItem: (item: ContentItem) => Promise<boolean>;
  getChildItems: (parentItem: ContentItem) => Promise<ContentItem[]>;
  getContentOfItem: (item: ContentItem) => Promise<string>;
  getContentOfUri: (uri: Uri) => Promise<string>;
  getFolderPathForItem: (item: ContentItem) => Promise<string> | string;
  getItemOfUri: (uri: Uri) => Promise<ContentItem>;
  getParentOfItem: (item: ContentItem) => Promise<ContentItem | undefined>;
  getPathOfItem?: (
    item: ContentItem,
    folderPathOnly?: boolean,
  ) => Promise<string>;
  getRootFolder: (name: string) => ContentItem | undefined;
  getRootItems: () => Promise<RootFolderMap>;
  getUriOfItem: (item: ContentItem, readOnly: boolean) => Promise<Uri>;
  moveItem: (
    item: ContentItem,
    targetParentFolderUri: string,
  ) => Promise<Uri | undefined>;
  calculateNewFileUri?: (
    closedFileUri: Uri,
    movedItem: ContentItem,
    newItemUri: Uri,
  ) => Uri | null;
  recycleItem?: (item: ContentItem) => Promise<{ newUri?: Uri; oldUri?: Uri }>;
  removeItemFromFavorites: (item: ContentItem) => Promise<boolean>;
  renameItem: (
    item: ContentItem,
    newName: string,
  ) => Promise<ContentItem | undefined>;
  restoreItem?: (item: ContentItem) => Promise<boolean>;
  updateContentOfItem(uri: Uri, content: string): Promise<void>;
}

export enum ContentSourceType {
  SASContent = "sasContent",
  SASServer = "sasServer",
}

export interface ContentNavigatorConfig {
  treeIdentifier: string;
  mimeType: string;
  sourceType: ContentSourceType;
}
