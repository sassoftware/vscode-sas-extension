// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { HTMLAttributes, MouseEvent as ReactMouseEvent, useRef } from "react";

import { IRowNode } from "ag-grid-community";

import { stringArrayToCsvString } from "../components/utils/csv";
import localize from "./localize";
import vscode from "./vscode";

const div = (el: HTMLDivElement | HTMLUnknownElement | EventTarget | null) =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  el as HTMLDivElement;

type Point = { x: number; y: number };
type Target = HTMLDivElement;
export const useSelectionRectangle = ({
  enabled,
  scrollBoundaries,
  scrollContainer,
  getRowData,
}: {
  enabled: boolean;
  scrollContainer: string;
  scrollBoundaries: () => {
    bottom: number;
  };
  getRowData: (rowIndex: string) => IRowNode | undefined;
}) => {
  const rectangleRef = useRef<HTMLDivElement>(undefined!);
  const rectDimensionsRef = useRef<undefined | { x: number; y: number }>(
    undefined!,
  );
  const mouseSelectionEnabled = useRef<boolean>(false);
  const mouseHaveMoved = useRef<boolean>(false);
  const firstItem = useRef<{ row: number; column: number }>({
    row: -1,
    column: -1,
  });

  const drawRectangle = ({ x, y }: Point) => {
    if (!rectDimensionsRef.current) {
      return;
    }
    const dimensions = rectDimensionsRef.current;
    const container = div(document.querySelector(scrollContainer));
    const rect = container.getBoundingClientRect()!;
    const { x: xa, y: ya } = dimensions;

    const left = xa;
    const width = x - xa;
    let top = ya;
    const height = y - ya - rect.top;
    top += container.scrollTop || 0;

    // Selection can only happen from left to right, top to bottom
    // If we get into a situation where the user is trying to move in the
    // wrong direction, hide our selection.
    rectangleRef.current.classList.add("active");
    rectangleRef.current.style.display =
      height < 2 || width < 2 ? "none" : "block";
    rectangleRef.current.style.left = `${left}px`;
    rectangleRef.current.style.top = `${top}px`;
    rectangleRef.current.style.width = `${width}px`;
    rectangleRef.current.style.height = `${height}px`;
  };

  let scrollDownTimeout: ReturnType<typeof setInterval>;
  const stopScrolling = () => clearInterval(scrollDownTimeout);

  const resetStyles = () => {
    stopScrolling();
    rectangleRef.current.style.display = "none";
  };

  const copySelection = () => {
    // Clipboard needs to be available before we can copy text.
    if (!navigator.clipboard) {
      displayClipboardError();
      return;
    }

    const rectangleRect = rectangleRef.current.getBoundingClientRect();

    // 1. Get column headers for selection
    const cellsInRow = Array.from(
      document.querySelectorAll(
        `.ag-row[row-index="${firstItem.current.row}"]`,
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
    const firstRowIndex = firstItem.current.row;
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

  const handleKeyboardBasedRectangularSelection = (event: KeyboardEvent) => {
    const targetRect = div(event.target).getBoundingClientRect();
    if (
      !rectangleRef.current ||
      rectangleRef.current.style.display !== "block"
    ) {
      mouseHaveMoved.current = false;
      mouseSelectionEnabled.current = false;
      // Lets initialize our rectangle
      initRectangularSelection({
        x: targetRect.x,
        y: targetRect.y,
        target: div(event.target),
      });
    }

    drawRectangle({
      x:
        targetRect.x -
        div(document.querySelector(scrollContainer)).getBoundingClientRect()
          .left +
        targetRect.width,
      y: targetRect.y + targetRect.height,
    });
  };

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
      handleKeyboardBasedRectangularSelection(event);
    }
  };

  /**
   * Initializes a rectangular selection using a point and sets ofur first
   * selected grid cell
   */
  const initRectangularSelection = ({
    x,
    y,
    target,
  }: Point & { target: Target }) => {
    if (!document.querySelector(".selection-rectangle")) {
      rectangleRef.current = createSelectionRectangle();
    }
    if (!rectangleRef.current) {
      return;
    }
    const container = div(document.querySelector(scrollContainer));
    const rect = container.getBoundingClientRect()!;
    rectDimensionsRef.current = {
      x: x - rect.left,
      y: y - rect.top,
    };
    firstItem.current = getFirstRow();

    function getFirstRow() {
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
    }

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

  const onMouseDown: HTMLAttributes<HTMLDivElement>["onMouseDown"] = (e) => {
    if (e.target && div(e.target).classList.contains("copy-button")) {
      copySelection();
      return;
    }
    if (!enabled) {
      return;
    }

    mouseHaveMoved.current = false;
    mouseSelectionEnabled.current = true;
    initRectangularSelection({
      x: e.clientX,
      y: e.clientY,
      target: div(e.target),
    });
  };

  const onMouseMove: HTMLAttributes<HTMLDivElement>["onMouseMove"] = (e) => {
    if (!enabled) {
      return;
    }
    if (
      !rectDimensionsRef.current ||
      !rectangleRef.current ||
      !mouseSelectionEnabled.current
    ) {
      return;
    }
    mouseHaveMoved.current = true;
    drawRectangle({ x: e.clientX, y: e.clientY });

    const boundaries = scrollBoundaries();
    if (e.clientY > boundaries.bottom) {
      beginScrollingDown(e);
    } else {
      stopScrolling();
    }

    function beginScrollingDown(
      e: ReactMouseEvent<HTMLDivElement, MouseEvent>,
    ) {
      if (scrollDownTimeout) {
        clearInterval(scrollDownTimeout);
      }
      scrollDownTimeout = setInterval(() => {
        if (!rectDimensionsRef.current) {
          return;
        }
        const dimensions = rectDimensionsRef.current;
        const container = div(document.querySelector(scrollContainer));
        const scrollDistance = 25;
        container.scrollBy(0, scrollDistance);
        dimensions.y -= scrollDistance;
        drawRectangle({ x: e.clientX, y: e.clientY });
      }, 50);
    }
  };

  const onMouseUp: HTMLAttributes<HTMLDivElement>["onMouseUp"] = () => {
    stopScrolling();
    rectangleRef.current.classList.remove("active");
    mouseSelectionEnabled.current = false;
    if (!mouseHaveMoved.current) {
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
