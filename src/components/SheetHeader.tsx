import type { ReactNode } from "react";
import { cn } from "../lib/utils";

export function SheetHeader({
  kicker,
  title,
  detail,
  actions,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("quick-switch-header", className)}>
      <div>
        {kicker ? <p className="card-kicker">{kicker}</p> : null}
        <h3>{title}</h3>
        {detail ? <p className="inline-note">{detail}</p> : null}
      </div>
      {actions ?? null}
    </div>
  );
}
