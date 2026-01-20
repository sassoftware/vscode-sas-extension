import { useState } from "react";

import localize from "./localize";

interface TableFilterProps {
  onCommit: (value: string) => void;
  initialValue: string;
}

const TableFilter = ({ onCommit, initialValue }: TableFilterProps) => {
  const [filterValue, setFilterValue] = useState(initialValue);

  return (
    <div className="filter-wrapper">
      <div className="filter-input">
        <input
          type="text"
          title={localize("Enter expression")}
          placeholder={localize("Enter expression")}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          onKeyUp={(e) => {
            if (e.key === "Enter") {
              onCommit(filterValue);
            }
          }}
        />
        {filterValue ? (
          <button
            className="clear"
            title={localize("Clear")}
            type="button"
            onClick={() => {
              setFilterValue("");
              onCommit("");
            }}
          ></button>
        ) : undefined}
        <button
          className="search"
          title={localize("Search")}
          type="button"
          onClick={() => onCommit(filterValue)}
        ></button>
      </div>
    </div>
  );
};

export default TableFilter;
