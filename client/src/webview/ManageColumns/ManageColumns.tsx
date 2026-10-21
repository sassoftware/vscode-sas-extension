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

type ColumnFilterProps = {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
};

const ColumnFilter = ({
  value,
  disabled,
  onChange,
  onClear,
}: ColumnFilterProps) => (
  <div className="filter-wrapper">
    <div className="filter-input">
      <input
        type="text"
        className="manage-column-filter-input"
        placeholder={localize("Filter")}
        aria-label={localize("Filter")}
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        className="search"
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        title={localize("Search")}
        type="button"
      />
      {value && (
        <button
          type="button"
          className="filter-clear"
          aria-label={localize("Clear")}
          title={localize("Clear")}
          onClick={onClear}
        >
          <span className="control-icon close" aria-hidden="true" />
        </button>
      )}
    </div>
  </div>
);

type ColumnPanelProps = ColumnFilterProps & {
  title: string;
  children: React.ReactNode;
};

const ColumnPanel = ({ title, children, ...filterProps }: ColumnPanelProps) => (
  <div className="columns-section-outer">
    <div className="section-header">
      <h3>{title}</h3>
    </div>
    <div className="columns-section">
      <ColumnFilter {...filterProps} />
      {children}
    </div>
  </div>
);

type ToolbarAction = {
  label: string;
  icon: string;
  disabled: boolean;
  onClick: () => void;
};

const ToolbarButton = ({ label, icon, disabled, onClick }: ToolbarAction) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
  >
    <span className={`control-icon ${icon}`} aria-hidden="true" />
  </button>
);

export const ManageColumns: React.FC<ManageColumnsProps> = ({
  columnState,
  onClose,
  onApply,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

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
    dialog.showModal();
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

  const hasHiddenSelection = tempColumnState.some(
    (column) => column.hide && isSelected(column),
  );

  const hasDisplayedSelection = tempColumnState.some(
    (column) => !column.hide && isSelected(column),
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
          nextItem?.scrollIntoView({ block: "nearest" });
        }}
      >
        {items.map((column, index) => (
          <div
            key={column.colId}
            id={`${prefix}-${index}`}
            role="option"
            tabIndex={index === activeIndex ? 0 : -1}
            onFocus={() => setActiveId(column.colId)}
            aria-selected={selectedItems.has(column.colId)}
            className={`column-item ${
              selectedItems.has(column.colId) ? "selected" : ""
            } ${index === activeIndex ? "keyboard-active" : ""}`}
            onClick={(event) => {
              setActiveId(column.colId);
              event.currentTarget.focus();
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

  const visibilityActions: ToolbarAction[] = [
    {
      label: localize("Undo"),
      icon: "undo",
      disabled: !hasChanges,
      onClick: reset,
    },
    {
      label: localize("Add"),
      icon: "add",
      disabled: !hasHiddenSelection,
      onClick: () =>
        applyStateChange(
          moveSelectedToDisplayed(tempColumnState, selectedItems),
        ),
    },
    {
      label: localize("Add all"),
      icon: "add-all",
      disabled: filteredHidden.length === 0,
      onClick: () =>
        applyStateChange(
          moveFilteredToDisplayed(tempColumnState, filteredHidden),
        ),
    },
    {
      label: localize("Remove"),
      icon: "remove",
      disabled: !hasDisplayedSelection,
      onClick: () =>
        applyStateChange(moveSelectedToHidden(tempColumnState, selectedItems)),
    },
    {
      label: localize("Remove all"),
      icon: "remove-all",
      disabled: filteredDisplayed.length === 0,
      onClick: () =>
        applyStateChange(
          moveFilteredToHidden(tempColumnState, filteredDisplayed),
        ),
    },
  ];

  const orderActions: ToolbarAction[] = [
    {
      label: localize("Move to the top"),
      icon: "up-end",
      disabled: !canMoveUp,
      onClick: () =>
        setTempColumnState(moveSelectedToTop(tempColumnState, selectedItems)),
    },
    {
      label: localize("Move up"),
      icon: "up",
      disabled: !canMoveUp,
      onClick: () =>
        setTempColumnState(moveSelectedUp(tempColumnState, selectedItems)),
    },
    {
      label: localize("Move down"),
      icon: "down",
      disabled: !canMoveDown,
      onClick: () =>
        setTempColumnState(moveSelectedDown(tempColumnState, selectedItems)),
    },
    {
      label: localize("Move to the bottom"),
      icon: "down-end",
      disabled: !canMoveDown,
      onClick: () =>
        setTempColumnState(
          moveSelectedToBottom(tempColumnState, selectedItems),
        ),
    },
  ];

  return (
    <dialog
      ref={dialogRef}
      className="manage-columns-dialog"
      aria-labelledby="manage-columns-title"
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
          aria-label={localize("Close")}
          title={localize("Close")}
          onClick={onClose}
        >
          <span className="control-icon close" aria-hidden="true" />
        </button>
      </div>

      <div className="dialog-content">
        <div ref={leftPanelRef} className="columns-panel">
          <ColumnPanel
            title={localize("Hidden columns ({count}):", {
              count: hiddenColumns.length.toString(),
            })}
            value={filterHidden}
            disabled={hiddenColumns.length === 0}
            onChange={(value) => {
              setFilterHidden(value);
              setSelectedItems(new Set());
            }}
            onClear={() => {
              setFilterHidden("");
              setHiddenActiveId(undefined);
              setSelectedItems(new Set());
            }}
          >
            {renderColumnList(filteredHidden, true)}
          </ColumnPanel>

          <div
            className="control-buttons"
            role="toolbar"
            aria-label={localize("Column visibility controls")}
            aria-orientation="vertical"
            onKeyDown={handleToolbarKeyDown}
          >
            {visibilityActions.map((action) => (
              <ToolbarButton key={action.icon} {...action} />
            ))}
          </div>
        </div>

        <div
          className="columns-resizer"
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
          <ColumnPanel
            title={localize("Displayed columns ({count}):", {
              count: displayedColumns.length.toString(),
            })}
            value={filterDisplayed}
            disabled={displayedColumns.length === 0}
            onChange={(value) => {
              setFilterDisplayed(value);
              setSelectedItems(new Set());
            }}
            onClear={() => {
              setFilterDisplayed("");
              setDisplayedActiveId(undefined);
              setSelectedItems(new Set());
            }}
          >
            {renderColumnList(filteredDisplayed, false)}
          </ColumnPanel>

          <div
            className="control-buttons"
            role="toolbar"
            aria-label={localize("Column order controls")}
            aria-orientation="vertical"
            onKeyDown={handleToolbarKeyDown}
          >
            {orderActions.map((action) => (
              <ToolbarButton key={action.icon} {...action} />
            ))}
          </div>
        </div>
      </div>

      <div className="dialog-footer">
        <button
          type="button"
          className="btn-ok"
          onClick={() => onApply(tempColumnState)}
          disabled={!hasChanges}
        >
          {localize("OK")}
        </button>

        <button type="button" className="btn-cancel" onClick={onClose}>
          {localize("Cancel")}
        </button>
      </div>
    </dialog>
  );
};

export default ManageColumns;
