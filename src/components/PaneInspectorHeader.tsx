import type { ReactNode } from "react";
import { cn } from "../lib/utils";

type PaneInspectorHeaderProps = {
  title: ReactNode;
  supporting?: ReactNode;
  trailing?: ReactNode;
  backLabel?: string;
  onBack?: () => void;
  className?: string;
  titleBlockClassName?: string;
  titleClassName?: string;
  backButtonClassName?: string;
};

export function PaneInspectorHeader({
  title,
  supporting,
  trailing,
  backLabel,
  onBack,
  className,
  titleBlockClassName,
  titleClassName,
  backButtonClassName,
}: PaneInspectorHeaderProps) {
  return (
    <header className={className}>
      <div className={titleBlockClassName}>
        {onBack && backLabel ? (
          <button
            className={cn("ghost-button", backButtonClassName)}
            type="button"
            onClick={onBack}
          >
            {backLabel}
          </button>
        ) : null}
        <h3 className={titleClassName}>{title}</h3>
        {supporting ?? null}
      </div>
      {trailing ?? null}
    </header>
  );
}
