import { LibraryItem } from "./types";

export const isLibraryItem = (item): item is LibraryItem =>
  item.library && item.name;
