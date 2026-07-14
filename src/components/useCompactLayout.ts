import { useEffect, useState, type RefObject } from "react";
import { measuredPaneWidth } from "./measuredPaneWidth";

export function useCompactLayout(
  rootRef: RefObject<HTMLDivElement | null>,
  breakpoint: number,
) {
  const [compactLayout, setCompactLayout] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rootElement = rootRef.current;
    const updateLayout = () => {
      setCompactLayout(measuredPaneWidth(rootRef.current, breakpoint) < breakpoint);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);

    const observer =
      typeof ResizeObserver !== "undefined" && rootElement
        ? new ResizeObserver(() => updateLayout())
        : null;
    if (observer && rootElement) {
      observer.observe(rootElement);
    }

    return () => {
      window.removeEventListener("resize", updateLayout);
      observer?.disconnect();
    };
  }, [breakpoint, rootRef]);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    setCompactLayout(measuredPaneWidth(rootRef.current, breakpoint) < breakpoint);
  });

  return compactLayout;
}
