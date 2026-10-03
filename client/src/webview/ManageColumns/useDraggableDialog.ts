// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useRef } from "react";
import type { PointerEvent, RefObject } from "react";

interface DraggableDialogOptions {
  dialogRef: RefObject<HTMLDialogElement | null>;
  containerSelector: string;
  margin?: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const useDraggableDialog = ({
  dialogRef,
  containerSelector,
  margin = 16,
}: DraggableDialogOptions) => {
  const dragRef = useRef({
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
  });

  const handleDragStart = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;

    if (!(target instanceof HTMLElement)) {
      return;
    }

    // Do not start dragging when interacting with a button in the header.
    if (target.closest("button")) {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const rect = dialog.getBoundingClientRect();

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }

    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const container =
      dialog.closest<HTMLElement>(containerSelector) ?? dialog.parentElement;

    if (!container) {
      return;
    }

    const containerBounds = container.getBoundingClientRect();
    const dialogBounds = dialog.getBoundingClientRect();

    const requestedLeft =
      dragRef.current.startLeft + (event.clientX - dragRef.current.startX);

    const requestedTop =
      dragRef.current.startTop + (event.clientY - dragRef.current.startY);

    const minLeft = containerBounds.left + margin;
    const minTop = containerBounds.top + margin;

    const maxLeft = Math.max(
      minLeft,
      containerBounds.right - margin - dialogBounds.width,
    );

    const maxTop = Math.max(
      minTop,
      containerBounds.bottom - margin - dialogBounds.height,
    );

    const left = clamp(requestedLeft, minLeft, maxLeft);
    const top = clamp(requestedTop, minTop, maxTop);

    dialog.style.left = `${left}px`;
    dialog.style.top = `${top}px`;

    // Native dialog resizing grows toward the right/bottom.
    // Recalculate the available resize area after moving the dialog.
    dialog.style.maxWidth = `${Math.max(
      0,
      containerBounds.right - margin - left,
    )}px`;

    dialog.style.maxHeight = `${Math.max(
      0,
      containerBounds.bottom - margin - top,
    )}px`;
  };

  const handleDragEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return {
    handleDragStart,
    handleDrag,
    handleDragEnd,
  };
};

export default useDraggableDialog;
