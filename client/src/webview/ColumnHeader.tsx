import { useRef } from "react";

import { AgColumn, GridApi } from "ag-grid-community";

import { ColumnHeaderProps } from "./ColumnHeaderMenu";

const getIconForColumnType = (type: string) => {
  switch (type.toLocaleLowerCase()) {
    case "float":
    case "num":
      return "float";
    case "date":
      return "date";
    case "time":
      return "time";
    case "datetime":
      return "date-time";
    case "currency":
      return "currency";
    case "char":
      return "char";
    default:
      return "";
  }
};

const ColumnHeader = ({
  api,
  column,
  currentColumn: getCurrentColumn,
  columnType,
  setColumnMenu,
  theme,
}: {
  api: GridApi;
  column: AgColumn;
  currentColumn: () => AgColumn | undefined;
  columnType: string;
  setColumnMenu: (props: ColumnHeaderProps) => void;
  theme: string;
}) => {
  const ref = useRef<HTMLButtonElement>(undefined!);
  const currentColumn = getCurrentColumn();
  const currentSortedColumns = api.getColumnState().filter((c) => c.sort);
  const columnNumber = column.sort
    ? currentSortedColumns.length > 1
      ? currentSortedColumns.findIndex((c) => c.colId === column.colId) + 1
      : ""
    : "";

  const displayColumnMenu = () => {
    if (currentColumn) {
      return setColumnMenu(undefined);
    }
    const { height, top, left } = ref.current.getBoundingClientRect();
    setColumnMenu({
      left,
      top: top + height,
      column,
      theme,
      hasSort: api.getColumnState().some((c) => c.sort),
      sortColumn: (direction: "asc" | "desc" | null) => {
        const newColumnState = api.getColumnState().filter((c) => c.sort);
        const colIndex = newColumnState.findIndex(
          (c) => c.colId === column.colId,
        );
        if (colIndex === -1) {
          newColumnState.push({
            colId: column.colId,
            sort: direction,
          });
        } else {
          newColumnState[colIndex].sort = direction;
        }
        api.applyColumnState({
          state: newColumnState,
          defaultState: { sort: null },
        });
      },
      removeAllSorting: () =>
        api.applyColumnState({
          state: api
            .getColumnState()
            .filter((c) => c.sort)
            .map((c) => ({ colId: c.colId, sort: null })),
          defaultState: { sort: null },
        }),
      removeFromSort: () =>
        api.applyColumnState({
          state: api
            .getColumnState()
            .filter((c) => c.sort && c.colId !== column.colId),
          defaultState: { sort: null },
        }),
      dismissMenu: () => setColumnMenu(undefined),
    });
  };

  return (
    <div className={`ag-cell-label-container ${theme}`} role="presentation">
      <div
        data-ref="eLabel"
        className="ag-header-cell-label"
        role="presentation"
      >
        <span
          className={`header-icon ${getIconForColumnType(columnType)}`}
        ></span>
        <span className="ag-header-cell-text">{column.colId}</span>

        <span className="sort-icon-wrapper">
          {!!column.sort && (
            <>
              <span
                className={`sort-icon ${column.sort === "asc" ? "ascending" : "descending"}`}
              ></span>
              {!!columnNumber && (
                <span className="sort-number">{columnNumber}</span>
              )}
            </>
          )}
        </span>

        <div
          className={
            currentColumn?.colId === column.colId
              ? "active dropdown"
              : "dropdown"
          }
        >
          <button ref={ref} type="button" onClick={displayColumnMenu}>
            <span></span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnHeader;
