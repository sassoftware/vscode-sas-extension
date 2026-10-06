// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React from "react";

import { fireEvent, render, screen } from "@testing-library/react";

import { beforeAll, describe, expect, it, vi } from "vitest";

import useColumnPanelResize from "../../../src/webview/ManageColumns/useColumnPanelResize";

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

const TestComponent = () => {
  const {
    leftPanelRef,
    rightPanelRef,
    handleResizeStart,
    handleResize,
    handleResizeEnd,
    handleResizeKeyDown,
  } = useColumnPanelResize();

  return (
    <div data-testid="content">
      <div ref={leftPanelRef} data-testid="left-panel" />

      <div
        data-testid="splitter"
        role="separator"
        tabIndex={0}
        onPointerDown={handleResizeStart}
        onPointerMove={handleResize}
        onPointerUp={handleResizeEnd}
        onPointerCancel={handleResizeEnd}
        onKeyDown={handleResizeKeyDown}
      />

      <div ref={rightPanelRef} data-testid="right-panel" />
    </div>
  );
};

const setPanelWidths = (leftWidth: number, rightWidth: number) => {
  const leftPanel = screen.getByTestId("left-panel");
  const rightPanel = screen.getByTestId("right-panel");

  leftPanel.getBoundingClientRect = vi.fn(
    () => new DOMRect(0, 0, leftWidth, 100),
  );

  rightPanel.getBoundingClientRect = vi.fn(
    () => new DOMRect(0, 0, rightWidth, 100),
  );
};

describe("useColumnPanelResize", () => {
  it("resizes the column panels with pointer movement", () => {
    render(<TestComponent />);

    setPanelWidths(400, 600);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.pointerDown(splitter, {
      pointerId: 1,
      clientX: 400,
    });

    fireEvent.pointerMove(splitter, {
      pointerId: 1,
      clientX: 500,
    });

    expect(content.style.gridTemplateColumns).toBe("50fr 8px 50fr");
  });

  it("does not resize when the pointer has not been captured", () => {
    render(<TestComponent />);

    setPanelWidths(400, 600);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.pointerMove(splitter, {
      pointerId: 1,
      clientX: 500,
    });

    expect(content.style.gridTemplateColumns).toBe("");
  });

  it("limits pointer resize to the minimum panel ratio", () => {
    render(<TestComponent />);

    setPanelWidths(400, 600);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.pointerDown(splitter, {
      pointerId: 1,
      clientX: 400,
    });

    fireEvent.pointerMove(splitter, {
      pointerId: 1,
      clientX: 0,
    });

    expect(content.style.gridTemplateColumns).toBe("30fr 8px 70fr");
  });

  it("limits pointer resize to the maximum panel ratio", () => {
    render(<TestComponent />);

    setPanelWidths(400, 600);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.pointerDown(splitter, {
      pointerId: 1,
      clientX: 400,
    });

    fireEvent.pointerMove(splitter, {
      pointerId: 1,
      clientX: 1000,
    });

    expect(content.style.gridTemplateColumns).toBe("70fr 8px 30fr");
  });

  it("stops resizing after pointer up", () => {
    render(<TestComponent />);

    setPanelWidths(400, 600);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.pointerDown(splitter, {
      pointerId: 1,
      clientX: 400,
    });

    fireEvent.pointerMove(splitter, {
      pointerId: 1,
      clientX: 500,
    });

    expect(content.style.gridTemplateColumns).toBe("50fr 8px 50fr");

    fireEvent.pointerUp(splitter, {
      pointerId: 1,
    });

    fireEvent.pointerMove(splitter, {
      pointerId: 1,
      clientX: 600,
    });

    expect(content.style.gridTemplateColumns).toBe("50fr 8px 50fr");
  });

  it("stops resizing after pointer cancel", () => {
    render(<TestComponent />);

    setPanelWidths(400, 600);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.pointerDown(splitter, {
      pointerId: 1,
      clientX: 400,
    });

    fireEvent.pointerMove(splitter, {
      pointerId: 1,
      clientX: 500,
    });

    expect(content.style.gridTemplateColumns).toBe("50fr 8px 50fr");

    fireEvent.pointerCancel(splitter, {
      pointerId: 1,
    });

    fireEvent.pointerMove(splitter, {
      pointerId: 1,
      clientX: 600,
    });

    expect(content.style.gridTemplateColumns).toBe("50fr 8px 50fr");
  });

  it("resizes the panels to the left with ArrowLeft", () => {
    render(<TestComponent />);

    setPanelWidths(400, 600);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.keyDown(splitter, {
      key: "ArrowLeft",
    });

    expect(content.style.gridTemplateColumns).toBe("38.4fr 8px 61.6fr");
  });

  it("resizes the panels to the right with ArrowRight", () => {
    render(<TestComponent />);

    setPanelWidths(400, 600);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.keyDown(splitter, {
      key: "ArrowRight",
    });

    expect(content.style.gridTemplateColumns).toBe("41.6fr 8px 58.4fr");
  });

  it("limits keyboard resize to the minimum panel ratio", () => {
    render(<TestComponent />);

    setPanelWidths(300, 700);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.keyDown(splitter, {
      key: "ArrowLeft",
    });

    expect(content.style.gridTemplateColumns).toBe("30fr 8px 70fr");
  });

  it("limits keyboard resize to the maximum panel ratio", () => {
    render(<TestComponent />);

    setPanelWidths(700, 300);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.keyDown(splitter, {
      key: "ArrowRight",
    });

    expect(content.style.gridTemplateColumns).toBe("70fr 8px 30fr");
  });

  it("ignores unsupported keyboard keys", () => {
    render(<TestComponent />);

    setPanelWidths(400, 600);

    const splitter = screen.getByTestId("splitter");
    const content = screen.getByTestId("content");

    fireEvent.keyDown(splitter, {
      key: "Enter",
    });

    expect(content.style.gridTemplateColumns).toBe("");
  });
});
