import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/utils";
import { readViewportHeight, readViewportWidth } from "../lib/viewport-size";

export function AnchoredMenu({
  anchorRef,
  children,
  className,
  align = "end",
  offset = 6,
  boundaryAttribute,
  containmentSelector,
  ...rest
}: {
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
  offset?: number;
  boundaryAttribute?: string;
  containmentSelector?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({
    opacity: 0,
    visibility: "hidden",
    pointerEvents: "none",
  });

  useLayoutEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let frame = 0;

    const updatePosition = () => {
      const anchor = anchorRef.current;
      const menu = menuRef.current;
      if (!anchor || !menu) {
        return;
      }

      const anchorRect = anchor.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const containmentElement = containmentSelector ? anchor.closest(containmentSelector) : null;
      const margin = 8;
      const containmentRect = containmentElement?.getBoundingClientRect();
      const viewportMinLeft = margin;
      const viewportMaxRight = readViewportWidth(0) - margin;
      const viewportMinTop = margin;
      const viewportMaxBottom = readViewportHeight(0) - margin;
      const containmentMinLeft = containmentRect ? containmentRect.left + margin : viewportMinLeft;
      const containmentMaxRight = containmentRect ? containmentRect.right - margin : viewportMaxRight;
      const containmentMinTop = containmentRect ? containmentRect.top + margin : viewportMinTop;
      const containmentMaxBottom = containmentRect ? containmentRect.bottom - margin : viewportMaxBottom;
      const minLeft = Math.max(viewportMinLeft, containmentMinLeft);
      const maxRight = Math.min(viewportMaxRight, containmentMaxRight);
      const minTop = Math.max(viewportMinTop, containmentMinTop);
      const maxBottom = Math.min(viewportMaxBottom, containmentMaxBottom);

      let left = align === "start" ? anchorRect.left : anchorRect.right - menuRect.width;
      left = Math.max(minLeft, Math.min(left, maxRight - menuRect.width));

      const belowTop = anchorRect.bottom + offset;
      const aboveTop = anchorRect.top - menuRect.height - offset;
      const top =
        belowTop + menuRect.height <= maxBottom || aboveTop < minTop
          ? belowTop
          : aboveTop;

      setStyle({
        left,
        top: Math.max(minTop, Math.min(top, maxBottom - menuRect.height)),
        opacity: 1,
        visibility: "visible",
        pointerEvents: "auto",
      });
    };

    const queueUpdate = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePosition);
    };

    updatePosition();
    queueUpdate();
    window.addEventListener("resize", queueUpdate);
    window.addEventListener("scroll", queueUpdate, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", queueUpdate);
      window.removeEventListener("scroll", queueUpdate, true);
    };
  }, [align, anchorRef, containmentSelector, offset]);

  if (typeof document === "undefined") {
    return null;
  }

  const boundaryProps = boundaryAttribute ? { [boundaryAttribute]: "" } : {};

  return createPortal(
    <div
      ref={menuRef}
      className={cn("anchored-menu-surface", className)}
      style={style}
      {...boundaryProps}
      {...rest}
    >
      {children}
    </div>,
    document.body,
  );
}
