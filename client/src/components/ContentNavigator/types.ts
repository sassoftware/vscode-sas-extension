export interface ContentItem {
  // TODO #56 Lets see if we can prevent disabling this
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [propName: string]: any;
}

export interface Link {
  method: string;
  rel: string;
  href: string;
  type: string;
  uri: string;
}
