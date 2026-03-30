# AG Grid implementation details

This summarizes how ag grid functionality is being used in this code base.

## Column headers / context menus

- This repository defines custom column headers using the `headerComponent` property from `ColDef`. See [useDataViewer.ts](../client/src/webview/useDataViewer.ts) for implementation details, and [column header documentation](https://www.ag-grid.com/javascript-data-grid/column-properties/#reference-header-headerComponent) from AG Grid.
- Context menus are not supported in the community edition of AG Grid. To implement this functionality, we use custom html as part of the `headerComponent` and keep track of ui interactions with `keydown` listeners and various click events.
- Context menu actions (sort, etc) make use of AG Grid column state to update the underlying table data. For AG grid data changes, our internal code calls [`applyColumnState`](https://www.ag-grid.com/javascript-data-grid/column-state/#reference-state-applyColumnState)
- The html used for the context menu roughly matches what is found on the [AG Grid's example page](https://ag-grid.com/example/)

## Data filtering

The SAS extension currently supports a where style filter for filtering table data. This sets a filter property and updates AG Grids datasource to fetch table data based on the filter value. The implementation can be found in the `refreshResults` callback in See [useDataViewer.ts](../client/src/webview/useDataViewer.ts).

This makes use of AG Grid's [`setGridOption`](https://www.ag-grid.com/javascript-data-grid/grid-api/#reference-gridOptions-setGridOption)
