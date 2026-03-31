import { useCallback, useRef } from "react";

export function useHorizontalScroll() {
  const ref = useRef<HTMLDivElement>(null);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    // Only hijack when scrolling is primarily vertical (mouse wheel on desktop)
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    ref.current.scrollLeft += e.deltaY;
  }, []);

  return { ref, onWheel };
}
