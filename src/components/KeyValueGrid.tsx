import type { ReactNode } from "react";
import { cn } from "../lib/utils";

interface Row {
  key?: string;
  label: ReactNode;
  value: ReactNode;
}

export function KeyValueGrid({
  rows,
  variant = "default",
}: {
  rows: Row[];
  variant?: "default" | "plain";
}) {
  return (
    <div className={cn("kv-grid", variant === "plain" && "kv-grid-plain")}>
      {rows.map((row, index) => (
        <div key={row.key ?? index} className="kv-row">
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}
