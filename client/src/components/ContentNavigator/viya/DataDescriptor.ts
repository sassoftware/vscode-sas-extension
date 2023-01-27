import { ContentItem, Link } from "../types";
import { FOLDER_TYPES, FOLDER_TYPE, FILE_TYPE } from "./const";
import { Uri } from "vscode";
import { getLink } from "../utils";

export class DataDescriptor {
  public getId = (item: ContentItem): string | null =>
    getLink(item.links, "GET", "self")?.uri || null;

  public getResourceId = (item: ContentItem): string | null => {
    // Only members have uri attribute.
    if (item.uri) {
      return item.uri;
    }

    return getLink(item.links, "GET", "self")?.uri || null;
  };

  public getLabel = (item: ContentItem): string => item.name;

  public getTypeName = (item: ContentItem): string =>
    item.contentType || item.type;

  public isContainer = (item: ContentItem, bStrict?: boolean): boolean => {
    const typeName = this.getTypeName(item);
    if (!bStrict && this.isItemInRecycleBin(item) && this.isReference(item)) {
      return false;
    }
    if (FOLDER_TYPES.indexOf(typeName) >= 0) {
      return true;
    }
    return false;
  };

  public resourceType = (item: ContentItem): string | undefined => {
    if (!this.isValidItem(item)) {
      return;
    }

    const typeName = this.getTypeName(item);
    // We want to prevent trying to delete base level folders (favorites, my folder, etc)
    const resourceTypes = [FOLDER_TYPE, FILE_TYPE].includes(typeName)
      ? ["createChild", "delete", "update"]
      : ["createChild", "update"];

    const links = item.links.filter((link: Link) =>
      resourceTypes.includes(link.rel)
    );

    if (links.length === 0) {
      return;
    }

    return links
      .map((link: Link) => link.rel)
      .sort()
      .join("-");
  };

  public getUri = (item: ContentItem): Uri => {
    return Uri.parse(
      `sas:/${this.getLabel(item)}?id=${this.getResourceId(item)}`
    );
  };

  public getModifyDate = (item: ContentItem): number => item.modifiedTimeStamp;

  public getCreationDate = (item: ContentItem): number =>
    item.creationTimeStamp;

  public isReference = (item: ContentItem): boolean =>
    !!item && item?.type === "reference";

  public isValidItem = (item: ContentItem): boolean =>
    !!item && !!item.id && !!item.name && !!item.links;

  public isItemInRecycleBin = (item: ContentItem): boolean =>
    !!item && item.__trash__;
}
