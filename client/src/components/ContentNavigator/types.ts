// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

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
  __trash__: boolean;
  memberCount?: number;
  permission: Permission;
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
