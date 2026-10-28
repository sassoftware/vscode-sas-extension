// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { ColumnState } from "ag-grid-community";

export const getColumnId = (column: ColumnState): string => column.colId ?? "";

export const getManageableColumns = (
  columnState: ColumnState[],
): ColumnState[] => columnState.filter((column) => column.colId !== "#");

export const splitColumns = (
  columnState: ColumnState[],
): {
  displayedColumns: ColumnState[];
  hiddenColumns: ColumnState[];
} => {
  const displayedColumns: ColumnState[] = [];
  const hiddenColumns: ColumnState[] = [];

  columnState.forEach((column) => {
    if (column.hide) {
      hiddenColumns.push(column);
    } else {
      displayedColumns.push(column);
    }
  });

  return {
    displayedColumns,
    hiddenColumns,
  };
};

export const filterColumns = (
  columns: ColumnState[],
  filter: string,
): ColumnState[] => {
  const normalizedFilter = filter.toLowerCase();

  return columns.filter((column) =>
    getColumnId(column).toLowerCase().includes(normalizedFilter),
  );
};

export const isColumnStateSame = (
  current: ColumnState[],
  original: ColumnState[],
): boolean =>
  JSON.stringify(current) === JSON.stringify(getManageableColumns(original));

export const moveSelectedToDisplayed = (
  columnState: ColumnState[],
  selectedItems: Set<string>,
): ColumnState[] => {
  const displayed = columnState.filter((column) => !column.hide);

  const selectedHidden = columnState
    .filter((column) => column.hide && selectedItems.has(getColumnId(column)))
    .map((column) => ({
      ...column,
      hide: false,
    }));

  const remainingHidden = columnState.filter(
    (column) => column.hide && !selectedItems.has(getColumnId(column)),
  );

  return [...displayed, ...selectedHidden, ...remainingHidden];
};

export const moveFilteredToDisplayed = (
  columnState: ColumnState[],
  filteredHidden: ColumnState[],
): ColumnState[] => {
  const matchingIds = new Set(
    filteredHidden.map((column) => getColumnId(column)),
  );

  const displayed = columnState.filter((column) => !column.hide);

  const moved = columnState
    .filter((column) => column.hide && matchingIds.has(getColumnId(column)))
    .map((column) => ({
      ...column,
      hide: false,
    }));

  const remainingHidden = columnState.filter(
    (column) => column.hide && !matchingIds.has(getColumnId(column)),
  );

  return [...displayed, ...moved, ...remainingHidden];
};

export const moveSelectedToHidden = (
  columnState: ColumnState[],
  selectedItems: Set<string>,
): ColumnState[] =>
  columnState.map((column) =>
    selectedItems.has(getColumnId(column))
      ? {
          ...column,
          hide: true,
        }
      : column,
  );

export const moveFilteredToHidden = (
  columnState: ColumnState[],
  filteredDisplayed: ColumnState[],
): ColumnState[] => {
  const matchingIds = new Set(
    filteredDisplayed.map((column) => getColumnId(column)),
  );

  return columnState.map((column) =>
    !column.hide && matchingIds.has(getColumnId(column))
      ? {
          ...column,
          hide: true,
        }
      : column,
  );
};

export const moveSelectedToTop = (
  columnState: ColumnState[],
  selectedItems: Set<string>,
): ColumnState[] => {
  const displayed = columnState.filter((column) => !column.hide);
  const hidden = columnState.filter((column) => column.hide);

  const selected = displayed.filter((column) =>
    selectedItems.has(getColumnId(column)),
  );

  const unselected = displayed.filter(
    (column) => !selectedItems.has(getColumnId(column)),
  );

  return [...selected, ...unselected, ...hidden];
};

export const moveSelectedUp = (
  columnState: ColumnState[],
  selectedItems: Set<string>,
): ColumnState[] => {
  const displayed = columnState.filter((column) => !column.hide);
  const hidden = columnState.filter((column) => column.hide);

  for (let index = 1; index < displayed.length; index++) {
    const current = displayed[index];

    if (
      selectedItems.has(getColumnId(current)) &&
      !selectedItems.has(getColumnId(displayed[index - 1]))
    ) {
      [displayed[index - 1], displayed[index]] = [
        displayed[index],
        displayed[index - 1],
      ];
    }
  }

  return [...displayed, ...hidden];
};

export const moveSelectedDown = (
  columnState: ColumnState[],
  selectedItems: Set<string>,
): ColumnState[] => {
  const displayed = columnState.filter((column) => !column.hide);
  const hidden = columnState.filter((column) => column.hide);

  for (let index = displayed.length - 2; index >= 0; index--) {
    const current = displayed[index];

    if (
      selectedItems.has(getColumnId(current)) &&
      !selectedItems.has(getColumnId(displayed[index + 1]))
    ) {
      [displayed[index], displayed[index + 1]] = [
        displayed[index + 1],
        displayed[index],
      ];
    }
  }

  return [...displayed, ...hidden];
};

export const moveSelectedToBottom = (
  columnState: ColumnState[],
  selectedItems: Set<string>,
): ColumnState[] => {
  const displayed = columnState.filter((column) => !column.hide);
  const hidden = columnState.filter((column) => column.hide);

  const selected = displayed.filter((column) =>
    selectedItems.has(getColumnId(column)),
  );

  const unselected = displayed.filter(
    (column) => !selectedItems.has(getColumnId(column)),
  );

  return [...unselected, ...selected, ...hidden];
};
