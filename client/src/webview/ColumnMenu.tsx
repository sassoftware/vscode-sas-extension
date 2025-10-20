// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { AgColumn, ColumnState, GridApi } from "ag-grid-community";

import GridMenu from "./GridMenu";

export interface ColumnMenuProps {
  column: AgColumn;
  dismissMenu: () => void;
  hasSort: boolean;
  left: number;
  messages?: Record<string, string>;
  removeAllSorting: () => void;
  removeFromSort: () => void;
  sortColumn: (direction: "asc" | "desc") => void;
  theme: string;
  top: number;
}

export const useColumnMenu = ({
  api,
  theme,
}: {
  api: GridApi;
  theme: ColumnMenuProps["theme"];
}) => {
  const applyColumnState = (state: ColumnState[]) => {
    api.applyColumnState({ state, defaultState: { sort: null } });
    api.ensureIndexVisible(0);
  };

  return (
    column: AgColumn,
    { height, top, left }: DOMRect,
    dismissMenu: () => void,
  ) => ({
    column,
    dismissMenu,
    hasSort: api.getColumnState().some((c) => c.sort),
    left,
    theme,
    top: top + height,
    sortColumn: (direction: "asc" | "desc" | null) => {
      const newColumnState = api.getColumnState().filter((c) => c.sort);
      const colIndex = newColumnState.findIndex(
        (c) => c.colId === column.colId,
      );
      if (colIndex === -1) {
        newColumnState.push({
          colId: column.colId,
          sort: direction,
          sortIndex: newColumnState.length,
        });
      } else {
        newColumnState[colIndex].sort = direction;
      }
      applyColumnState(newColumnState);
    },
    removeAllSorting: () =>
      applyColumnState(
        api
          .getColumnState()
          .filter((c) => c.sort)
          .map((c) => ({ colId: c.colId, sort: null })),
      ),
    removeFromSort: () =>
      applyColumnState(
        api
          .getColumnState()
          .sort((a, b) => a.sortIndex - b.sortIndex)
          .filter((c) => c.sort && c.colId !== column.colId)
          // After we remove the column, lets reindex what's left
          .map((c, sortIndex) => ({ ...c, sortIndex })),
      ),
  });
};

const ColumnMenu = ({
  column,
  dismissMenu,
  hasSort,
  left,
  removeAllSorting,
  removeFromSort,
  sortColumn,
  theme,
  top,
  messages: t,
}: ColumnMenuProps) => {
  const menuItems = [
    {
      name: t.Sort,
      children: [
        {
          name:
            hasSort && !column.sort
              ? t["Ascending (add to sorting)"]
              : t.Ascending,
          checked: column.sort === "asc",
          onPress: () => {
            sortColumn("asc");
            dismissMenu();
          },
        },
        {
          name:
            hasSort && !column.sort
              ? t["Descending (add to sorting)"]
              : t.Descending,
          checked: column.sort === "desc",
          onPress: () => {
            sortColumn("desc");
            dismissMenu();
          },
        },
        "separator",
        {
          name: t["Remove sorting"],
          onPress: () => {
            removeFromSort();
            dismissMenu();
          },
          disabled: !hasSort || !column.sort,
        },
        {
          name: t["Remove all sorting"],
          onPress: () => {
            removeAllSorting();
            dismissMenu();
          },
          disabled: !hasSort,
        },
      ],
    },
  ];

  return <GridMenu menuItems={menuItems} top={top} left={left} theme={theme} />;
};

export default ColumnMenu;
