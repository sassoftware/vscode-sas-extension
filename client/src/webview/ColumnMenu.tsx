// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { AgColumn, GridApi } from "ag-grid-community";
import { useEffect } from "react";

import GridMenu from "./GridMenu";
import localize from "./localize";
import { applyColumnState } from "./useDataViewer";
import useTheme from "./useTheme";

export interface ColumnMenuProps {
  column: AgColumn;
  dismissMenu: () => void;
  distinctValues?: (string | number | null)[];
  hasColumnFilter: boolean;
  hasSort: boolean;
  isDistinctValuesLoading: boolean;
  left: number;
  loadDistinctValues: () => void;
  loadColumnProperties: () => void;
  filterByDistinctValue: (value: string | number | null) => void;
  clearColumnFilter: () => void;
  removeAllSorting: () => void;
  removeFromSort: () => void;
  sortColumn: (direction: "asc" | "desc") => void;
  top: number;
}

export const getColumnMenu = (
  api: GridApi,
  column: AgColumn,
  { height, top, left }: DOMRect,
  dismissMenu: () => void,
  loadColumnProperties: (columnName: string) => void,
) => ({
  column,
  dismissMenu,
  hasSort: api.getColumnState().some((c) => c.sort),
  left,
  top: top + height,
  sortColumn: (direction: "asc" | "desc" | null) => {
    const newColumnState = api.getColumnState().filter((c) => c.sort);
    const colIndex = newColumnState.findIndex((c) => c.colId === column.colId);
    if (colIndex === -1) {
      newColumnState.push({
        colId: column.colId,
        sort: direction,
        sortIndex: newColumnState.length,
      });
    } else {
      newColumnState[colIndex] = {
        colId: newColumnState[colIndex].colId,
        sort: direction,
      };
    }
    applyColumnState(api, newColumnState);
  },
  removeAllSorting: () =>
    applyColumnState(
      api,
      api
        .getColumnState()
        .filter((c) => c.sort)
        .map((c) => ({ colId: c.colId, sort: null })),
    ),
  removeFromSort: () =>
    applyColumnState(
      api,
      api
        .getColumnState()
        .sort((a, b) => a.sortIndex - b.sortIndex)
        .filter((c) => c.sort && c.colId !== column.colId)
        // After we remove the column, lets reindex what's left
        .map((c, sortIndex) => ({ ...c, sortIndex })),
    ),
  loadColumnProperties: () => {
    loadColumnProperties(column.colId);
  },
});

const ColumnMenu = ({
  clearColumnFilter,
  column,
  dismissMenu,
  distinctValues,
  filterByDistinctValue,
  hasColumnFilter,
  hasSort,
  isDistinctValuesLoading,
  left,
  loadDistinctValues,
  loadColumnProperties,
  removeAllSorting,
  removeFromSort,
  sortColumn,
  top,
}: ColumnMenuProps) => {
  const theme = useTheme();
  const sort = column.getSort();
  useEffect(() => {
    if (!distinctValues && !isDistinctValuesLoading) {
      loadDistinctValues();
    }
  }, [distinctValues, isDistinctValuesLoading, loadDistinctValues]);

  const formatDistinctValue = (value: string | number | null) => {
    if (value === null) {
      return localize("(missing)");
    }
    if (value === "") {
      return localize("(blank)");
    }
    return `${value}`;
  };

  const filterChildren = isDistinctValuesLoading
    ? [
        {
          name: localize("Loading values..."),
          disabled: true,
        },
      ]
    : (distinctValues || []).length > 0
      ? [
          ...distinctValues.map((value) => ({
            name: formatDistinctValue(value),
            onPress: () => {
              filterByDistinctValue(value);
              dismissMenu();
            },
          })),
          "separator",
          {
            name: localize("Clear filter for this column"),
            disabled: !hasColumnFilter,
            onPress: () => {
              clearColumnFilter();
              dismissMenu();
            },
          },
        ]
      : [
          {
            name: localize("No values found"),
            disabled: true,
          },
          "separator",
          {
            name: localize("Clear filter for this column"),
            disabled: !hasColumnFilter,
            onPress: () => {
              clearColumnFilter();
              dismissMenu();
            },
          },
        ];

  const menuItems = [
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
      name: localize("Filter by values"),
      children: filterChildren,
    },
    "separator",
    {
      name: localize("Properties"),
      onPress: loadColumnProperties,
    },
  ];

  return <GridMenu menuItems={menuItems} top={top} left={left} theme={theme} />;
};

export default ColumnMenu;
