// Copyright © 2022, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  CancellationToken,
  DataTransfer,
  DataTransferItem,
  DocumentSelector,
  TextDocument,
  TreeDragAndDropController,
  DocumentDropEditProvider,
  Position,
  DocumentDropEdit,
} from "vscode";
import { LibraryItem } from "./types";

class LibraryDragAndDropController
  implements TreeDragAndDropController<LibraryItem>, DocumentDropEditProvider
{
  dropMimeTypes: string[];
  dragMimeTypes: string[] = [];
  draggedItem: string | undefined;

  constructor(dragMimeType: string) {
    this.dragMimeTypes = [dragMimeType];
  }

  public handleDrag(
    source: LibraryItem[],
    dataTransfer: DataTransfer
  ): void | Thenable<void> {
    if (source[0] && source[0].library) {
      this.draggedItem = `${source[0].library}.${source[0].id}`;
    }

    const dataTransferItem = new DataTransferItem(source);
    dataTransfer.set(this.dragMimeTypes[0], dataTransferItem);
  }

  public async provideDocumentDropEdits(
    _document: TextDocument,
    position: Position,
    dataTransfer: DataTransfer,
    token: CancellationToken
  ): Promise<DocumentDropEdit | undefined> {
    const dataTransferItem = dataTransfer.get(this.dragMimeTypes[0]);
    if (
      token.isCancellationRequested ||
      !dataTransferItem ||
      !this.draggedItem ||
      !JSON.parse(dataTransferItem.value).itemHandles?.[0].includes(
        this.draggedItem
      )
    ) {
      this.draggedItem = undefined;
      return undefined;
    }

    const insertText = this.draggedItem;
    this.draggedItem = undefined;

    return { insertText };
  }

  public selector(): DocumentSelector {
    return { language: "sas" };
  }
}

export default LibraryDragAndDropController;
