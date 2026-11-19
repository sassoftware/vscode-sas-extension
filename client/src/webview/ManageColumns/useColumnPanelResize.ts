// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

// Limit each panel to 30-70% of the available width.
const MIN_PANEL_RATIO = 0.3;
const MAX_PANEL_RATIO = 0.7;
const KEYBOARD_RESIZE_STEP = 16;
const SPLITTER_WIDTH = 8;

// Handle resizing between the Hidden and Displayed column panels.
const useColumnPanelResize = () => {
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // Store the initial pointer position and panel widths during resizing.
  const resizeRef = useRef({
    startX: 0,
    startLeftWidth: 0,
    totalWidth: 0,
  });

  // Update the grid layout based on the new left panel width.
  const applyLeftWidth = (leftWidth: number, totalWidth: number) => {
    if (totalWidth <= 0) {
      return;
    }

    const leftPercent = (leftWidth / totalWidth) * 100;
    const modalContent = leftPanelRef.current?.parentElement;

    if (modalContent) {
      modalContent.style.gridTemplateColumns = `${leftPercent}fr ${SPLITTER_WIDTH}px ${100 - leftPercent}fr`;
    }
  };

  // Start resizing when the user presses the panel divider.
  const handleResizeStart = (event: PointerEvent<HTMLDivElement>) => {
    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;

    if (!leftPanel || !rightPanel) {
      return;
    }

    const startLeftWidth = leftPanel.getBoundingClientRect().width;
    const startRightWidth = rightPanel.getBoundingClientRect().width;

    resizeRef.current = {
      startX: event.clientX,
      startLeftWidth,
      totalWidth: startLeftWidth + startRightWidth,
    };

    // Continue receiving pointer events while dragging the divider.
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  // Resize both panels as the divider moves, within the allowed limits.
  const handleResize = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const { startX, startLeftWidth, totalWidth } = resizeRef.current;

    const minWidth = totalWidth * MIN_PANEL_RATIO;
    const maxWidth = totalWidth * MAX_PANEL_RATIO;

    const requestedLeftWidth = startLeftWidth + (event.clientX - startX);

    const leftWidth = Math.min(
      maxWidth,
      Math.max(minWidth, requestedLeftWidth),
    );

    applyLeftWidth(leftWidth, totalWidth);
  };

  // Stop resizing and release pointer capture.
  const handleResizeEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  // Allow resizing with the left and right arrow keys for accessibility.
  const handleResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();

    const leftPanel = leftPanelRef.current;
    const rightPanel = rightPanelRef.current;

    if (!leftPanel || !rightPanel) {
      return;
    }

    const leftWidth = leftPanel.getBoundingClientRect().width;
    const totalWidth = leftWidth + rightPanel.getBoundingClientRect().width;

    const minWidth = totalWidth * MIN_PANEL_RATIO;
    const maxWidth = totalWidth * MAX_PANEL_RATIO;

    const requestedLeftWidth =
      leftWidth +
      (event.key === "ArrowRight"
        ? KEYBOARD_RESIZE_STEP
        : -KEYBOARD_RESIZE_STEP);

    const nextLeftWidth = Math.max(
      minWidth,
      Math.min(maxWidth, requestedLeftWidth),
    );

    applyLeftWidth(nextLeftWidth, totalWidth);
  };

  return {
    leftPanelRef,
    rightPanelRef,
    handleResizeStart,
    handleResize,
    handleResizeEnd,
    handleResizeKeyDown,
  };
};

export default useColumnPanelResize;
