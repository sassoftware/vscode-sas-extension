import { HTMLAttributes, MouseEvent as ReactMouseEvent, useRef } from "react";

const useSelectionRectangle = ({
  scrollContainer,
  scrollBoundaries,
}: {
  scrollContainer: string;
  scrollBoundaries: () => {
    bottom: number;
  };
}) => {
  const rectangleRef = useRef<HTMLDivElement>(undefined!);
  const rectDimensionsRef = useRef<
    undefined | { x: number; y: number; width: number; height: number }
  >(undefined!);
  const selectionEnabledRef = useRef<boolean>(false);
  const mouseHaveMoved = useRef<boolean>(false);

  const drawRectangle = (e: ReactMouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!rectDimensionsRef.current) {
      return;
    }
    const dimensions = rectDimensionsRef.current;
    const container = document.querySelector(scrollContainer) as HTMLDivElement;
    const rect = container.getBoundingClientRect()!;
    const { x: xa, y: ya } = dimensions;
    const { clientX: x, clientY: y } = e;

    const left = x > xa ? xa : x;
    const width = x > xa ? x - xa : xa - x;
    let top = y > ya ? ya : y;
    let height = y > ya ? y - ya - rect.top : rect.top - ya - y;
    top += container.scrollTop || 0;

    dimensions.width = width;
    dimensions.height = height;

    rectangleRef.current.style.display =
      height < 2 || width < 2 ? "none" : "block";
    rectangleRef.current.style.left = `${left}px`;
    rectangleRef.current.style.top = `${top}px`;
    rectangleRef.current.style.width = `${width}px`;
    rectangleRef.current.style.height = `${height}px`;
  };

  const onMouseDown: HTMLAttributes<HTMLDivElement>["onMouseDown"] = (e) => {
    if (!document.querySelector(".selection-rectangle")) {
      const div = document.createElement("div") as HTMLDivElement;
      div.classList.add("selection-rectangle");
      document.querySelector(scrollContainer)?.appendChild(div);
      rectangleRef.current = div;
    }

    if (!e.shiftKey && !rectangleRef.current) {
      return;
    }
    const container = document.querySelector(scrollContainer) as HTMLDivElement;
    const rect = container.getBoundingClientRect()!;
    rectDimensionsRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      width: 0,
      height: 0,
    };
    mouseHaveMoved.current = false;
    selectionEnabledRef.current = true;
  };

  const onMouseMove: HTMLAttributes<HTMLDivElement>["onMouseMove"] = (e) => {
    document.querySelector(".xy")!.innerHTML =
      `${e.clientX}, ${e.clientY} (body: ${document.body.clientHeight}, diff: ${document.body.clientHeight - e.clientY}))`;
    if (
      !rectDimensionsRef.current ||
      !rectangleRef.current ||
      !selectionEnabledRef.current
    ) {
      return;
    }
    mouseHaveMoved.current = true;
    drawRectangle(e);

    const boundaries = scrollBoundaries();
    if (e.clientY > boundaries.bottom) {
      beginScrollingDown(e);
    } else {
      stopScrolling();
    }
  };

  let scrollDownTimeout: ReturnType<typeof setInterval>;
  const beginScrollingDown = (
    e: ReactMouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    if (scrollDownTimeout) {
      clearInterval(scrollDownTimeout);
    }
    scrollDownTimeout = setInterval(() => {
      if (!rectDimensionsRef.current) {
        return;
      }
      const dimensions = rectDimensionsRef.current;
      const container = document.querySelector(
        scrollContainer,
      ) as HTMLDivElement;
      const scrollDistance = 25;
      container.scrollBy(0, scrollDistance);
      dimensions.y -= scrollDistance;
      drawRectangle(e);
    }, 50);
  };
  const stopScrolling = () => clearInterval(scrollDownTimeout);

  const onMouseUp: HTMLAttributes<HTMLDivElement>["onMouseUp"] = (e) => {
    stopScrolling();
    selectionEnabledRef.current = false;
    if (!mouseHaveMoved.current) {
      resetStyles();
    }
  };

  const resetStyles = () => {
    stopScrolling();
    rectangleRef.current.style.display = "none";
  };

  const dimensions = () => rectDimensionsRef.current;

  return {
    dimensions,
    dismissSelection: resetStyles,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    rectangleRef,
  };
};

export default useSelectionRectangle;
