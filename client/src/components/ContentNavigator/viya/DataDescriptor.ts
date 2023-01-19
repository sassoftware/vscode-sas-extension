import * as ServicesUtil from "../utils";
import { ContentItem } from "../types";
import { DataDescriptor as AbstractDataDescriptor } from "../base/DataDescriptor";
import { FOLDER_TYPES } from "./const";

export class DataDescriptor extends AbstractDataDescriptor {
  public getId = (item: ContentItem) => {
    const oSelfLink = ServicesUtil.getLink(item.links, "GET", "self");
    return oSelfLink ? oSelfLink.uri : null;
  };

  public getResourceId = (item: ContentItem) => {
    // Only members have uri attribute.
    if (item.uri) {
      return item.uri;
    }
    const oSelfLink = ServicesUtil.getLink(item.links, "GET", "self");
    return oSelfLink ? oSelfLink.uri : null;
  };

  public getLabel = (item: ContentItem) => item.name;

  public getTypeName = (item: ContentItem) =>
    item.contentType ? item.contentType : item.type;

  public isContainer = (item: ContentItem, bStrict?: boolean) => {
    const typeName = this.getTypeName(item);
    if (!bStrict && this.isItemInRecycleBin(item) && this.isReference(item)) {
      return false;
    }
    if (FOLDER_TYPES.indexOf(typeName) >= 0) {
      return true;
    }
    return false;
  };

  public getModifyDate = (item: ContentItem) => item.modifiedTimeStamp;
  public getCreationDate = (item: ContentItem) => item.creationTimeStamp;

  public isReference = (item: ContentItem) =>
    !!item && item.type && item.type === "reference";

  public isValidItem = (item: ContentItem) =>
    !!item && !!item.id && !!item.name && !!item.links;

  public isItemInRecycleBin = (item: ContentItem) => !!item && item.__trash__;
}
