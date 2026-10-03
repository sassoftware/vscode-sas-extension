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

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

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

    const updateDialogBounds = () => {
      const bounds = container.getBoundingClientRect();
      const viewport = window.visualViewport;

      const viewportLeft = viewport?.offsetLeft ?? 0;
      const viewportTop = viewport?.offsetTop ?? 0;

      const viewportWidth =
        viewport?.width ?? document.documentElement.clientWidth;

      const viewportHeight =
        viewport?.height ?? document.documentElement.clientHeight;

      const left = Math.max(viewportLeft, bounds.left);
      const right = Math.min(viewportLeft + viewportWidth, bounds.right);

      const top = Math.max(viewportTop, bounds.top);
      const bottom = Math.min(viewportTop + viewportHeight, bounds.bottom);

      availableWidth = Math.max(0, right - left);
      availableHeight = Math.max(0, bottom - top);

      const horizontalMargin = Math.min(16, availableWidth / 4);
      const verticalMargin = Math.min(16, availableHeight / 4);

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

    updateDialogBounds();

    const containerObserver = new ResizeObserver(updateDialogBounds);

    containerObserver.observe(container);

    const viewportObserver = new ResizeObserver(updateDialogBounds);

    viewportObserver.observe(document.documentElement);

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

    window.addEventListener("resize", updateDialogBounds);

    window.addEventListener("scroll", updateDialogBounds, true);

    window.visualViewport?.addEventListener("resize", updateDialogBounds);

    window.visualViewport?.addEventListener("scroll", updateDialogBounds);

    return () => {
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
