// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useRef } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

const MIN_PANEL_RATIO = 0.3;
const MAX_PANEL_RATIO = 0.7;
const KEYBOARD_RESIZE_STEP = 16;
const SPLITTER_WIDTH = 8;

const useColumnPanelResize = () => {
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const resizeRef = useRef({
    startX: 0,
    startLeftWidth: 0,
    totalWidth: 0,
  });

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

    event.currentTarget.setPointerCapture(event.pointerId);
  };

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

  const handleResizeEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

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
