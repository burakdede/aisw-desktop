import type { MutableRefObject } from "react";
import { AnchoredMenu } from "./AnchoredMenu";
import { cn } from "../lib/utils";

export type OverflowMenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
};

export function OverflowMenuButton({
  open,
  anchorRef,
  align = "start",
  triggerAriaLabel,
  triggerClassName,
  menuAriaLabel,
  items,
  containmentSelector,
  boundaryAttribute = "data-profile-row-actions",
  onToggle,
}: {
  open: boolean;
  anchorRef: MutableRefObject<HTMLButtonElement | null>;
  align?: "start" | "end";
  triggerAriaLabel: string;
  triggerClassName?: string;
  menuAriaLabel: string;
  items: readonly OverflowMenuItem[];
  containmentSelector?: string;
  boundaryAttribute?: string;
  onToggle: () => void;
}) {
  const boundaryProps = boundaryAttribute ? { [boundaryAttribute]: "" } : {};

  return (
    <div className="profile-row-actions" {...boundaryProps}>
      <button
        ref={(node) => {
          anchorRef.current = node;
        }}
        className={cn("ghost-button profile-row-actions-trigger", triggerClassName)}
        type="button"
        aria-label={triggerAriaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        •••
      </button>
      {open && items.length ? (
        <AnchoredMenu
          anchorRef={anchorRef}
          className="profile-row-actions-menu"
          align={align}
          boundaryAttribute={boundaryAttribute}
          containmentSelector={containmentSelector}
          role="menu"
          aria-label={menuAriaLabel}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={item.danger ? "profile-row-actions-danger" : undefined}
              onClick={item.onSelect}
            >
              {item.label}
            </button>
          ))}
        </AnchoredMenu>
      ) : null}
    </div>
  );
}
