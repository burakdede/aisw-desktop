import { type ReactNode, useEffect, useRef } from "react";

type DialogSurfaceProps = {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  initialFocusSelector?: string;
  onClose: () => void;
};

const DEFAULT_FOCUS_SELECTOR =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function DialogSurface({
  ariaLabel,
  children,
  className,
  initialFocusSelector,
  onClose,
}: DialogSurfaceProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const frame = window.requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const selector = initialFocusSelector ?? DEFAULT_FOCUS_SELECTOR;
      const initialTarget = panel.querySelector<HTMLElement>(selector);
      (initialTarget ?? panel).focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [initialFocusSelector]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const focusable = getFocusableElements(panel);
    if (!focusable.length) {
      event.preventDefault();
      panel.focus();
      return;
    }

    const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const currentIndex = activeElement ? focusable.indexOf(activeElement) : -1;

    if (event.shiftKey) {
      if (currentIndex <= 0) {
        event.preventDefault();
        focusable[focusable.length - 1].focus();
      }
      return;
    }

    if (currentIndex === -1 || currentIndex === focusable.length - 1) {
      event.preventDefault();
      focusable[0].focus();
    }
  }

  return (
    <div className="quick-switch-overlay" role="presentation" onClick={onClose}>
      <section
        ref={panelRef}
        className={className}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {children}
      </section>
    </div>
  );
}

function getFocusableElements(panel: HTMLElement) {
  return [...panel.querySelectorAll<HTMLElement>(DEFAULT_FOCUS_SELECTOR)].filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.tabIndex !== -1 &&
      !element.getAttribute("aria-hidden"),
  );
}
