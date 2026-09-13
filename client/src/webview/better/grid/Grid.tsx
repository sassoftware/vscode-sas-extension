// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
//
// The main data grid. Wraps react-data-grid and adds:
//   - row-number gutter
//   - mssql-style multi-cell selection (click / shift-click / ctrl-click)
//   - Ctrl+C copy via the active selection
//   - scroll-driven prefetch through the data pump
//   - sort/filter via custom header cells
import { useCallback, useEffect, useMemo, useRef } from "react";
import DataGrid, {
  type CellClickArgs,
  type CellMouseEvent,
  type Column,
  type DataGridHandle,
} from "react-data-grid";

import { send } from "../messaging";
import { ensureRange } from "../pump";
import { useStore } from "../store";
import { CellView } from "./CellView";
import { HeaderCell } from "./HeaderCell";
import {
  buildCopyShortcutMessage,
  buildSelectAll,
  isCopyShortcut,
  isSelectAllShortcut,
  resolveCellClick,
  visibleRange,
} from "./gridHandlers";

interface Row {
  __index: number;
}

const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 36;
const ROWNO_KEY = "__rowno";

export function Grid() {
  const columns = useStore((s) => s.columns);
  const rowCount = useStore((s) => s.rowCount);
  const filters = useStore((s) => s.filters);
  const sort = useStore((s) => s.sort);
  const selection = useStore((s) => s.selection);
  const setSelection = useStore((s) => s.setSelection);
  const setAnchor = useStore((s) => s.setAnchor);
  const anchor = useStore((s) => s.selectionAnchor);
  const setCellDetail = useStore((s) => s.setCellDetail);
  const gridRef = useRef<DataGridHandle>(null);

  // react-data-grid needs a contiguous rows array to virtualise; we hand it
  // skeletons that carry only the absolute row index. CellView then reads
  // its own value from the store via a scalar selector — that way a page
  // arrival re-renders only the cells whose value actually changed instead
  // of rebuilding rowCount × columns dictionaries.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = new Array(rowCount);
    for (let i = 0; i < rowCount; i++) {
      out[i] = { __index: i };
    }
    return out;
  }, [rowCount]);

  const gridColumns = useMemo<Column<Row>[]>(() => {
    const cols: Column<Row>[] = [
      {
        key: ROWNO_KEY,
        name: "",
        width: 60,
        minWidth: 40,
        frozen: true,
        resizable: false,
        cellClass: "btv-rowno",
        renderCell: ({ row }) => row.__index + 1,
        renderHeaderCell: () => <span className="btv-rowno-header">#</span>,
      },
    ];
    columns.forEach((c, dataColIdx) => {
      cols.push({
        key: c.id,
        name: c.label || c.name,
        width: 140,
        resizable: true,
        sortable: false, // we own sort UX via the custom header
        cellClass: "btv-data-cell",
        renderHeaderCell: () => <HeaderCell column={c} />,
        renderCell: ({ row }) => (
          <CellView row={row.__index} col={dataColIdx} kind={c.kind} />
        ),
      });
    });
    return cols;
  }, [columns]);

  // Selection coordinates use *data* column indices (i.e. row-number col
  // is excluded). react-data-grid's column.idx counts the row-number col,
  // so we subtract one when translating to data-row coordinates. The
  // actual decision of WHICH selection rectangle to produce lives in
  // `resolveCellClick` so it can be unit-tested without rendering.
  const onCellClick = useCallback(
    (args: CellClickArgs<Row>, event: CellMouseEvent) => {
      const result = resolveCellClick({
        row: args.row.__index,
        col: args.column.idx - 1,
        isRowGutter: args.column.key === ROWNO_KEY,
        shift: event.shiftKey,
        ctrlOrMeta: event.ctrlKey || event.metaKey,
        columnCount: columns.length,
        selection,
        anchor,
      });
      setSelection(result.selection);
      setAnchor(result.anchor);
    },
    [anchor, columns.length, selection, setAnchor, setSelection],
  );

  const onCellDoubleClick = useCallback(
    (args: CellClickArgs<Row>) => {
      if (args.column.key === ROWNO_KEY) {
        return;
      }
      setCellDetail({
        row: args.row.__index,
        col: args.column.idx - 1,
      });
    },
    [setCellDetail],
  );

  // Scroll-driven prefetch. The geometry math lives in `visibleRange`
  // so it can be unit-tested independently of the scroll event shape.
  const onScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const el = event.currentTarget;
      const { from, to } = visibleRange(
        el.scrollTop,
        el.clientHeight,
        ROW_HEIGHT,
        rowCount,
      );
      ensureRange(from, to);
    },
    [rowCount],
  );

  // Trigger the initial fetch once we know the row count, and re-fetch
  // whenever a sort or filter change invalidates the cache. setSort /
  // setFilter clear `rows` and `requestedPages` and bump the generation,
  // but they don't issue a request themselves (the component owns I/O) —
  // without this, applying a filter would clear the table and never
  // repopulate it until the user scrolled.
  useEffect(() => {
    if (rowCount > 0) {
      ensureRange(0, Math.min(rowCount - 1, 200));
    }
  }, [filters, rowCount, sort]);

  // A sort/filter changes the whole row set, so snap the view back to the
  // top. Keyed on the query only (not rowCount), which also changes as
  // filtered responses stream in — we don't want to fight the user's scroll
  // every time a page arrives.
  useEffect(() => {
    const el = gridRef.current?.element;
    if (el) {
      el.scrollTop = 0;
    }
  }, [filters, sort]);

  // Ctrl/Cmd+C: copy the current selection in mssql's default format —
  // tab-separated cells with no headers (Shift adds the header row).
  // Ctrl/Cmd+A: select every cell.
  // Both shortcuts use pure helpers for the actual decision, so the
  // grid component is purely glue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isCopyShortcut(e)) {
        const sel = useStore.getState().selection;
        const cols = useStore.getState().columns;
        const map = useStore.getState().rows;
        const msg = buildCopyShortcutMessage({
          selection: sel,
          columns: cols,
          getCell: (r, c) => map.get(r)?.[c] ?? undefined,
          withHeaders: e.shiftKey,
        });
        if (msg) {
          send(msg);
          e.preventDefault();
        }
      } else if (isSelectAllShortcut(e)) {
        const sel = buildSelectAll(rowCount, columns.length);
        if (sel) {
          setSelection(sel);
          setAnchor({ row: 0, col: 0 });
          e.preventDefault();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [columns.length, rowCount, setAnchor, setSelection]);

  return (
    <div className="btv-grid">
      <DataGrid
        ref={gridRef}
        columns={gridColumns}
        rows={rows}
        rowKeyGetter={(row) => row.__index}
        rowHeight={ROW_HEIGHT}
        headerRowHeight={HEADER_HEIGHT}
        onCellClick={onCellClick}
        onCellDoubleClick={onCellDoubleClick}
        onScroll={onScroll}
        className="btv-rdg"
        defaultColumnOptions={{ resizable: true }}
      />
    </div>
  );
}
