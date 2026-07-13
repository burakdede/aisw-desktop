import type { ReactNode } from "react";

interface Row {
  key?: string;
  label: ReactNode;
  value: ReactNode;
}

export function KeyValueGrid({ rows }: { rows: Row[] }) {
  return (
    <div className="kv-grid">
      {rows.map((row, index) => (
        <div key={row.key ?? index} className="kv-row">
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}
