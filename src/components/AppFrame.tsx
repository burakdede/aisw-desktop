import { KeyboardEvent, ReactNode, useRef } from "react";
import { cn } from "../lib/utils";
import { BrandMark } from "./BrandMark";
import { SymbolIcon, type SymbolIconName } from "./SymbolIcon";

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
  const navButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const groups = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    acc[item.group] ??= [];
    acc[item.group].push(item);
    return acc;
  }, {});
  const orderedNavItems = nav.filter((item) => !item.disabled);

  function focusNav(id: string) {
    window.requestAnimationFrame(() => {
      navButtonRefs.current[id]?.focus();
    });
  }

  function moveSelection(currentId: string, direction: "next" | "previous" | "first" | "last") {
    if (!orderedNavItems.length) {
      return;
    }

    const currentIndex = orderedNavItems.findIndex((item) => item.id === currentId);
    if (currentIndex === -1) {
      return;
    }

    const targetIndex =
      direction === "first"
        ? 0
        : direction === "last"
          ? orderedNavItems.length - 1
          : direction === "next"
            ? Math.min(currentIndex + 1, orderedNavItems.length - 1)
            : Math.max(currentIndex - 1, 0);
    const target = orderedNavItems[targetIndex];
    if (!target || target.id === currentId) {
      return;
    }

    onSelectNav(target.id);
    focusNav(target.id);
  }

  function handleNavKeyDown(event: KeyboardEvent<HTMLButtonElement>, item: NavItem) {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        moveSelection(item.id, "next");
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        moveSelection(item.id, "previous");
        break;
      case "Home":
        event.preventDefault();
        moveSelection(item.id, "first");
        break;
      case "End":
        event.preventDefault();
        moveSelection(item.id, "last");
        break;
      default:
        break;
    }
  }

  return (
    <main className={cn("app-shell", mode === "setup" ? "app-shell-setup-window" : "app-shell-window")}>
      <div className={cn("layout-shell", mode === "setup" && "layout-shell-setup")}>
        {mode === "setup" ? null : (
          <aside className="sidebar">
            <div className="sidebar-scroll">
              <div className="sidebar-brand">
                <div className="brand-lockup">
                  <BrandMark size={32} />
                  <div className="sidebar-brand-copy">
                    <h1 className="sidebar-title">AI Switcher</h1>
                  </div>
                </div>
              </div>
              <nav className="nav-list" aria-label="Primary">
                {Object.entries(groups).map(([group, items]) => (
                  <div key={group} className="nav-group">
                    <p className="nav-group-label">{group}</p>
                    <div className="nav-group-items">
                      {items.map((item) => (
                        <button
                          key={item.id}
                          ref={(node) => {
                            navButtonRefs.current[item.id] = node;
                          }}
                          className={cn("nav-button", activeNav === item.id && "nav-button-active")}
                          disabled={item.disabled}
                          aria-current={activeNav === item.id ? "page" : undefined}
                          aria-keyshortcuts={item.shortcut?.replace("⌘", "Meta+").replace("⌃", "Control+")}
                          onClick={() => onSelectNav(item.id)}
                          onKeyDown={(event) => handleNavKeyDown(event, item)}
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
            <div className="window-toolbar-leading" data-tauri-drag-region>
              <div className="window-toolbar-meta">
                <p className="window-toolbar-kicker">{mode === "setup" ? "Welcome" : "AI Switch"}</p>
                <div className="window-toolbar-copy">
                  <h2>{title}</h2>
                  {detail ? <p className="window-toolbar-subtitle">{detail}</p> : null}
                </div>
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
  return <SymbolIcon name={id as SymbolIconName} size="sm" />;
}
