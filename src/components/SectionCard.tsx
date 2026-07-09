import { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  kicker?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function SectionCard({ title, kicker, actions, children }: SectionCardProps) {
  return (
    <section className="section-card">
      <header className="section-header">
        <div>
          {kicker ? <p className="section-kicker">{kicker}</p> : null}
          <h2>{title}</h2>
        </div>
        {actions ? <div className="section-actions">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
