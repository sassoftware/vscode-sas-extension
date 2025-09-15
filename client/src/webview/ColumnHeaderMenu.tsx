import { AgColumn } from "ag-grid-community";

export interface ColumnHeaderProps {
  left: number;
  top: number;
  column: AgColumn;
  sortColumn: (direction: "asc" | "desc") => void;
  dismissMenu: () => void;
}

const ColumnHeaderMenu = ({
  left,
  top,
  column,
  sortColumn,
  dismissMenu,
}: ColumnHeaderProps) => {
  return (
    <div className="header-menu" style={{ left, top }}>
      <ul>
        <li>
          <span>Sort</span>
          <ul>
            <li>
              {column.sort === "asc" && <span>✓ </span>}
              <button
                type="button"
                onClick={() => {
                  sortColumn(column.sort === "asc" ? null : "asc");
                  dismissMenu();
                }}
              >
                Ascending
              </button>
            </li>
            <li>
              {column.sort === "desc" && <span>✓ </span>}
              <button
                type="button"
                onClick={() => {
                  sortColumn(column.sort === "desc" ? null : "desc");
                  dismissMenu();
                }}
              >
                Descending
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  );
};

export default ColumnHeaderMenu;
