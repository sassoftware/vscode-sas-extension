// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export interface ContentItem {
  id: string;
  contentType?: string;
  creationTimeStamp: number;
  links: Link[];
  modifiedTimeStamp: number;
  name: string;
  type?: string;
  uri: string;
  uid?: string;
  flags?: {
    isInRecycleBin?: boolean;
    isInMyFavorites?: boolean;
    hasFavoriteId?: string;
  };
  memberCount?: number;
  permission: Permission;
  parentFolderUri?: string;
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
