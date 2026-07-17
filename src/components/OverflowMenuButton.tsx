import type { MutableRefObject, ReactNode } from "react";
import { SFEllipsisCircle } from "sf-symbols-lib/monochrome/SFEllipsisCircle";
import { AnchoredMenu } from "./AnchoredMenu";
import { cn } from "../lib/utils";

export type OverflowMenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
  danger?: boolean;
  separated?: boolean;
};

export const OVERFLOW_MENU_ICON_SIZE = 16;

export function OverflowMenuIcon() {
  return <SFEllipsisCircle aria-hidden="true" focusable="false" size={OVERFLOW_MENU_ICON_SIZE} />;
}

export function OverflowMenuButton({
  open,
  anchorRef,
  setAnchorNode,
  align = "start",
  triggerAriaLabel,
  triggerClassName,
  containerClassName,
  triggerContent = <OverflowMenuIcon />,
  menuAriaLabel,
  items,
  containmentSelector,
  boundaryAttribute = "data-profile-row-actions",
  onToggle,
}: {
  open: boolean;
  anchorRef: MutableRefObject<HTMLButtonElement | null>;
  setAnchorNode?: (node: HTMLButtonElement | null) => void;
  align?: "start" | "end";
  triggerAriaLabel: string;
  triggerClassName?: string;
  containerClassName?: string;
  triggerContent?: ReactNode;
  menuAriaLabel: string;
  items: readonly OverflowMenuItem[];
  containmentSelector?: string;
  boundaryAttribute?: string;
  onToggle: () => void;
}) {
  const boundaryProps = boundaryAttribute ? { [boundaryAttribute]: "" } : {};

  return (
    <div className={cn("profile-row-actions", containerClassName)} {...boundaryProps}>
      <button
        ref={(node) => {
          anchorRef.current = node;
          setAnchorNode?.(node);
        }}
        className={cn("ghost-button profile-row-actions-trigger", triggerClassName)}
        type="button"
        aria-label={triggerAriaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggle}
      >
        {triggerContent}
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
            <div key={item.key}>
              {item.separated ? <div className="menu-divider" aria-hidden="true" /> : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={item.danger ? "profile-row-actions-danger" : undefined}
                onClick={item.onSelect}
              >
                {item.label}
              </button>
            </div>
          ))}
        </AnchoredMenu>
      ) : null}
    </div>
  );
}
