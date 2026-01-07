// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TreeItem, TreeView } from "vscode";

/**
 * Gets the selected items from a tree view based on the current selection state.
 *
 * If multiple items are selected in the tree view, returns those selections.
 * If no item is passed or no selections exist, returns the tree view's selection.
 * Otherwise, returns the single clicked item.
 *
 * @param treeView - The VS Code TreeView instance
 * @param item - The item that was clicked/activated
 * @returns An array of selected items
 */
export function treeViewSelections<T extends TreeItem>(
  treeView: TreeView<T>,
  item: T | undefined,
): T[] {
  // If we have an item, we need to make sure it is part of the selection
  // If it's not, _it_ should be what is selected. Otherwise, we can
  // just rely on treeView selection
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
