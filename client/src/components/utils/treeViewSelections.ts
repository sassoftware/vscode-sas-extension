// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { TreeView } from "vscode";

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
export function treeViewSelections<T>(
  treeView: TreeView<T>,
  item: T | undefined,
): T[] {
  return treeView.selection.length > 1 || !item
    ? [...treeView.selection]
    : [item];
}
