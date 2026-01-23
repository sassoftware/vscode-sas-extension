// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { AgColumn, ColumnState, GridApi } from "ag-grid-community";

import GridMenu from "./GridMenu";
import localize from "./localize";
import { applyColumnState } from "./useDataViewer";
import useTheme from "./useTheme";

export interface ColumnMenuProps {
  column: AgColumn;
  dismissMenu: () => void;
  hasSort: boolean;
  left: number;
  loadColumnProperties: () => void;
  pinColumn: (side: "left" | "right" | false) => void;
  removeAllSorting: () => void;
  removeFromSort: () => void;
  sortColumn: (direction: "asc" | "desc") => void;
  top: number;
}

// Lets pick off only the column properties we care about.
const filteredColumnState = (columnState: ColumnState[]) => {
  return columnState.map(({ colId, sort, sortIndex, pinned }) => {
    return { colId, sort, sortIndex, pinned };
  });
};

export const getColumnMenu = (
  api: GridApi,
  column: AgColumn,
  { height, top, left }: DOMRect,
  dismissMenu: () => void,
  loadColumnProperties: (columnName: string) => void,
): ColumnMenuProps => ({
  column,
  dismissMenu,
  hasSort: api.getColumnState().some((c) => c.sort),
  left,
  top: top + height,
  pinColumn: (side: "left" | "right" | false) => {
    const columnState = filteredColumnState(api.getColumnState());
    const foundColumn = columnState.find((col) => col.colId === column.colId);
    foundColumn.pinned = side;
    applyColumnState(api, columnState);
  },
  sortColumn: (direction: "asc" | "desc" | null) => {
    const columnState = filteredColumnState(api.getColumnState());
    const foundColumn = columnState.find((col) => col.colId === column.colId);
    const currentSortValue = foundColumn.sort;
    foundColumn.sort = direction;
    if (!currentSortValue) {
      foundColumn.sortIndex = api.getColumnState().filter((c) => c.sort).length;
    }
    applyColumnState(api, columnState);
  },
  removeAllSorting: () =>
    applyColumnState(
      api,
      filteredColumnState(api.getColumnState()).map((c) => ({
        ...c,
        sort: null,
      })),
    ),
  removeFromSort: () => {
    // First, lets remove from sort
    let newColumnState = filteredColumnState(api.getColumnState())
      .sort((a, b) => a.sortIndex - b.sortIndex)
      .map((c) => ({
        ...c,
        sort: column.colId === c.colId ? null : c.sort,
      }));

    // Next, lets assign updated sort indices
    let sortIndex = 0;
    newColumnState = newColumnState.map((c) => {
      if (!c.sort) {
        return c;
      }
      return { ...c, sortIndex: sortIndex++ };
    });

    applyColumnState(api, newColumnState);
  },
  loadColumnProperties: () => {
    loadColumnProperties(column.colId);
  },
});

const ColumnMenu = ({
  column,
  dismissMenu,
  hasSort,
  left,
  loadColumnProperties,
  pinColumn,
  removeAllSorting,
  removeFromSort,
  sortColumn,
  top,
}: ColumnMenuProps) => {
  const theme = useTheme();
  const sort = column.getSort();
  const pinned = column.getPinned();
  const menuItems = [
    {
      name: localize("Pin"),
      children: [
        {
          name: localize("Pinned to the left"),
          checked: pinned === "left",
          onPress: () => {
            pinColumn("left");
            dismissMenu();
          },
        },
        {
          name: localize("Pinned to the right"),
          checked: pinned === "right",
          onPress: () => {
            pinColumn("right");
            dismissMenu();
          },
        },
        {
          name: localize("Not pinned"),
          checked: !pinned,
          onPress: () => {
            pinColumn(false);
            dismissMenu();
          },
        },
      ],
    },
    "separator",
    {
      name: localize("Sort"),
      children: [
        {
          name:
            hasSort && !sort
              ? localize("Ascending (add to sorting)")
              : localize("Ascending"),
          checked: sort === "asc",
          onPress: () => {
            sortColumn("asc");
            dismissMenu();
          },
        },
        {
          name:
            hasSort && !sort
              ? localize("Descending (add to sorting)")
              : localize("Descending"),
          checked: sort === "desc",
          onPress: () => {
            sortColumn("desc");
            dismissMenu();
          },
        },
        "separator",
        {
          name: localize("Remove sorting"),
          onPress: () => {
            removeFromSort();
            dismissMenu();
          },
          disabled: !hasSort || !sort,
        },
        {
          name: localize("Remove all sorting"),
          onPress: () => {
            removeAllSorting();
            dismissMenu();
          },
          disabled: !hasSort,
        },
      ],
    },
    {
      name: localize("Filter column"),
      onPress: () => {
        dismissMenu();
      },
    },
    "separator",
    {
      name: localize("Properties"),
      onPress: loadColumnProperties,
    },
  ];

  return (
    <>
      <GridMenu menuItems={menuItems} top={top} left={left} theme={theme} />
    </>
  );
};

export default ColumnMenu;
