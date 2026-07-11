type DesktopStatusStripItem = {
  label: string;
  value: string;
  note?: string;
  pills?: string[];
};

export function DesktopStatusStrip({
  ariaLabel,
  items,
}: {
  ariaLabel: string;
  items: DesktopStatusStripItem[];
}) {
  return (
    <div className="desktop-status-strip" aria-label={ariaLabel}>
      {items.map((item) => (
        <article key={item.label} className="desktop-status-card">
          <p className="card-kicker">{item.label}</p>
          <p className="desktop-status-value">{item.value}</p>
          {item.pills?.length ? (
            <div className="desktop-status-pill-stack">
              {item.pills.map((pill) => (
                <span key={pill} className="status-pill">
                  {pill}
                </span>
              ))}
            </div>
          ) : item.note ? (
            <p className="inline-note">{item.note}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}
