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
  const [style, setStyle] = useState<CSSProperties>({ opacity: 0 });

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
      const containmentRect = containmentElement?.getBoundingClientRect();
      const minLeft = (containmentRect?.left ?? 0) + 8;
      const maxRight = (containmentRect?.right ?? readViewportWidth(0)) - 8;
      const minTop = (containmentRect?.top ?? 0) + 8;
      const maxBottom = (containmentRect?.bottom ?? readViewportHeight(0)) - 8;
      const margin = 8;

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
      });
    };

    const queueUpdate = () => {
      cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePosition);
    };

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
