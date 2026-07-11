import type { ReactNode } from "react";

type SourceListPanelProps = {
  kicker?: string;
  title: string;
  badge?: ReactNode;
  note?: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
  listLabel?: string;
  listRole?: string;
};

export function SourceListPanel({
  kicker,
  title,
  badge,
  note,
  meta,
  children,
  className,
  listLabel,
  listRole,
}: SourceListPanelProps) {
  return (
    <article className={["source-list-panel", className].filter(Boolean).join(" ")}>
      <div className="source-list-header">
        <div>
          {kicker ? <p className="card-kicker">{kicker}</p> : null}
          <h3>{title}</h3>
        </div>
        {badge ? <div className="source-list-badge">{badge}</div> : null}
      </div>
      {note ? <p className="inline-note source-list-note">{note}</p> : null}
      {meta ? <div className="source-list-meta">{meta}</div> : null}
      <div className="desktop-source-list" aria-label={listLabel} role={listRole}>
        {children}
      </div>
    </article>
  );
}
