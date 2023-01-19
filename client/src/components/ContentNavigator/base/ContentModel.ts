import * as vscode from "vscode";
import { ContentItem } from "../types";
import { DataDescriptor } from "./dataDescriptor";

export abstract class ContentModel {
  constructor(
    protected readonly endpoint: string,
    protected readonly dataDescriptor: DataDescriptor
  ) {}

  public abstract serviceInit(): Promise<void>;
  public abstract getChildren(item?: ContentItem): Promise<ContentItem[]>;
  public abstract getAncestors(item: ContentItem): Promise<ContentItem[]>;
  public abstract getContentByUri(uri: vscode.Uri): Promise<string>;
  public abstract saveContentToUri(uri: vscode.Uri, content: string);
  public abstract getResourceByUri(uri: vscode.Uri): Promise<ContentItem>;
  public abstract getDataDescriptor(): DataDescriptor;
}
