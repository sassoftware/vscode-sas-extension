// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

const getIconForColumnType = (type: string) => {
  switch (type) {
    case "FLOAT":
      return "float";
    case "Date":
      return "date";
    case "Time":
      return "time";
    case "DateTime":
      return "date-time";
    case "Currency":
      return "currency";
    case "CHAR":
      return "char";
    default:
      return "";
  }
};

// Taken from https://www.ag-grid.com/javascript-data-grid/column-headers/#header-templates
const columnHeaderTemplate = (columnType: string) => `
<div class="ag-cell-label-container" role="presentation">
  <span ref="eMenu" class="ag-header-icon ag-header-cell-menu-button" aria-hidden="true"></span>
  <div ref="eLabel" class="ag-header-cell-label" role="presentation">
    <span class="header-icon ${getIconForColumnType(columnType)}"></span>
    <span ref="eText" class="ag-header-cell-text"></span>
    <span ref="eFilter" class="ag-header-icon ag-header-label-icon ag-filter-icon" aria-hidden="true"></span>
    <span ref="eSortOrder" class="ag-header-icon ag-header-label-icon ag-sort-order" aria-hidden="true"></span>
    <span ref="eSortAsc" class="ag-header-icon ag-header-label-icon ag-sort-ascending-icon" aria-hidden="true"></span>
    <span ref="eSortDesc" class="ag-header-icon ag-header-label-icon ag-sort-descending-icon" aria-hidden="true"></span>
    <span ref="eSortNone" class="ag-header-icon ag-header-label-icon ag-sort-none-icon" aria-hidden="true"></span>
  </div>
</div>
`;

export default columnHeaderTemplate;
