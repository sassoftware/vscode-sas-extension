export interface ContentItem {
  id: string;
  contentType?: string;
  creationTimeStamp: number;
  links: Link[];
  modifiedTimeStamp: number;
  name: string;
  type?: string;
  uri: string;
  __trash__: boolean;
}

export interface Link {
  method: string;
  rel: string;
  href: string;
  type: string;
  uri: string;
}
