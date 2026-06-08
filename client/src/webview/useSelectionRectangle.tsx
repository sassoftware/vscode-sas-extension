// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { HTMLAttributes, useRef } from "react";

import { IRowNode } from "ag-grid-community";

import { stringArrayToCsvString } from "../components/utils/csv";
import localize from "./localize";
import vscode from "./vscode";

const div = (el: HTMLDivElement | HTMLUnknownElement | EventTarget | null) =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  el as HTMLDivElement;

type Point = { x: number; y: number };
type Target = HTMLDivElement;
type SelectedItem = { row: number; column: number };
type Selection = {
  start?: Point;
  end?: Point;
  firstItemSelected?: SelectedItem;
  lastItemSelected?: SelectedItem;
};
export const useSelectionRectangle = ({
  enabled,
  scrollBoundaries,
  scrollContainer,
  getRowData,
  onSelectionStart,
  onSelectionEnd,
}: {
  enabled: boolean;
  scrollContainer: string;
  scrollBoundaries: () => { bottom: number };
  getRowData: (rowIndex: string) => IRowNode | undefined;
  onSelectionStart: () => void;
  onSelectionEnd: () => void;
}) => {
  const rectangleRef = useRef<HTMLDivElement>(undefined!);
  let rectangle = rectangleRef.current;

  const selectionRef = useRef<Selection>({
    start: undefined,
    end: undefined,
    firstItemSelected: undefined,
    lastItemSelected: undefined,
  });
  const selection = selectionRef.current;

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

    rectangle.classList.add("active");
    rectangle.style.display = "block";
    rectangle.style.left = `${topLeftX}px`;
    rectangle.style.top = `${topLeftY}px`;
    rectangle.style.width = `${bottomRightX - topLeftX}px`;
    rectangle.style.height = `${bottomRightY - topLeftY}px`;
  };

  let scrollDownTimeout: ReturnType<typeof setInterval>;
  const stopScrolling = () => clearInterval(scrollDownTimeout);

  const resetStyles = () => {
    stopScrolling();
    onSelectionEnd();
    rectangle.style.display = "none";
  };

  const copySelection = () => {
    // Clipboard needs to be available before we can copy text.
    if (!navigator.clipboard) {
      displayClipboardError();
      return;
    }

    const rectangleRect = rectangle.getBoundingClientRect();

    // 1. Get column headers for selection
    const cellsInRow = Array.from(
      document.querySelectorAll(
        `.ag-row[row-index="${selection.firstItemSelected!.row}"]`,
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
    const cellNames = cellsInRow
      .filter((cell) => intersects(rectangleRect, cell.rect))
      .map((cell) => cell.colId);
    const csvLines = [stringArrayToCsvString(cellNames)];

    // 2. Find the first and last row index in selection

    // We're finding the min row here, since selection can be top down or bottom up
    const firstRowIndex = Math.min(
      selection.firstItemSelected!.row,
      selection.lastItemSelected!.row,
    );
    const allRows = Array.from(
      document.querySelectorAll(`[row-index]`),
    ).reverse();
    const lastIntersectingRow = allRows.find((row) =>
      intersects(rectangleRect, row.getBoundingClientRect()),
    );
    const lastRowIndex = lastIntersectingRow
      ? parseInt(lastIntersectingRow.getAttribute("row-index")!, 10)
      : -1;
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

  // const handleKeyboardBasedRectangularSelection = (event: KeyboardEvent) => {
  //   const targetRect = div(event.target).getBoundingClientRect();
  //   if (
  //     !rectangle ||
  //     rectangle.style.display !== "block"
  //   ) {
  //     mouseHasMoved.current = false;
  //     mouseSelectionEnabled.current = false;
  //     // Lets initialize our rectangle
  //     initRectangularSelection({
  //       x: targetRect.x,
  //       y: targetRect.y,
  //       target: div(event.target),
  //     });
  //   }

  //   updateRectangularSelection({
  //     x:
  //       targetRect.x -
  //       div(document.querySelector(scrollContainer)).getBoundingClientRect()
  //         .left +
  //       targetRect.width,
  //     y: targetRect.y + targetRect.height,
  //   });
  //   drawRectangle();
  // };

  // #region: event handlers
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "c" && (event.metaKey || event.ctrlKey)) {
      copySelection();
      return;
    }
    if (event.key === "Escape") {
      resetStyles();
      return;
    }
    if (
      event.shiftKey &&
      (event.key === "ArrowRight" || event.key === "ArrowDown")
    ) {
      // handleKeyboardBasedRectangularSelection(event);
    }
  };

  const getClosestRow = (target: Target) => {
    const firstCell = target.closest(".ag-cell");
    const firstRow = firstCell && firstCell.parentElement;
    if (!firstCell || !firstRow) {
      return { row: -1, column: -1 };
    }

    // NOTE: columns are 1-indexed, rows are 0-indexed
    return {
      column: parseInt(firstCell.getAttribute("aria-colindex") ?? "-1", 10),
      row: parseInt(firstRow.getAttribute("row-index") ?? "-1", 10),
    };
  };

  /**
   * Initializes a rectangular selection using a point and sets ofur first
   * selected grid cell
   */
  const initRectangularSelection = (target: Target) => {
    if (!document.querySelector(".selection-rectangle")) {
      rectangle = createSelectionRectangle();
    }
    if (!rectangle) {
      return;
    }
    selection.firstItemSelected = getClosestRow(target);

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

  const _points = useRef({ xi: 0, yi: 0, x: 0, y: 0 });

  const _drawTemporaryRectangle = ({ xi, yi, y, x }) => {
    const divEl = div(document.createElement("div"));
    divEl.classList.add("selection-rectangle");

    // const button = div(document.createElement("button"));
    // const metaKey = /Mac/i.test(navigator.userAgent) ? "⌘" : "^";
    // button.innerHTML = `${localize("Copy")} (${metaKey} + c)`;
    // button.classList.add("copy-button");
    // divEl.appendChild(button);

    document.querySelector(scrollContainer)?.appendChild(divEl);

    const topLeftX = x < xi ? x : xi;
    const topLeftY = y < yi ? y : yi;
    const bottomRightX = x > xi ? x : xi;
    const bottomRightY = y > yi ? y : yi;

    const width = bottomRightX - topLeftX;
    const height = bottomRightY - topLeftY;
    const top = topLeftY;
    const left = topLeftX;

    divEl.classList.add("active");
    divEl.style.display = `block`;
    divEl.style.left = `${left}px`;
    divEl.style.top = `${top}px`;
    divEl.style.width = `${width}px`;
    divEl.style.height = `${height}px`;
  };

  const onMouseDown: HTMLAttributes<HTMLDivElement>["onMouseDown"] = (e) => {
    if (e.target && div(e.target).classList.contains("copy-button")) {
      copySelection();
      return;
    }
    if (!enabled) {
      return;
    }

    mouseHasMoved.current = false;
    mouseSelectionEnabled.current = true;
    selection.lastItemSelected = undefined;
    selection.start = relativePoint({ x: e.clientX, y: e.clientY });
    onSelectionStart();
    initRectangularSelection(div(e.target));
  };

  const onMouseMove: HTMLAttributes<HTMLDivElement>["onMouseMove"] = (e) => {
    const mouseSelectionStarted =
      selection.start && rectangle && mouseSelectionEnabled.current;
    if (!enabled || !mouseSelectionStarted) {
      return;
    }
    mouseHasMoved.current = true;
    selection.end = relativePoint({ x: e.clientX, y: e.clientY });

    drawRectangle();

    const boundaries = scrollBoundaries();
    if (e.clientY > boundaries.bottom) {
      beginScrollingDown(e);
    } else {
      stopScrolling();
    }

    function beginScrollingDown() {
      if (scrollDownTimeout) {
        clearInterval(scrollDownTimeout);
      }
      scrollDownTimeout = setInterval(() => {
        const container = div(document.querySelector(scrollContainer));
        const scrollDistance = 25;
        container.scrollBy(0, scrollDistance);
        selection.end!.y += scrollDistance;
        drawRectangle();
      }, 50);
    }
  };

  const onMouseUp: HTMLAttributes<HTMLDivElement>["onMouseUp"] = (e) => {
    stopScrolling();
    rectangle.classList.remove("active");
    mouseSelectionEnabled.current = false;

    if (!selection.lastItemSelected) {
      // This is cumbersome, but what we have to do here is get the
      // target _under_ the selection rectangle, so we're going to hide the
      // rectangle, find what is under the current document point, then re-display
      // the rectangle.
      rectangle.style.display = "none";
      const el = document.elementFromPoint(e.clientX, e.clientY);
      rectangle.style.display = "block";
      selection.lastItemSelected = getClosestRow(div(el));
    }

    if (!mouseHasMoved.current) {
      resetStyles();
    }
  };
  // #endregion: event handlers

  return {
    onKeyDown,
    onMouseDown,
    onMouseMove,
    onMouseUp,
  };
};

export default useSelectionRectangle;
