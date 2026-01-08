// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TreeItem, TreeView } from "vscode";

/**
 * Gets the selected items from a tree view based on the current selection state.
 *
 * If an item is present and is not part of selections, return the item. Otherwise,
 * return the selections.
 *
 * @param treeView - The VS Code TreeView instance
 * @param item - The item that was clicked/activated
 * @returns An array of selected items
 */
export function treeViewSelections<T extends TreeItem>(
  treeView: TreeView<T>,
  item: T | undefined,
): T[] {
  if (item) {
    const itemIsInSelection = treeView.selection.some(
      ({ id }) => id === item.id,
    );
    if (itemIsInSelection) {
      return [...treeView.selection];
    }

    return [item];
  }

  return [...treeView.selection];
}
