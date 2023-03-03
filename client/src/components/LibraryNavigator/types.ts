export type LibraryItemType = "library" | "table";
export interface LibraryItem {
  uid: string;
  id: string;
  name: string;
  type: LibraryItemType;
  library: string | undefined;
  readOnly: boolean;
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
