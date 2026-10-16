// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React, { useEffect, useMemo, useRef, useState } from "react";

import type { ColumnState } from "ag-grid-community";

import localize from "../localize";
import {
  filterColumns,
  getColumnId,
  getManageableColumns,
  isColumnStateSame,
  moveFilteredToDisplayed,
  moveFilteredToHidden,
  moveSelectedDown,
  moveSelectedToBottom,
  moveSelectedToDisplayed,
  moveSelectedToHidden,
  moveSelectedToTop,
  moveSelectedUp,
  splitColumns,
} from "./columnStateUtils";
import useColumnPanelResize from "./useColumnPanelResize";
import useDraggableDialog from "./useDraggableDialog";
import useResponsiveDialog from "./useResponsiveDialog";

import "./ManageColumns.css";

export interface ManageColumnsProps {
  columnState: ColumnState[];
  onClose: () => void;
  onApply: (updateColumnState: ColumnState[]) => void;
}

export const ManageColumns: React.FC<ManageColumnsProps> = ({
  columnState,
  onClose,
  onApply,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const initialHiddenVisit = useRef(true);

  const [hiddenActiveId, setHiddenActiveId] = useState<string>();
  const [displayedActiveId, setDisplayedActiveId] = useState<string>();

  const [tempColumnState, setTempColumnState] = useState<ColumnState[]>(() =>
    getManageableColumns(columnState),
  );

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [filterHidden, setFilterHidden] = useState("");
  const [filterDisplayed, setFilterDisplayed] = useState("");

  useResponsiveDialog({
    dialogRef,
    containerSelector: ".data-viewer",
    defaultWidthRatio: 0.6,
    defaultHeightRatio: 0.7,
    minWidth: 500,
    minHeight: 350,
  });

  const { handleDragStart, handleDrag, handleDragEnd } = useDraggableDialog({
    dialogRef,
    containerSelector: ".data-viewer",
  });

  const {
    leftPanelRef,
    rightPanelRef,
    handleResizeStart,
    handleResize,
    handleResizeEnd,
    handleResizeKeyDown,
  } = useColumnPanelResize();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const previousFocus = document.activeElement;

    initialHiddenVisit.current = true;

    dialog.showModal();

    // Keep background inert, but defer visible list focus until the first Tab.
    titleRef.current?.focus();

    return () => {
      dialog.close();

      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  const { displayedColumns, hiddenColumns } = useMemo(
    () => splitColumns(tempColumnState),
    [tempColumnState],
  );

  const filteredHidden = useMemo(
    () => filterColumns(hiddenColumns, filterHidden),
    [hiddenColumns, filterHidden],
  );

  const filteredDisplayed = useMemo(
    () => filterColumns(displayedColumns, filterDisplayed),
    [displayedColumns, filterDisplayed],
  );

  const isSelected = (column: ColumnState) =>
    selectedItems.has(getColumnId(column));

  const hiddenSelected = tempColumnState.filter(
    (column) => column.hide && selectedItems.has(getColumnId(column)),
  );

  const displayedSelected = tempColumnState.filter(
    (column) => !column.hide && selectedItems.has(getColumnId(column)),
  );

  const selectedDisplayedIndices = displayedColumns
    .map((column, index) => (isSelected(column) ? index : -1))
    .filter((index) => index !== -1);

  const canMoveUp =
    selectedDisplayedIndices.length > 0 && selectedDisplayedIndices[0] > 0;

  const canMoveDown =
    selectedDisplayedIndices.length > 0 &&
    selectedDisplayedIndices[selectedDisplayedIndices.length - 1] <
      displayedColumns.length - 1;

  const hasChanges = !isColumnStateSame(tempColumnState, columnState);

  const focusNavigationStop = (element: HTMLElement) => {
    const target =
      element.getAttribute("role") === "toolbar"
        ? element.querySelector<HTMLButtonElement>("button:not(:disabled)")
        : element;

    target?.focus();
  };

  const handleToolbarKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ),
    );

    if (!buttons.length) {
      return;
    }

    const index = buttons.findIndex(
      (button) => button === document.activeElement,
    );

    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) %
            buttons.length;

    buttons[next].focus();
  };

  const handleDialogKeyDown = (
    event: React.KeyboardEvent<HTMLDialogElement>,
  ) => {
    event.stopPropagation();

    if (event.key !== "Tab") {
      return;
    }

    event.preventDefault();

    const stops = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[data-nav]"),
    )
      .filter(
        (element) =>
          !element.matches(":disabled") &&
          element.getClientRects().length > 0 &&
          (element.getAttribute("role") !== "toolbar" ||
            element.querySelector("button:not(:disabled)")),
      )
      .sort((a, b) => Number(a.dataset.nav) - Number(b.dataset.nav));

    if (!stops.length) {
      return;
    }

    const active = document.activeElement;

    if (active === titleRef.current) {
      const target = event.shiftKey
        ? stops[stops.length - 1]
        : (stops.find((element) => element.dataset.nav === "10") ?? stops[0]);

      focusNavigationStop(target);
      return;
    }

    const index = stops.findIndex(
      (element) => element === active || element.contains(active),
    );

    if (initialHiddenVisit.current && stops[index]?.dataset.nav === "10") {
      initialHiddenVisit.current = false;

      const filter = stops.find((element) => element.dataset.nav === "0");

      if (!event.shiftKey && filter) {
        focusNavigationStop(filter);
        return;
      }
    }

    initialHiddenVisit.current = false;

    const nextIndex =
      index < 0
        ? event.shiftKey
          ? stops.length - 1
          : 0
        : (index + (event.shiftKey ? -1 : 1) + stops.length) % stops.length;

    focusNavigationStop(stops[nextIndex]);
  };

  const toggleSelection = (
    name: string,
    event: React.MouseEvent | React.KeyboardEvent,
  ) => {
    const newSelected = new Set(
      event.metaKey || event.ctrlKey ? selectedItems : [],
    );

    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }

    setSelectedItems(newSelected);
  };

  const renderColumnList = (items: ColumnState[], hidden: boolean) => {
    const prefix = hidden ? "hidden-column" : "displayed-column";

    const rememberedId = hidden ? hiddenActiveId : displayedActiveId;

    const activeIndex = Math.max(
      0,
      items.findIndex((column) => column.colId === rememberedId),
    );

    const setActiveId = hidden ? setHiddenActiveId : setDisplayedActiveId;

    const nav = hidden ? "10" : "50";

    const label = hidden
      ? localize("Hidden columns")
      : localize("Displayed columns");

    if (!items.length) {
      return (
        <div className="columns-list">
          <div className="empty-state">
            <span
              className="empty-state-text"
              tabIndex={0}
              data-nav={nav}
              aria-label={`${label}: ${localize("No items are available.")}`}
            >
              {localize("No items are available.")}
            </span>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`columns-list ${hidden ? "" : "displayed-columns-list"}`}
        role="listbox"
        aria-label={label}
        aria-multiselectable="true"
        onKeyDown={(event) => {
          let next = activeIndex;

          if (event.key === "ArrowDown") {
            next = Math.min(items.length - 1, activeIndex + 1);
          } else if (event.key === "ArrowUp") {
            next = Math.max(0, activeIndex - 1);
          } else if (event.key === "Home") {
            next = 0;
          } else if (event.key === "End") {
            next = items.length - 1;
          } else if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            toggleSelection(items[activeIndex].colId, event);
            return;
          } else {
            return;
          }

          event.preventDefault();

          setActiveId(items[next].colId);

          const nextItem = document.getElementById(`${prefix}-${next}`);

          nextItem?.focus();
          nextItem?.scrollIntoView({
            block: "nearest",
          });
        }}
      >
        {items.map((column, index) => (
          <div
            key={column.colId}
            id={`${prefix}-${index}`}
            role="option"
            tabIndex={index === activeIndex ? 0 : -1}
            data-nav={index === activeIndex ? nav : undefined}
            onFocus={() => setActiveId(column.colId)}
            aria-selected={selectedItems.has(column.colId)}
            className={`column-item ${
              selectedItems.has(column.colId) ? "selected" : ""
            } ${index === activeIndex ? "keyboard-active" : ""}`}
            onClick={(event) => {
              setActiveId(column.colId);
              event.currentTarget.focus();

              initialHiddenVisit.current = false;

              toggleSelection(column.colId, event);
            }}
          >
            {column.colId}
          </div>
        ))}
      </div>
    );
  };

  const reset = () => {
    setTempColumnState(getManageableColumns(columnState));
    setSelectedItems(new Set());
  };

  const applyStateChange = (state: ColumnState[]) => {
    setTempColumnState(state);
    setSelectedItems(new Set());
  };

  return (
    <dialog
      ref={dialogRef}
      className="manage-columns-dialog"
      aria-labelledby="manage-columns-title"
      onKeyDown={handleDialogKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="dialog-header"
        onPointerDown={handleDragStart}
        onPointerMove={handleDrag}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
      >
        <h2
          ref={titleRef}
          id="manage-columns-title"
          tabIndex={-1}
          style={{ outline: "none" }}
        >
          {localize("Manage Columns")}
        </h2>

        <button
          type="button"
          className="dialog-close-btn"
          data-nav="100"
          aria-label={localize("Close")}
          title={localize("Close")}
          onClick={onClose}
        >
          <span className="control-icon close" aria-hidden="true" />
        </button>
      </div>

      <div className="dialog-content">
        <div ref={leftPanelRef} className="columns-panel">
          <div className="columns-section-outer">
            <div className="section-header">
              <h3>
                {localize("Hidden columns ({count}):", {
                  count: hiddenColumns.length.toString(),
                })}
              </h3>
            </div>

            <div className="columns-section">
              <div className="filter-wrapper">
                <div className="filter-input">
                  <input
                    type="text"
                    className="manage-column-filter-input"
                    data-nav="0"
                    placeholder={localize("Filter")}
                    aria-label={localize("Filter")}
                    disabled={hiddenColumns.length === 0}
                    value={filterHidden}
                    onChange={(event) => setFilterHidden(event.target.value)}
                  />

                  <button
                    className="search"
                    disabled={hiddenColumns.length === 0}
                    tabIndex={-1}
                    aria-hidden="true"
                    title={localize("Search")}
                    type="button"
                  />

                  {filterHidden && (
                    <button
                      type="button"
                      className="filter-clear"
                      aria-label={localize("Clear")}
                      title={localize("Clear")}
                      onClick={() => {
                        setFilterHidden("");
                        setHiddenActiveId(undefined);
                      }}
                    >
                      <span className="control-icon close" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {renderColumnList(filteredHidden, true)}
            </div>
          </div>

          <div
            className="control-buttons"
            role="toolbar"
            aria-label={localize("Column visibility controls")}
            aria-orientation="vertical"
            data-nav="20"
            onKeyDown={handleToolbarKeyDown}
          >
            <button
              type="button"
              tabIndex={-1}
              title={localize("Undo")}
              aria-label={localize("Undo")}
              disabled={!hasChanges}
              onClick={reset}
            >
              <span className="control-icon undo" aria-hidden="true" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              title={localize("Add")}
              aria-label={localize("Add")}
              disabled={hiddenSelected.length === 0}
              onClick={() =>
                applyStateChange(
                  moveSelectedToDisplayed(tempColumnState, selectedItems),
                )
              }
            >
              <span className="control-icon add" aria-hidden="true" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              title={localize("Add all")}
              aria-label={localize("Add all")}
              disabled={filteredHidden.length === 0}
              onClick={() =>
                applyStateChange(
                  moveFilteredToDisplayed(tempColumnState, filteredHidden),
                )
              }
            >
              <span className="control-icon add-all" aria-hidden="true" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              title={localize("Remove")}
              aria-label={localize("Remove")}
              disabled={displayedSelected.length === 0}
              onClick={() =>
                applyStateChange(
                  moveSelectedToHidden(tempColumnState, selectedItems),
                )
              }
            >
              <span className="control-icon remove" aria-hidden="true" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              title={localize("Remove all")}
              aria-label={localize("Remove all")}
              disabled={filteredDisplayed.length === 0}
              onClick={() =>
                applyStateChange(
                  moveFilteredToHidden(tempColumnState, filteredDisplayed),
                )
              }
            >
              <span className="control-icon remove-all" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className="columns-resizer"
          data-nav="40"
          onPointerDown={handleResizeStart}
          onPointerMove={handleResize}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          role="separator"
          aria-orientation="vertical"
          aria-label={localize("Resize column panels")}
          tabIndex={0}
          onKeyDown={handleResizeKeyDown}
        />

        <div ref={rightPanelRef} className="columns-panel">
          <div className="columns-section-outer">
            <div className="section-header">
              <h3>
                {localize("Displayed columns ({count}):", {
                  count: displayedColumns.length.toString(),
                })}
              </h3>
            </div>

            <div className="columns-section">
              <div className="filter-wrapper">
                <div className="filter-input">
                  <input
                    type="text"
                    className="manage-column-filter-input"
                    placeholder={localize("Filter")}
                    aria-label={localize("Filter")}
                    disabled={displayedColumns.length === 0}
                    value={filterDisplayed}
                    onChange={(event) => setFilterDisplayed(event.target.value)}
                  />

                  <button
                    className="search"
                    disabled={displayedColumns.length === 0}
                    tabIndex={-1}
                    aria-hidden="true"
                    title={localize("Search")}
                    type="button"
                  />

                  {filterDisplayed && (
                    <button
                      type="button"
                      className="filter-clear"
                      aria-label={localize("Clear")}
                      title={localize("Clear")}
                      onClick={() => {
                        setFilterDisplayed("");
                        setDisplayedActiveId(undefined);
                      }}
                    >
                      <span className="control-icon close" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {renderColumnList(filteredDisplayed, false)}
            </div>
          </div>

          <div
            className="control-buttons"
            role="toolbar"
            aria-label={localize("Column order controls")}
            aria-orientation="vertical"
            data-nav="60"
            onKeyDown={handleToolbarKeyDown}
          >
            <button
              type="button"
              tabIndex={-1}
              title={localize("Move to the top")}
              aria-label={localize("Move to the top")}
              disabled={!canMoveUp}
              onClick={() =>
                setTempColumnState(
                  moveSelectedToTop(tempColumnState, selectedItems),
                )
              }
            >
              <span className="control-icon up-end" aria-hidden="true" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              title={localize("Move up")}
              aria-label={localize("Move up")}
              disabled={!canMoveUp}
              onClick={() =>
                setTempColumnState(
                  moveSelectedUp(tempColumnState, selectedItems),
                )
              }
            >
              <span className="control-icon up" aria-hidden="true" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              title={localize("Move down")}
              aria-label={localize("Move down")}
              disabled={!canMoveDown}
              onClick={() =>
                setTempColumnState(
                  moveSelectedDown(tempColumnState, selectedItems),
                )
              }
            >
              <span className="control-icon down" aria-hidden="true" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              title={localize("Move to the bottom")}
              aria-label={localize("Move to the bottom")}
              disabled={!canMoveDown}
              onClick={() =>
                setTempColumnState(
                  moveSelectedToBottom(tempColumnState, selectedItems),
                )
              }
            >
              <span className="control-icon down-end" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="dialog-footer">
        <button
          type="button"
          className="btn-ok"
          data-nav="80"
          onClick={() => onApply(tempColumnState)}
          disabled={!hasChanges}
        >
          {localize("OK")}
        </button>

        <button
          type="button"
          className="btn-cancel"
          data-nav="90"
          onClick={onClose}
        >
          {localize("Cancel")}
        </button>
      </div>
    </dialog>
  );
};

export default ManageColumns;
