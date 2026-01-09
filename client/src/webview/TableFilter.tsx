import { useState } from "react";

const TableFilter = ({ onCommit }: { onCommit: (value: string) => void }) => {
  const [filterValue, setFilterValue] = useState("");

  return (
    <div className="filter-wrapper">
      <div className="filter-input">
        <input
          type="text"
          placeholder="Enter expression"
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
            title="Clear"
            type="button"
            onClick={() => {
              setFilterValue("");
              onCommit("");
            }}
          ></button>
        ) : undefined}
        <button
          className="search"
          title="Search"
          type="button"
          onClick={() => onCommit(filterValue)}
        ></button>
      </div>
    </div>
  );
};

export default TableFilter;
