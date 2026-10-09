// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React, { useRef } from "react";

import { fireEvent, render, screen } from "@testing-library/react";

import { beforeAll, describe, expect, it } from "vitest";

import useDraggableDialog from "../../../src/webview/ManageColumns/useDraggableDialog";

const capturedPointers = new WeakMap<HTMLElement, Set<number>>();

const getCapturedPointers = (element: HTMLElement) => {
  let pointers = capturedPointers.get(element);

  if (!pointers) {
    pointers = new Set<number>();
    capturedPointers.set(element, pointers);
  }

  return pointers;
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: function (pointerId: number) {
      getCapturedPointers(this).add(pointerId);
    },
  });

  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: function (pointerId: number) {
      return getCapturedPointers(this).has(pointerId);
    },
  });

  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: function (pointerId: number) {
      getCapturedPointers(this).delete(pointerId);
    },
  });
});

const TestComponent = ({ margin }: { margin?: number }) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { handleDragStart, handleDrag, handleDragEnd } = useDraggableDialog({
    dialogRef,
    containerSelector: ".data-viewer",
    margin,
  });

  return (
    <div className="data-viewer" data-testid="container">
      <dialog ref={dialogRef} data-testid="dialog">
        <div
          data-testid="header"
          onPointerDown={handleDragStart}
          onPointerMove={handleDrag}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <span data-testid="title">Manage Columns</span>

          <button type="button" data-testid="close-button">
            Close
          </button>
        </div>
      </dialog>
    </div>
  );
};

const setBounds = ({
  containerLeft = 0,
  containerTop = 0,
  containerWidth = 1000,
  containerHeight = 800,
  dialogLeft = 200,
  dialogTop = 150,
  dialogWidth = 400,
  dialogHeight = 300,
} = {}) => {
  const container = screen.getByTestId("container");
  const dialog = screen.getByTestId("dialog");

  container.getBoundingClientRect = () =>
    new DOMRect(containerLeft, containerTop, containerWidth, containerHeight);

  dialog.getBoundingClientRect = () =>
    new DOMRect(dialogLeft, dialogTop, dialogWidth, dialogHeight);
};

describe("useDraggableDialog", () => {
  it("moves the dialog when the header is dragged", () => {
    render(<TestComponent />);

    setBounds();

    const header = screen.getByTestId("header");
    const dialog = screen.getByTestId("dialog");

    fireEvent.pointerDown(header, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 200,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 400,
      clientY: 250,
    });

    expect(dialog.style.left).toBe("300px");
    expect(dialog.style.top).toBe("200px");
  });

  it("does not start dragging for a non-left mouse button", () => {
    render(<TestComponent />);

    setBounds();

    const header = screen.getByTestId("header");
    const dialog = screen.getByTestId("dialog");

    fireEvent.pointerDown(header, {
      button: 1,
      pointerId: 1,
      clientX: 300,
      clientY: 200,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 500,
      clientY: 400,
    });

    expect(dialog.style.left).toBe("");
    expect(dialog.style.top).toBe("");
  });

  it("does not start dragging when a header button is used", () => {
    render(<TestComponent />);

    setBounds();

    const closeButton = screen.getByTestId("close-button");
    const header = screen.getByTestId("header");
    const dialog = screen.getByTestId("dialog");

    fireEvent.pointerDown(closeButton, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 200,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 500,
      clientY: 400,
    });

    expect(dialog.style.left).toBe("");
    expect(dialog.style.top).toBe("");
  });

  it("does not move when the pointer has not been captured", () => {
    render(<TestComponent />);

    setBounds();

    const header = screen.getByTestId("header");
    const dialog = screen.getByTestId("dialog");

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 500,
      clientY: 400,
    });

    expect(dialog.style.left).toBe("");
    expect(dialog.style.top).toBe("");
  });

  it("keeps the dialog inside the top-left container boundary", () => {
    render(<TestComponent />);

    setBounds();

    const header = screen.getByTestId("header");
    const dialog = screen.getByTestId("dialog");

    fireEvent.pointerDown(header, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 200,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });

    expect(dialog.style.left).toBe("16px");
    expect(dialog.style.top).toBe("16px");
  });

  it("keeps the dialog inside the bottom-right container boundary", () => {
    render(<TestComponent />);

    setBounds();

    const header = screen.getByTestId("header");
    const dialog = screen.getByTestId("dialog");

    fireEvent.pointerDown(header, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 200,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 1200,
      clientY: 1000,
    });

    expect(dialog.style.left).toBe("584px");
    expect(dialog.style.top).toBe("484px");
  });

  it("uses a custom margin when supplied", () => {
    render(<TestComponent margin={32} />);

    setBounds();

    const header = screen.getByTestId("header");
    const dialog = screen.getByTestId("dialog");

    fireEvent.pointerDown(header, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 200,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
    });

    expect(dialog.style.left).toBe("32px");
    expect(dialog.style.top).toBe("32px");
  });

  it("updates the available resize area after moving", () => {
    render(<TestComponent />);

    setBounds();

    const header = screen.getByTestId("header");
    const dialog = screen.getByTestId("dialog");

    fireEvent.pointerDown(header, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 200,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 400,
      clientY: 250,
    });

    expect(dialog.style.left).toBe("300px");
    expect(dialog.style.top).toBe("200px");

    expect(dialog.style.maxWidth).toBe("684px");
    expect(dialog.style.maxHeight).toBe("584px");
  });

  it("stops dragging after pointer up", () => {
    render(<TestComponent />);

    setBounds();

    const header = screen.getByTestId("header");
    const dialog = screen.getByTestId("dialog");

    fireEvent.pointerDown(header, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 200,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 400,
      clientY: 250,
    });

    expect(dialog.style.left).toBe("300px");

    fireEvent.pointerUp(header, {
      pointerId: 1,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 500,
      clientY: 350,
    });

    expect(dialog.style.left).toBe("300px");
    expect(dialog.style.top).toBe("200px");
  });

  it("stops dragging after pointer cancel", () => {
    render(<TestComponent />);

    setBounds();

    const header = screen.getByTestId("header");
    const dialog = screen.getByTestId("dialog");

    fireEvent.pointerDown(header, {
      button: 0,
      pointerId: 1,
      clientX: 300,
      clientY: 200,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 400,
      clientY: 250,
    });

    fireEvent.pointerCancel(header, {
      pointerId: 1,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 500,
      clientY: 350,
    });

    expect(dialog.style.left).toBe("300px");
    expect(dialog.style.top).toBe("200px");
  });
});
