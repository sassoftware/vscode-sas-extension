import { ContentItem } from "../types";

export abstract class DataDescriptor {
  public abstract getId(item: ContentItem): string;

  public abstract getResourceId(item: ContentItem): string;

  public abstract getLabel(item: ContentItem): string;

  public abstract getTypeName(item: ContentItem): string;

  public abstract isContainer(item: ContentItem): boolean;

  public abstract getModifyDate(item: ContentItem): string;

  public abstract getCreationDate(item: ContentItem): string;
}
