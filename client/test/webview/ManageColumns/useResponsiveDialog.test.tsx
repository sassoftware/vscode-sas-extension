// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import React, { useRef } from "react";

import { act, render, screen, waitFor } from "@testing-library/react";

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import useResponsiveDialog from "../../../src/webview/ManageColumns/useResponsiveDialog";

class ResizeObserverMock implements ResizeObserver {
  static instances: ResizeObserverMock[] = [];

  private callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }

  observe() {
    return;
  }

  unobserve() {
    return;
  }

  disconnect() {
    return;
  }

  takeRecords(): ResizeObserverEntry[] {
    return [];
  }

  trigger() {
    this.callback([], this);
  }
}

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

type Bounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

let containerBounds: Bounds;
let dialogBounds: Bounds;

const createRect = ({ left, top, width, height }: Bounds) =>
  new DOMRect(left, top, width, height);

const TestComponent = ({
  defaultWidthRatio,
  defaultHeightRatio,
  minWidth,
  minHeight,
}: {
  defaultWidthRatio?: number;
  defaultHeightRatio?: number;
  minWidth?: number;
  minHeight?: number;
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useResponsiveDialog({
    dialogRef,
    containerSelector: ".data-viewer",
    defaultWidthRatio,
    defaultHeightRatio,
    minWidth,
    minHeight,
  });

  return (
    <div className="data-viewer" data-testid="container">
      <dialog ref={dialogRef} data-testid="dialog">
        Manage Columns
      </dialog>
    </div>
  );
};

const setViewportSize = (width = 1200, height = 900) => {
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: width,
  });

  Object.defineProperty(document.documentElement, "clientHeight", {
    configurable: true,
    value: height,
  });
};

const setContainerBounds = ({
  left = 0,
  top = 0,
  width = 1000,
  height = 800,
}: Partial<Bounds> = {}) => {
  containerBounds = {
    left,
    top,
    width,
    height,
  };
};

const setDialogBounds = ({
  left = 200,
  top = 120,
  width = 600,
  height = 560,
}: Partial<Bounds> = {}) => {
  dialogBounds = {
    left,
    top,
    width,
    height,
  };
};

describe("useResponsiveDialog", () => {
  beforeEach(() => {
    ResizeObserverMock.instances.length = 0;

    setViewportSize();
    setContainerBounds();
    setDialogBounds();

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.dataset.testid === "container") {
          return createRect(containerBounds);
        }

        if (this.dataset.testid === "dialog") {
          return createRect(dialogBounds);
        }

        return new DOMRect();
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sizes and centers the dialog inside the container", () => {
    render(<TestComponent />);

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).toBe("600px");
    expect(dialog.style.height).toBe("560px");

    expect(dialog.style.left).toBe("200px");
    expect(dialog.style.top).toBe("120px");
  });

  it("applies the default minimum width and height", () => {
    setContainerBounds({
      width: 700,
      height: 500,
    });

    render(<TestComponent />);

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).toBe("500px");
    expect(dialog.style.height).toBe("350px");
  });

  it("supports custom size ratios", () => {
    render(<TestComponent defaultWidthRatio={0.5} defaultHeightRatio={0.5} />);

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).toBe("500px");
    expect(dialog.style.height).toBe("400px");

    expect(dialog.style.left).toBe("250px");
    expect(dialog.style.top).toBe("200px");
  });

  it("supports custom minimum sizes", () => {
    render(
      <TestComponent
        defaultWidthRatio={0.2}
        defaultHeightRatio={0.2}
        minWidth={400}
        minHeight={300}
      />,
    );

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).toBe("400px");
    expect(dialog.style.height).toBe("300px");
  });

  it("keeps margins when the available area is smaller than the minimum size", () => {
    setViewportSize(400, 300);

    setContainerBounds({
      width: 400,
      height: 300,
    });

    render(<TestComponent />);

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.left).toBe("16px");
    expect(dialog.style.top).toBe("16px");

    expect(dialog.style.width).toBe("368px");
    expect(dialog.style.height).toBe("268px");
  });

  it("preserves the existing top-left position after the initial positioning", () => {
    render(<TestComponent />);

    setDialogBounds({
      left: 250,
      top: 175,
      width: 600,
      height: 560,
    });

    act(() => {
      ResizeObserverMock.instances[0].trigger();
    });

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.left).toBe("250px");
    expect(dialog.style.top).toBe("175px");
  });

  it("clamps an existing position when the container becomes smaller", () => {
    render(<TestComponent />);

    setDialogBounds({
      left: 700,
      top: 600,
      width: 600,
      height: 560,
    });

    setContainerBounds({
      width: 800,
      height: 600,
    });

    act(() => {
      ResizeObserverMock.instances[0].trigger();
    });

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.left).toBe("284px");
    expect(dialog.style.top).toBe("164px");
  });

  it("recalculates bounds when the window is resized", () => {
    render(<TestComponent />);

    setContainerBounds({
      width: 800,
      height: 600,
    });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).toBe("500px");
    expect(dialog.style.height).toBe("420px");
  });

  it("recalculates bounds when the window is scrolled", () => {
    render(<TestComponent />);

    setContainerBounds({
      width: 800,
      height: 600,
    });

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).toBe("500px");
    expect(dialog.style.height).toBe("420px");
  });

  it("centers the dialog when it becomes open", async () => {
    render(<TestComponent />);

    setDialogBounds({
      left: 100,
      top: 100,
      width: 600,
      height: 560,
    });

    const dialog = screen.getByTestId("dialog");

    act(() => {
      dialog.setAttribute("open", "");
    });

    await waitFor(() => {
      expect(dialog.style.left).toBe("200px");
      expect(dialog.style.top).toBe("120px");
    });
  });

  it("updates resize ratios after a native dialog resize", () => {
    render(<TestComponent />);

    setDialogBounds({
      left: 200,
      top: 120,
      width: 700,
      height: 500,
    });

    act(() => {
      ResizeObserverMock.instances[2].trigger();
    });

    act(() => {
      ResizeObserverMock.instances[0].trigger();
    });

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).toBe("700px");
    expect(dialog.style.height).toBe("500px");
  });

  it("limits dialog bounds to the viewport intersection", () => {
    setViewportSize(800, 600);

    setContainerBounds({
      left: 100,
      top: 100,
      width: 1000,
      height: 800,
    });

    render(<TestComponent />);

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.left).toBe("200px");
    expect(dialog.style.top).toBe("175px");

    expect(dialog.style.width).toBe("500px");
    expect(dialog.style.height).toBe("350px");
  });
});
