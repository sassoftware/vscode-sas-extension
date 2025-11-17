// Copyright © 2025, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useRef } from "react";

import { AgColumn, GridApi } from "ag-grid-community";

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
  theme,
  displayMenuForColumn,
}: {
  api: GridApi;
  column: AgColumn;
  currentColumn: () => AgColumn | undefined;
  columnType: string;
  theme: string;
  displayMenuForColumn: (api: GridApi, column: AgColumn, rect: DOMRect) => void;
}) => {
  const ref = useRef<HTMLButtonElement>(undefined!);
  const currentColumn = getCurrentColumn();
  const currentSortedColumns = api.getColumnState().filter((c) => c.sort);
  const columnNumber =
    column.sort && currentSortedColumns.length > 1
      ? `${column.sortIndex + 1}`
      : "";
  const dropdownClassname =
    currentColumn?.colId === column.colId ? "active dropdown" : "dropdown";

  const displayColumnMenu = () =>
    displayMenuForColumn(api, column, ref.current.getBoundingClientRect());

  return (
    <div className={`ag-cell-label-container ${theme}`} role="presentation">
      <div className="ag-header-cell-label" role="presentation">
        <span className={`header-icon ${getIconForColumnType(columnType)}`} />
        <span className="ag-header-cell-text">{column.colId}</span>
        <span className="sort-icon-wrapper">
          {!!column.sort && (
            <>
              <span className={`icon ${column.sort}`}></span>
              {!!columnNumber && <span className="number">{columnNumber}</span>}
            </>
          )}
        </span>
        <div className={dropdownClassname}>
          <button
            ref={ref}
            type="button"
            onClick={displayColumnMenu}
            tabIndex={-1}
          >
            <span />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColumnHeader;
