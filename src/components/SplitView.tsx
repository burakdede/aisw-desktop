import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function SplitView({
  className,
  primary,
  secondary,
  primaryClassName,
  secondaryClassName,
}: {
  className?: string;
  primary: ReactNode;
  secondary: ReactNode;
  primaryClassName?: string;
  secondaryClassName?: string;
}) {
  return (
    <div className={cn("desktop-split-view", className)}>
      <div className={cn("desktop-split-pane", "desktop-split-pane-primary", primaryClassName)}>
        {primary}
      </div>
      <div className={cn("desktop-split-pane", "desktop-split-pane-secondary", secondaryClassName)}>
        {secondary}
      </div>
    </div>
  );
}
