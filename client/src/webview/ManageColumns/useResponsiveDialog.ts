// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { useLayoutEffect } from "react";
import type { RefObject } from "react";

interface ResponsiveDialogOptions {
  dialogRef: RefObject<HTMLDialogElement | null>;
  containerSelector: string;
  defaultWidthRatio?: number;
  defaultHeightRatio?: number;
  minWidth?: number;
  minHeight?: number;
}

// Keep a value within the given minimum and maximum limits.
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// Calculate the visible area shared by the container and the viewport.
// This ensures the dialog stays within the available screen space.
const getAvailableBounds = (container: Element) => {
  const bounds = container.getBoundingClientRect();
  const viewport = window.visualViewport;

  const viewportLeft = viewport?.offsetLeft ?? 0;
  const viewportTop = viewport?.offsetTop ?? 0;
  const viewportWidth = viewport?.width ?? document.documentElement.clientWidth;
  const viewportHeight =
    viewport?.height ?? document.documentElement.clientHeight;

  const left = Math.max(viewportLeft, bounds.left);
  const right = Math.min(viewportLeft + viewportWidth, bounds.right);
  const top = Math.max(viewportTop, bounds.top);
  const bottom = Math.min(viewportTop + viewportHeight, bounds.bottom);

  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);

  return {
    left,
    right,
    top,
    bottom,
    width,
    height,
    horizontalMargin: Math.min(16, width / 4),
    verticalMargin: Math.min(16, height / 4),
  };
};

// Manage the dialog's size and position when the container or viewport changes.
const useResponsiveDialog = ({
  dialogRef,
  containerSelector,
  defaultWidthRatio = 0.6,
  defaultHeightRatio = 0.7,
  minWidth = 500,
  minHeight = 350,
}: ResponsiveDialogOptions) => {
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    const container =
      dialog?.closest(containerSelector) ?? dialog?.parentElement;

    if (!dialog || !container) {
      return;
    }

    let widthRatio = defaultWidthRatio;
    let heightRatio = defaultHeightRatio;

    let availableWidth = 0;
    let availableHeight = 0;

    let lastAppliedWidth = 0;
    let lastAppliedHeight = 0;

    let positioned = false;

    // Resize and reposition the dialog to fit within the available area.
    // Preserve its current position after the initial layout.
    const updateDialogBounds = () => {
      const bounds = getAvailableBounds(container);

      const { left, right, top, bottom, horizontalMargin, verticalMargin } =
        bounds;

      availableWidth = bounds.width;
      availableHeight = bounds.height;

      const maxAvailableWidth = Math.max(
        0,
        availableWidth - horizontalMargin * 2,
      );

      const maxAvailableHeight = Math.max(
        0,
        availableHeight - verticalMargin * 2,
      );

      const minAllowedWidth = Math.min(minWidth, maxAvailableWidth);
      const minAllowedHeight = Math.min(minHeight, maxAvailableHeight);

      let width = Math.min(
        maxAvailableWidth,
        Math.max(minAllowedWidth, availableWidth * widthRatio),
      );

      let height = Math.min(
        maxAvailableHeight,
        Math.max(minAllowedHeight, availableHeight * heightRatio),
      );

      let dialogLeft: number;
      let dialogTop: number;

      // Center the dialog initially, then preserve its position.
      if (!positioned) {
        dialogLeft = left + (availableWidth - width) / 2;
        dialogTop = top + (availableHeight - height) / 2;
        positioned = true;
      } else {
        const rect = dialog.getBoundingClientRect();
        dialogLeft = rect.left;
        dialogTop = rect.top;
      }

      const minLeft = left + horizontalMargin;
      const minTop = top + verticalMargin;

      const maxLeft = Math.max(minLeft, right - horizontalMargin - width);
      const maxTop = Math.max(minTop, bottom - verticalMargin - height);

      // Prevent the dialog from moving outside the visible area.
      dialogLeft = clamp(dialogLeft, minLeft, maxLeft);
      dialogTop = clamp(dialogTop, minTop, maxTop);

      const maxWidthFromPosition = Math.max(
        0,
        right - horizontalMargin - dialogLeft,
      );

      const maxHeightFromPosition = Math.max(
        0,
        bottom - verticalMargin - dialogTop,
      );

      width = Math.min(width, maxWidthFromPosition);
      height = Math.min(height, maxHeightFromPosition);

      lastAppliedWidth = width;
      lastAppliedHeight = height;

      // Apply the calculated position and size constraints.
      dialog.style.left = `${dialogLeft}px`;
      dialog.style.top = `${dialogTop}px`;
      dialog.style.width = `${width}px`;
      dialog.style.height = `${height}px`;

      dialog.style.minWidth = `${Math.min(
        minAllowedWidth,
        maxWidthFromPosition,
      )}px`;

      dialog.style.minHeight = `${Math.min(
        minAllowedHeight,
        maxHeightFromPosition,
      )}px`;

      dialog.style.maxWidth = `${maxWidthFromPosition}px`;
      dialog.style.maxHeight = `${maxHeightFromPosition}px`;
    };

    // Center the dialog when it opens without resetting its dimensions.
    const centerDialog = () => {
      const {
        left,
        right,
        top,
        bottom,
        width,
        height,
        horizontalMargin,
        verticalMargin,
      } = getAvailableBounds(container);

      const rect = dialog.getBoundingClientRect();

      const minLeft = left + horizontalMargin;
      const minTop = top + verticalMargin;

      const maxLeft = Math.max(minLeft, right - horizontalMargin - rect.width);
      const maxTop = Math.max(minTop, bottom - verticalMargin - rect.height);

      const dialogLeft = clamp(
        left + (width - rect.width) / 2,
        minLeft,
        maxLeft,
      );

      const dialogTop = clamp(top + (height - rect.height) / 2, minTop, maxTop);

      dialog.style.left = `${dialogLeft}px`;
      dialog.style.top = `${dialogTop}px`;

      dialog.style.maxWidth = `${Math.max(
        0,
        right - horizontalMargin - dialogLeft,
      )}px`;

      dialog.style.maxHeight = `${Math.max(
        0,
        bottom - verticalMargin - dialogTop,
      )}px`;
    };

    // Set the initial dialog dimensions and position.
    updateDialogBounds();

    // Center the dialog when its open attribute changes.
    const openObserver = new MutationObserver(() => {
      if (dialog.open) {
        centerDialog();
      }
    });

    openObserver.observe(dialog, {
      attributes: true,
      attributeFilter: ["open"],
    });

    // Recalculate dialog bounds when its container or document size changes.
    const containerObserver = new ResizeObserver(updateDialogBounds);
    containerObserver.observe(container);

    const viewportObserver = new ResizeObserver(updateDialogBounds);
    viewportObserver.observe(document.documentElement);

    // Remember manually resized dimensions so future layout changes
    // preserve the user's preferred dialog size.
    const dialogObserver = new ResizeObserver(() => {
      if (availableWidth <= 0 || availableHeight <= 0) {
        return;
      }

      const rect = dialog.getBoundingClientRect();

      const isProgrammaticResize =
        Math.abs(rect.width - lastAppliedWidth) < 1 &&
        Math.abs(rect.height - lastAppliedHeight) < 1;

      if (isProgrammaticResize) {
        return;
      }

      widthRatio = rect.width / availableWidth;
      heightRatio = rect.height / availableHeight;

      // Keep the current top-left position fixed
      // while using the native bottom-right resize handle.
      lastAppliedWidth = rect.width;
      lastAppliedHeight = rect.height;
    });

    dialogObserver.observe(dialog);

    // Handle window and viewport resizing or scrolling.
    window.addEventListener("resize", updateDialogBounds);
    window.addEventListener("scroll", updateDialogBounds, true);
    window.visualViewport?.addEventListener("resize", updateDialogBounds);
    window.visualViewport?.addEventListener("scroll", updateDialogBounds);

    // Remove observers and listeners when the dialog unmounts.
    return () => {
      openObserver.disconnect();
      containerObserver.disconnect();
      viewportObserver.disconnect();
      dialogObserver.disconnect();

      window.removeEventListener("resize", updateDialogBounds);
      window.removeEventListener("scroll", updateDialogBounds, true);
      window.visualViewport?.removeEventListener("resize", updateDialogBounds);
      window.visualViewport?.removeEventListener("scroll", updateDialogBounds);
    };
  }, [
    containerSelector,
    defaultHeightRatio,
    defaultWidthRatio,
    dialogRef,
    minHeight,
    minWidth,
  ]);
};

export default useResponsiveDialog;
