import { useRef } from "react";

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

import { expect } from "chai";
import sinon from "sinon";

import useResponsiveDialog from "../../src/webview/ManageColumns/useResponsiveDialog";

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

type Bounds = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type TestComponentProps = {
  defaultWidthRatio?: number;
  defaultHeightRatio?: number;
  minWidth?: number;
  minHeight?: number;
};

let containerBounds: Bounds;
let dialogBounds: Bounds;

const createRect = ({ left, top, width, height }: Bounds): DOMRect =>
  new DOMRect(left, top, width, height);

const TestComponent = ({
  defaultWidthRatio,
  defaultHeightRatio,
  minWidth,
  minHeight,
}: TestComponentProps) => {
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
  let sandbox: sinon.SinonSandbox;
  let originalResizeObserver: typeof ResizeObserver | undefined;

  before(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = ResizeObserverMock;
  });

  after(() => {
    if (originalResizeObserver) {
      globalThis.ResizeObserver = originalResizeObserver;
    } else {
      Reflect.deleteProperty(globalThis, "ResizeObserver");
    }
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    ResizeObserverMock.instances.length = 0;

    setViewportSize();
    setContainerBounds();
    setDialogBounds();

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });

    sandbox
      .stub(HTMLElement.prototype, "getBoundingClientRect")
      .callsFake(function (this: HTMLElement) {
        if (this.dataset.testid === "container") {
          return createRect(containerBounds);
        }

        if (this.dataset.testid === "dialog") {
          return createRect(dialogBounds);
        }

        return new DOMRect();
      });
  });

  afterEach(() => {
    cleanup();
    sandbox.restore();
  });

  it("sizes and centers the dialog inside the container", () => {
    render(<TestComponent />);

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).to.equal("600px");
    expect(dialog.style.height).to.equal("560px");

    expect(dialog.style.left).to.equal("200px");
    expect(dialog.style.top).to.equal("120px");
  });

  it("applies the default minimum width and height", () => {
    setContainerBounds({
      width: 700,
      height: 500,
    });

    render(<TestComponent />);

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).to.equal("500px");
    expect(dialog.style.height).to.equal("350px");
  });

  it("supports custom size ratios", () => {
    render(<TestComponent defaultWidthRatio={0.5} defaultHeightRatio={0.5} />);

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).to.equal("500px");
    expect(dialog.style.height).to.equal("400px");

    expect(dialog.style.left).to.equal("250px");
    expect(dialog.style.top).to.equal("200px");
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

    expect(dialog.style.left).to.equal("250px");
    expect(dialog.style.top).to.equal("175px");
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

    expect(dialog.style.width).to.equal("500px");
    expect(dialog.style.height).to.equal("420px");
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
      expect(dialog.style.left).to.equal("200px");
      expect(dialog.style.top).to.equal("120px");
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

    // The third ResizeObserver watches the dialog itself.
    act(() => {
      ResizeObserverMock.instances[2].trigger();
    });

    // The first ResizeObserver watches the container.
    act(() => {
      ResizeObserverMock.instances[0].trigger();
    });

    const dialog = screen.getByTestId("dialog");

    expect(dialog.style.width).to.equal("700px");
    expect(dialog.style.height).to.equal("500px");
  });
});
