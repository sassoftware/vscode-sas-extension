import { HTMLAttributes, useRef } from "react";

const useSelectionRectangle = () => {
  const rectangleRef = useRef<HTMLDivElement>(undefined!);
  const rectDimensionsRef = useRef<
    undefined | { x: number; y: number; width: number; height: number }
  >(undefined!);
  const selectionEnabledRef = useRef<boolean>(false);
  const mouseHaveMoved = useRef<boolean>(false);

  const onMouseDown: HTMLAttributes<HTMLDivElement>["onMouseDown"] = (e) => {
    if (!e.shiftKey && !rectangleRef.current) {
      return;
    }
    rectDimensionsRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: 0,
      height: 0,
    };
    mouseHaveMoved.current = false;
    selectionEnabledRef.current = true;
  };

  const onMouseMove: HTMLAttributes<HTMLDivElement>["onMouseMove"] = (e) => {
    if (
      !rectDimensionsRef.current ||
      !rectangleRef.current ||
      !selectionEnabledRef.current
    ) {
      return;
    }
    mouseHaveMoved.current = true;
    rectangleRef.current.style.display = "block";
    const dimensions = rectDimensionsRef.current;

    const { x: xa, y: ya } = dimensions;
    const { clientX: x, clientY: y } = e;

    const left = x > xa ? xa : x;
    const width = x > xa ? x - xa : xa - x;
    const top = y > ya ? ya : y;
    const height = y > ya ? y - ya : ya - y;

    dimensions.width = width;
    dimensions.height = height;

    rectangleRef.current.style.left = `${left}px`;
    rectangleRef.current.style.top = `${top}px`;
    rectangleRef.current.style.width = `${width}px`;
    rectangleRef.current.style.height = `${height}px`;
  };

  const onMouseUp: HTMLAttributes<HTMLDivElement>["onMouseUp"] = (e) => {
    selectionEnabledRef.current = false;
    if (!mouseHaveMoved.current) {
      resetStyles();
    }
  };

  const resetStyles = () => {
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
