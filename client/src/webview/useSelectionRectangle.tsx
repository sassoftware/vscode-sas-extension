// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { HTMLAttributes, useRef } from "react";

import { IRowNode } from "ag-grid-community";

import { stringArrayToCsvString } from "../components/utils/csv";
import localize from "./localize";
import vscode from "./vscode";

let scrollDownInterval: ReturnType<typeof setInterval>;
let scrollUpInterval: ReturnType<typeof setInterval>;
const div = (el: HTMLDivElement | HTMLUnknownElement | EventTarget | null) =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  el as HTMLDivElement;

type Point = { x: number; y: number };
type Target = HTMLDivElement;
type SelectedItem = { row: number; column: number };
type CellInRow = { colId: string; index: number; rect: DOMRect };
type Selection = {
  start?: Point;
  end?: Point;
  firstItemSelected?: SelectedItem;
  lastItemSelected?: SelectedItem;
  cellsInRow: CellInRow[];
};

export const useSelectionRectangle = ({
  enabled,
  scrollContainer,
  scrollViewport,
  getRowData,
  onSelectionStarted,
  onSelectionEnded,
}: {
  enabled: boolean;
  scrollContainer: string;
  scrollViewport: string;
  getRowData: (rowIndex: string) => IRowNode | undefined;
  onSelectionStarted: () => void;
  onSelectionEnded: () => void;
}) => {
  const rectangleRef = useRef<HTMLDivElement>(undefined!);

  const selectionRef = useRef<Selection>({
    start: undefined,
    end: undefined,
    firstItemSelected: undefined,
    lastItemSelected: undefined,
    cellsInRow: [],
  });
  const selection = selectionRef.current;

  const getScrollBoundaries = () => {
    const gridRoot = document
      .querySelector(scrollViewport)!
      .getBoundingClientRect();
    return {
      top: gridRoot.top + 15,
      bottom: gridRoot.bottom - 15,
      left: gridRoot.left + 15,
      right: gridRoot.right - 15,
    };
  };

  const mouseSelectionEnabled = useRef<boolean>(false);
  const mouseHasMoved = useRef<boolean>(false);

  const drawRectangle = () => {
    if (!selection.start || !selection.end) {
      return;
    }
    const { x, y } = selection.end;
    const { x: xi, y: yi } = selection.start;

    const topLeftX = x < xi ? x : xi;
    const topLeftY = y < yi ? y : yi;
    const bottomRightX = x > xi ? x : xi;
    const bottomRightY = y > yi ? y : yi;

    rectangleRef.current.classList.add("active");
    rectangleRef.current.style.display = "block";
    rectangleRef.current.style.left = `${topLeftX}px`;
    rectangleRef.current.style.top = `${topLeftY}px`;
    rectangleRef.current.style.width = `${bottomRightX - topLeftX}px`;
    rectangleRef.current.style.height = `${bottomRightY - topLeftY}px`;
  };

  const stopScrolling = (timeout: ReturnType<typeof setInterval>) =>
    clearInterval(timeout);

  const resetStyles = () => {
    onSelectionEnded();
    stopScrolling(scrollDownInterval);
    stopScrolling(scrollUpInterval);
    if (rectangleRef.current) {
      rectangleRef.current.style.display = "none";
    }
  };

  const copySelection = () => {
    // Clipboard needs to be available before we can copy text.
    if (!navigator.clipboard) {
      displayClipboardError();
      return;
    }

    const rectangleRect = rectangleRef.current.getBoundingClientRect();

    // 1. Get column headers for selection
    const cellNames = selection.cellsInRow
      .filter((cell) => intersects(rectangleRect, cell.rect))
      .map((cell) => cell.colId);
    const csvLines = [stringArrayToCsvString(cellNames)];

    // 2. Find the first and last row index in selection
    const firstRowIndex = Math.min(
      selection.firstItemSelected!.row,
      selection.lastItemSelected!.row,
    );
    const lastRowIndex = Math.max(
      selection.firstItemSelected!.row,
      selection.lastItemSelected!.row,
    );
    if (
      lastRowIndex === -1 ||
      firstRowIndex === -1 ||
      lastRowIndex < firstRowIndex
    ) {
      displayClipboardError();
    }

    // 3. Extract relevant row data
    for (let i = firstRowIndex; i <= lastRowIndex; ++i) {
      csvLines.push(extractDataFromRow(i, cellNames));
    }

    // 4. Copy data to clipboard
    const csvText = csvLines.join("\n");
    navigator.clipboard.writeText(csvText);

    function displayClipboardError() {
      vscode.postMessage({
        command: "displayError",
        data: {
          error: localize("An error was encountered when copying data."),
        },
      });
    }

    function extractDataFromRow(rowIndex: number, cellNames: string[]) {
      const row = getRowData(`${rowIndex}`)!;
      const strings = cellNames.map((cellName) => row.data[cellName]);
      return stringArrayToCsvString(strings);
    }

    function intersects(rect1: DOMRect, rect2: DOMRect) {
      return !(
        rect1.right < rect2.left ||
        rect1.left > rect2.right ||
        rect1.bottom < rect2.top ||
        rect1.top > rect2.bottom
      );
    }
  };

  const handleKeyboardBasedRectangularSelection = (event: KeyboardEvent) => {
    const targetRect = div(event.target).getBoundingClientRect();

    if (
      !rectangleRef.current ||
      rectangleRef.current.style.display !== "block"
    ) {
      mouseHasMoved.current = false;
      mouseSelectionEnabled.current = false;

      // Lets initialize our rectangle
      handleSelectionUpdate(div(event.target));
      selection.start = relativePoint({ x: targetRect.x + 2, y: targetRect.y });
      selection.end = relativePoint({
        x: targetRect.x + targetRect.width - 2,
        y: targetRect.y + targetRect.height,
      });

      initRectangularSelection(div(event.target));
    } else if (rectangleRef.current) {
      const rectangleRect = rectangleRef.current.getBoundingClientRect();
      const xShift =
        event.key === "ArrowRight" ? 25 : event.key === "ArrowLeft" ? -25 : 0;
      const yShift =
        event.key === "ArrowDown" ? 25 : event.key === "ArrowUp" ? -25 : 0;
      const viewportRect = document
        .querySelector(scrollViewport)!
        .getBoundingClientRect();
      selection.end = relativePoint({
        // Keep the corner inside the viewport. It looks like the width needs to be adjusted by
        // 2 due to the 2px border, although this could be a red herring.
        x: Math.max(
          viewportRect.left,
          Math.min(
            rectangleRect.x + rectangleRect.width - 2 + xShift,
            viewportRect.right - 2,
          ),
        ),
        y: Math.max(
          viewportRect.top,
          Math.min(
            rectangleRect.y + rectangleRect.height - 2 + yShift,
            viewportRect.bottom - 2,
          ),
        ),
      });

      const bottomRightX = rectangleRect.right - 1;
      const bottomRightY = rectangleRect.bottom - 1;

      rectangleRef.current.style.display = "none";
      const el = document.elementFromPoint(bottomRightX, bottomRightY);
      rectangleRef.current.style.display = "block";

      handleSelectionUpdate(div(el));
    }

    drawRectangle();
    rectangleRef.current.classList.remove("active");
  };

  const getClosestRow = (target: Target) => {
    const firstCell = target.closest(".ag-cell");
    const firstRow = firstCell && firstCell.closest("[row-index]");
    if (!firstCell || !firstRow) {
      return { row: -1, column: -1 };
    }

    // NOTE: columns are 1-indexed, rows are 0-indexed
    return {
      column: parseInt(firstCell.getAttribute("aria-colindex") ?? "-1", 10),
      row: parseInt(firstRow.getAttribute("row-index") ?? "-1", 10),
    };
  };

  const handleSelectionUpdate = (target: Target) => {
    selection.lastItemSelected = getClosestRow(target);
    selection.cellsInRow = Array.from(
      document.querySelectorAll(
        `.ag-row[row-index="${selection.lastItemSelected.row}"]`,
      ),
    )
      .map((row) => Array.from(row.querySelectorAll(".ag-cell")))
      .flat()
      .map((cell) => ({
        colId: cell.getAttribute("col-id") || "",
        index: parseInt(cell.getAttribute("aria-colindex") ?? "-1", 10),
        rect: cell.getBoundingClientRect(),
      }))
      .sort((a, b) => a.rect.x - b.rect.x);
  };

  /**
   * Initializes a rectangular selection using a point and sets our first
   * selected grid cell
   */
  const initRectangularSelection = (target: Target) => {
    const rectangularSelectionEl = div(
      document.querySelector(".selection-rectangle"),
    );
    if (!rectangularSelectionEl) {
      rectangleRef.current = createSelectionRectangle();
    } else if (!rectangleRef.current && rectangularSelectionEl) {
      rectangleRef.current = rectangularSelectionEl;
    }

    if (!rectangleRef.current) {
      return;
    }
    selection.firstItemSelected = getClosestRow(target);
    onSelectionStarted();

    function createSelectionRectangle() {
      const divEl = div(document.createElement("div"));
      divEl.classList.add("selection-rectangle");

      const button = div(document.createElement("button"));
      const metaKey = /Mac/i.test(navigator.userAgent) ? "⌘" : "^";
      button.innerHTML = `${localize("Copy")} (${metaKey} + c)`;
      button.classList.add("copy-button");
      divEl.appendChild(button);

      document.querySelector(scrollContainer)?.appendChild(divEl);

      return divEl;
    }
  };

  const relativePoint = ({ x, y }: Point) => {
    const container = div(document.querySelector(scrollContainer));
    const rect = container.getBoundingClientRect()!;

    return {
      x: x - rect.left + container.scrollLeft,
      y: y - rect.top + container.scrollTop,
    };
  };

  // #region: event handlers
  const onKeyDown = (event: KeyboardEvent) => {
    if (!enabled) {
      return;
    }
    if (event.key === "c" && (event.metaKey || event.ctrlKey)) {
      copySelection();
      return;
    }
    if (event.key === "Escape") {
      resetStyles();
      return;
    }
    if (event.shiftKey && event.key.match(/^Arrow.*$/)) {
      handleKeyboardBasedRectangularSelection(event);
    }
  };

  const onMouseDown: HTMLAttributes<HTMLDivElement>["onMouseDown"] = (e) => {
    // If this isn't the left mouse button or selection isn't enabled, ignore the action
    if (e.button !== 0 || !enabled) {
      return;
    }
    if (e.target && div(e.target).classList.contains("copy-button")) {
      copySelection();
      return;
    }

    mouseHasMoved.current = false;
    mouseSelectionEnabled.current = true;
    selection.lastItemSelected = undefined;
    selection.cellsInRow = [];
    selection.start = relativePoint({ x: e.clientX, y: e.clientY });
    initRectangularSelection(div(e.target));
  };

  const onMouseMove: HTMLAttributes<HTMLDivElement>["onMouseMove"] = (e) => {
    const mouseSelectionStarted =
      selection.start && rectangleRef.current && mouseSelectionEnabled.current;
    if (!enabled || !mouseSelectionStarted) {
      return;
    }
    selection.end = relativePoint({ x: e.clientX, y: e.clientY });

    // Set a minimum drag distance before we start drawing the rectangle
    if (
      !mouseHasMoved.current &&
      Math.max(
        Math.abs(selection.end.x - selection.start!.x),
        Math.abs(selection.end.y - selection.start!.y),
      ) < 5
    ) {
      return;
    }
    mouseHasMoved.current = true;

    drawRectangle();

    const boundaries = getScrollBoundaries();
    if (e.clientY > boundaries.bottom) {
      scrollDownInterval = beginScrolling("down", scrollDownInterval);
    } else {
      stopScrolling(scrollDownInterval);
    }
    if (e.clientY < boundaries.top) {
      scrollUpInterval = beginScrolling("up", scrollUpInterval);
    } else {
      stopScrolling(scrollUpInterval);
    }

    function beginScrolling(
      dir: "down" | "up",
      interval: ReturnType<typeof setInterval>,
    ) {
      if (interval) {
        clearInterval(interval);
      }
      return setInterval(() => {
        const viewport = document.querySelector(scrollViewport);
        const scrollDistance = dir === "down" ? 25 : -25;
        viewport.scrollBy(0, scrollDistance);
        selection.end!.y += scrollDistance;
        drawRectangle();
      }, 50);
    }
  };

  const onMouseUp: HTMLAttributes<HTMLDivElement>["onMouseUp"] = (e) => {
    // If this isn't the left mouse button, ignore the action
    if (e.button !== 0) {
      return;
    }
    stopScrolling(scrollDownInterval);
    stopScrolling(scrollUpInterval);
    rectangleRef.current.classList.remove("active");
    mouseSelectionEnabled.current = false;

    if (!mouseHasMoved.current) {
      resetStyles();
      return;
    }

    if (!selection.lastItemSelected) {
      // This is cumbersome, but what we have to do here is get the
      // target _under_ the selection rectangle, so we're going to hide the
      // rectangle, find what is under the current document point, then re-display
      // the rectangle.
      rectangleRef.current.style.display = "none";
      const el = document.elementFromPoint(e.clientX, e.clientY);
      rectangleRef.current.style.display = "block";
      handleSelectionUpdate(div(el));
    }
  };
  // #endregion: event handlers

  return {
    resetSelection: resetStyles,
    onKeyDown,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
};

export default useSelectionRectangle;
