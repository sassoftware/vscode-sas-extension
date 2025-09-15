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
}: {
  api: GridApi;
  column: AgColumn;
  currentColumn: () => AgColumn | undefined;
  columnType: string;
  setColumnMenu: (props: ColumnHeaderProps) => void;
}) => {
  const ref = useRef<HTMLButtonElement>(undefined!);
  const currentColumn = getCurrentColumn();

  console.log({ currentColumn, column });
  return (
    <div className="ag-cell-label-container" role="presentation">
      <div
        data-ref="eLabel"
        className="ag-header-cell-label"
        role="presentation"
      >
        <span
          className={`header-icon ${getIconForColumnType(columnType)}`}
        ></span>
        <span className="ag-header-cell-text">{column.colId}</span>
        <span
          data-ref="eSortOrder"
          className="ag-header-icon ag-header-label-icon ag-sort-order"
          aria-hidden="true"
        ></span>
        {column.sort === "asc" && (
          <span className="ag-header-icon ag-header-label-icon ag-sort-ascending-icon"></span>
        )}
        {column.sort === "desc" && (
          <span className="ag-header-icon ag-header-label-icon ag-sort-descending-icon"></span>
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
              const { height, top, right } =
                ref.current.getBoundingClientRect();
              setColumnMenu({
                left: right,
                top: top + height,
                column,
                sortColumn: (direction: "asc" | "desc" | null) => {
                  api.applyColumnState({
                    state: [{ colId: column.colId, sort: direction }],
                    defaultState: { sort: null },
                  });
                  // console.log(props.api.getColumnState());
                  // props.api.applyColumnState({
                  //   state: [{}]
                  // })
                  // const currentSort = props.api.sort
                  // console.log(direction);
                  // console.log(props);
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
