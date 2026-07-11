import { ReactNode } from "react";
import { cn } from "../lib/utils";
import { BrandMark } from "./BrandMark";

interface NavItem {
  id: string;
  label: string;
  group: string;
  disabled?: boolean;
  shortcut?: string;
}

interface AppFrameProps {
  title: string;
  subtitle?: string;
  detail?: string;
  nav: NavItem[];
  activeNav: string;
  onSelectNav: (id: string) => void;
  statusBadge?: ReactNode;
  toolbar?: ReactNode;
  mode?: "standard" | "setup";
  children: ReactNode;
}

export function AppFrame({
  title,
  subtitle,
  detail,
  nav,
  activeNav,
  onSelectNav,
  statusBadge,
  toolbar,
  mode = "standard",
  children,
}: AppFrameProps) {
  const groups = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    acc[item.group] ??= [];
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <main className={cn("app-shell", mode === "setup" ? "app-shell-setup-window" : "app-shell-window")}>
      <div className={cn("layout-shell", mode === "setup" && "layout-shell-setup")}>
        {mode === "setup" ? null : (
          <aside className="sidebar">
            <div className="sidebar-scroll">
              <div className="sidebar-brand">
                <div className="brand-lockup">
                  <BrandMark />
                  <div className="sidebar-brand-copy">
                    <p className="eyebrow">Desktop Control Center</p>
                    <h1 className="sidebar-title">AI Switch</h1>
                  </div>
                </div>
                <p className="sidebar-badge">Local account switching</p>
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
                          aria-keyshortcuts={item.shortcut?.replace("⌘", "Meta+").replace("⌃", "Control+")}
                          onClick={() => onSelectNav(item.id)}
                        >
                          <span className="nav-button-icon" aria-hidden="true">
                            <SidebarIcon id={item.id} />
                          </span>
                          <span className="nav-button-label">{item.label}</span>
                          {item.shortcut ? (
                            <span className="nav-button-shortcut" aria-hidden="true">
                              {item.shortcut}
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
            {statusBadge ? <div className="status-badge sidebar-status-card">{statusBadge}</div> : null}
          </aside>
        )}
        <div className={cn("content-shell", mode === "setup" && "content-shell-setup")}>
          <header className="window-toolbar">
            <div className="window-toolbar-meta">
              <p className="window-toolbar-kicker">{mode === "setup" ? "Welcome" : "AI Switch"}</p>
              <div className="window-toolbar-copy">
                <h2>{title}</h2>
                {detail ? <p className="window-toolbar-subtitle">{detail}</p> : null}
              </div>
            </div>
            {toolbar ? <div className="window-toolbar-actions toolbar-cluster">{toolbar}</div> : null}
          </header>
          <div className="content-main">
            <div className="content-stage">{children}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function SidebarIcon({ id }: { id: string }) {
  switch (id) {
    case "overview":
      return (
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M3 4.5H13" />
          <path d="M3 8H13" />
          <path d="M3 11.5H9.75" />
        </svg>
      );
    case "profiles":
      return (
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="6" cy="5.25" r="2.25" />
          <path d="M2.75 12.5C3.35 10.65 4.5 9.75 6 9.75C7.5 9.75 8.65 10.65 9.25 12.5" />
          <path d="M10.5 6.25C11.65 6.25 12.6 7 13.35 8.5" />
        </svg>
      );
    case "sets":
      return (
        <svg viewBox="0 0 16 16" fill="none">
          <rect x="2.5" y="3" width="11" height="3" rx="1.2" />
          <rect x="2.5" y="7.25" width="11" height="3" rx="1.2" />
          <rect x="2.5" y="11.5" width="7.5" height="2" rx="1" />
        </svg>
      );
    case "diagnostics":
      return (
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M8 3V8L11 10" />
          <circle cx="8" cy="8" r="5.25" />
        </svg>
      );
    case "backups":
      return (
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M4 5.25H12" />
          <path d="M5 3.5H11V5.25H5V3.5Z" />
          <path d="M4.5 5.25V11.5C4.5 12.0523 4.94772 12.5 5.5 12.5H10.5C11.0523 12.5 11.5 12.0523 11.5 11.5V5.25" />
        </svg>
      );
    case "activity":
      return (
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M3 10.75L5.25 8.5L7.25 9.75L10.5 6.5L13 8" />
          <path d="M12.25 5.25H10V3" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2.1" />
          <path d="M8 2.75V4" />
          <path d="M8 12V13.25" />
          <path d="M12 8H13.25" />
          <path d="M2.75 8H4" />
          <path d="M11.65 4.35L10.7 5.3" />
          <path d="M5.3 10.7L4.35 11.65" />
          <path d="M11.65 11.65L10.7 10.7" />
          <path d="M5.3 5.3L4.35 4.35" />
        </svg>
      );
    default:
      return null;
  }
}
