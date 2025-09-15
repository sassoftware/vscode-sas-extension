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
        {column.sort === "asc" && (
          <span className="sort-icon-wrapper">
            <span className="sort-icon ascending"></span>
          </span>
        )}
        {column.sort === "desc" && (
          <span className="sort-icon-wrapper">
            <span className="sort-icon descending"></span>
          </span>
        )}
        <div className="dropdown">
          <button
            ref={ref}
            type="button"
            className={currentColumn?.colId === column.colId ? "active" : ""}
            onClick={() => {
              if (currentColumn) {
                return setColumnMenu(undefined);
              }
              const { height, top, left } = ref.current.getBoundingClientRect();
              setColumnMenu({
                left,
                top: top + height,
                column,
                theme,
                sortColumn: (direction: "asc" | "desc" | null) => {
                  api.applyColumnState({
                    state: [{ colId: column.colId, sort: direction }],
                    defaultState: { sort: null },
                  });
                },
                dismissMenu: () => setColumnMenu(undefined),
              });
            }}
          >
            <span></span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnHeader;
