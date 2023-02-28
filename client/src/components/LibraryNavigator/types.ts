export type LibraryItemType = "library" | "table";
export interface LibraryItem {
  id: string;
  links: Link[];
  name: string;
  type: LibraryItemType;
}

// @TODO #129 Consolidate w/ the other link type
export interface Link {
  method: string;
  rel: string;
  href: string;
  type: string;
  uri: string;
}

export interface TableRow {
  cells: string[];
}

export interface TableHeader {
  columns: string[];
}

export interface TableData {
  headers: TableHeader;
  rows: TableRow[];
}
