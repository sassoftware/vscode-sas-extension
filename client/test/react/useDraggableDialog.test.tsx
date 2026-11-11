import { useRef } from "react";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { expect } from "chai";

import useDraggableDialog from "../../src/webview/ManageColumns/useDraggableDialog";

let capturedPointers = new WeakMap<HTMLElement, Set<number>>();

const getCapturedPointers = (element: HTMLElement) => {
  let pointers = capturedPointers.get(element);

  if (!pointers) {
    pointers = new Set<number>();
    capturedPointers.set(element, pointers);
  }

  return pointers;
};

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

type BoundsOptions = {
  containerLeft?: number;
  containerTop?: number;
  containerWidth?: number;
  containerHeight?: number;
  dialogLeft?: number;
  dialogTop?: number;
  dialogWidth?: number;
  dialogHeight?: number;
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
}: BoundsOptions = {}) => {
  const container = screen.getByTestId("container");
  const dialog = screen.getByTestId("dialog");

  container.getBoundingClientRect = () =>
    new DOMRect(containerLeft, containerTop, containerWidth, containerHeight);

  dialog.getBoundingClientRect = () =>
    new DOMRect(dialogLeft, dialogTop, dialogWidth, dialogHeight);
};

describe("useDraggableDialog", () => {
  const originalSetPointerCapture = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "setPointerCapture",
  );

  const originalHasPointerCapture = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "hasPointerCapture",
  );

  const originalReleasePointerCapture = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    "releasePointerCapture",
  );

  before(() => {
    Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
      configurable: true,
      value: function (this: HTMLElement, pointerId: number) {
        getCapturedPointers(this).add(pointerId);
      },
    });

    Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
      configurable: true,
      value: function (this: HTMLElement, pointerId: number) {
        return getCapturedPointers(this).has(pointerId);
      },
    });

    Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
      configurable: true,
      value: function (this: HTMLElement, pointerId: number) {
        getCapturedPointers(this).delete(pointerId);
      },
    });
  });

  beforeEach(() => {
    capturedPointers = new WeakMap<HTMLElement, Set<number>>();
  });

  afterEach(() => {
    cleanup();
  });

  after(() => {
    const restore = (
      name: string,
      descriptor: PropertyDescriptor | undefined,
    ) => {
      if (descriptor) {
        Object.defineProperty(HTMLElement.prototype, name, descriptor);
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, name);
      }
    };

    restore("setPointerCapture", originalSetPointerCapture);
    restore("hasPointerCapture", originalHasPointerCapture);
    restore("releasePointerCapture", originalReleasePointerCapture);
  });

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

    expect(dialog.style.left).to.equal("300px");
    expect(dialog.style.top).to.equal("200px");
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

    expect(dialog.style.left).to.equal("");
    expect(dialog.style.top).to.equal("");
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

    expect(dialog.style.left).to.equal("");
    expect(dialog.style.top).to.equal("");
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

    expect(dialog.style.left).to.equal("300px");
    expect(dialog.style.top).to.equal("200px");

    expect(dialog.style.maxWidth).to.equal("684px");
    expect(dialog.style.maxHeight).to.equal("584px");
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

    expect(dialog.style.left).to.equal("300px");

    fireEvent.pointerUp(header, {
      pointerId: 1,
    });

    fireEvent.pointerMove(header, {
      pointerId: 1,
      clientX: 500,
      clientY: 350,
    });

    expect(dialog.style.left).to.equal("300px");
    expect(dialog.style.top).to.equal("200px");
  });
});
