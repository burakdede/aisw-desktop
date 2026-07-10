import { ReactNode } from "react";
import { cn } from "../lib/utils";
import { BrandMark } from "./BrandMark";

interface NavItem {
  id: string;
  label: string;
  group: string;
  disabled?: boolean;
}

interface AppFrameProps {
  title: string;
  subtitle?: string;
  nav: NavItem[];
  activeNav: string;
  onSelectNav: (id: string) => void;
  statusBadge?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}

export function AppFrame({
  title,
  subtitle,
  nav,
  activeNav,
  onSelectNav,
  statusBadge,
  toolbar,
  children,
}: AppFrameProps) {
  const groups = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    acc[item.group] ??= [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <main className="app-shell app-shell-window">
      <div className="layout-shell">
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-lockup">
              <BrandMark />
              <div>
                <p className="eyebrow">AI Switch</p>
                <h1 className="sidebar-title">AI Switch</h1>
              </div>
            </div>
            {subtitle ? <p className="sidebar-copy">{subtitle}</p> : null}
          </div>
          <nav className="nav-list" aria-label="Primary">
            {Object.entries(groups).map(([group, items]) => (
              <div key={group} className="nav-group">
                <p className="nav-group-label">{group}</p>
                <div className="nav-group-items">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      className={cn("nav-button", activeNav === item.id && "nav-button-active")}
                      disabled={item.disabled}
                      onClick={() => onSelectNav(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          {statusBadge ? <div className="status-badge">{statusBadge}</div> : null}
        </aside>
        <div className="content-shell">
          <header className="window-toolbar">
            <div className="window-toolbar-copy">
              <p className="window-toolbar-kicker">Local control center</p>
              <h2>{title}</h2>
            </div>
            {toolbar ? <div className="window-toolbar-actions">{toolbar}</div> : null}
          </header>
          <div className="content-main">{children}</div>
        </div>
      </div>
    </main>
  );
}
