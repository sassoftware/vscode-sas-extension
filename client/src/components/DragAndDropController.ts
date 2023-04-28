// Copyright © 2023, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// Licensed under SAS Code Extension Terms, available at Code_Extension_Agreement.pdf

import {
  CancellationToken,
  DataTransfer,
  DataTransferItem,
  DocumentDropEdit,
  DocumentDropEditProvider,
  DocumentSelector,
  ExtensionContext,
  Position,
  TextDocument,
  TreeDragAndDropController,
  languages,
} from "vscode";

class DragAndDropController<T>
  implements TreeDragAndDropController<T>, DocumentDropEditProvider
{
  public dropMimeTypes: string[];
  public dragMimeTypes: string[];
  private draggedItem: string | undefined;
  private draggableItem: (item: T | undefined) => string | undefined;

  constructor(
    context: ExtensionContext,
    dragMimeType: string,
    draggableItem: (item: T | undefined) => string | undefined
  ) {
    this.dragMimeTypes = [dragMimeType];
    this.draggableItem = draggableItem;

    context.subscriptions.push(
      languages.registerDocumentDropEditProvider(this.selector(), this)
    );
  }

  public handleDrag(
    source: T[],
    dataTransfer: DataTransfer
  ): void | Thenable<void> {
    this.draggedItem = this.draggableItem(source?.[0]);

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
      !(
        this.draggableItem(JSON.parse(dataTransferItem.value)[0]) ===
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

export default DragAndDropController;
