import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../lib/utils";

export function ButtonRow({
  children,
  className,
  ...props
}: {
  children: ReactNode;
  className?: string;
} & ComponentPropsWithoutRef<"div">) {
  return (
    <div className={cn("button-row", className)} {...props}>
      {children}
    </div>
  );
}
