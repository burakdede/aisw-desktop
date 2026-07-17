import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../lib/utils";

export function SheetFooter({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"footer">) {
  return (
    <footer className={cn("quick-switch-footer", className)} {...props}>
      {children}
    </footer>
  );
}
