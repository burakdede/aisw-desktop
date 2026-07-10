import { ReactNode } from "react";
import { cn } from "../lib/utils";

interface NavItem {
  id: string;
  label: string;
  disabled?: boolean;
}

interface AppFrameProps {
  title: string;
  subtitle: string;
  nav: NavItem[];
  activeNav: string;
  onSelectNav: (id: string) => void;
  statusBadge?: ReactNode;
  children: ReactNode;
}

export function AppFrame({
  title,
  subtitle,
  nav,
  activeNav,
  onSelectNav,
  statusBadge,
  children,
}: AppFrameProps) {
  return (
    <div className="layout-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">AISW Desktop</p>
          <h1 className="sidebar-title">{title}</h1>
          <p className="sidebar-copy">{subtitle}</p>
        </div>
        <nav className="nav-list" aria-label="Primary">
          {nav.map((item) => (
            <button
              key={item.id}
              className={cn("nav-button", activeNav === item.id && "nav-button-active")}
              disabled={item.disabled}
              onClick={() => onSelectNav(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {statusBadge ? <div className="status-badge">{statusBadge}</div> : null}
      </aside>
      <div className="content-shell">{children}</div>
    </div>
  );
}
