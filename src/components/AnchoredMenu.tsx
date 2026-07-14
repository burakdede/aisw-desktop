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

export function AnchoredMenu({
  anchorRef,
  children,
  className,
  align = "end",
  offset = 6,
  boundaryAttribute,
  ...rest
}: {
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
  offset?: number;
  boundaryAttribute?: string;
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
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const margin = 8;

      let left = align === "start" ? anchorRect.left : anchorRect.right - menuRect.width;
      left = Math.max(margin, Math.min(left, viewportWidth - menuRect.width - margin));

      const belowTop = anchorRect.bottom + offset;
      const aboveTop = anchorRect.top - menuRect.height - offset;
      const top =
        belowTop + menuRect.height <= viewportHeight - margin || aboveTop < margin
          ? belowTop
          : aboveTop;

      setStyle({
        left,
        top: Math.max(margin, Math.min(top, viewportHeight - menuRect.height - margin)),
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
  }, [align, anchorRef, offset]);

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
