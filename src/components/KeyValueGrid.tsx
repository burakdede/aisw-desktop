interface Row {
  label: string;
  value: string;
}

export function KeyValueGrid({ rows }: { rows: Row[] }) {
  return (
    <div className="kv-grid">
      {rows.map((row) => (
        <div key={row.label} className="kv-row">
          <span>{row.label}</span>
          <strong>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}
