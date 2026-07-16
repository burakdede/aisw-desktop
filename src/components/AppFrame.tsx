import { KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";
import { BrandMark } from "./BrandMark";
import {
  APP_FRAME_COPY,
  appFrameNavDirectionForKey,
  defaultSidebarOpen,
  isCompactSidebarWidth,
  nextAppFrameNavItemId,
} from "./app-frame-display";
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
  const [compactSidebar, setCompactSidebar] = useState(() => isCompactSidebarWidth(window.innerWidth));
  const [sidebarOpen, setSidebarOpen] = useState(() => defaultSidebarOpen(window.innerWidth));
  const groups = nav.reduce<Record<string, NavItem[]>>((acc, item) => {
    acc[item.group] ??= [];
    acc[item.group].push(item);
    return acc;
  }, {});

  function focusNav(id: string) {
    window.requestAnimationFrame(() => {
      navButtonRefs.current[id]?.focus();
    });
  }

  function moveSelection(currentId: string, direction: "next" | "previous" | "first" | "last") {
    const targetId = nextAppFrameNavItemId(currentId, nav, direction);
    if (!targetId || targetId === currentId) {
      return;
    }

    onSelectNav(targetId);
    focusNav(targetId);
  }

  function handleNavKeyDown(event: KeyboardEvent<HTMLButtonElement>, item: NavItem) {
    const direction = appFrameNavDirectionForKey(
      event.key,
      event.altKey || event.ctrlKey || event.metaKey,
    );
    if (!direction) {
      return;
    }

    event.preventDefault();
    moveSelection(item.id, direction);
  }

  useEffect(() => {
    function syncSidebarLayout() {
      const nextCompact = isCompactSidebarWidth(window.innerWidth);
      setCompactSidebar(nextCompact);
      setSidebarOpen((current) => {
        if (!nextCompact) {
          return true;
        }
        return current;
      });
    }

    syncSidebarLayout();
    window.addEventListener("resize", syncSidebarLayout);
    return () => window.removeEventListener("resize", syncSidebarLayout);
  }, []);

  useEffect(() => {
    if (!compactSidebar) {
      return;
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [compactSidebar]);

  function handleSelectNav(id: string) {
    onSelectNav(id);
    if (compactSidebar) {
      setSidebarOpen(false);
    }
  }

  const showSidebar = mode !== "setup" && (!compactSidebar || sidebarOpen);

  return (
    <main className={cn("app-shell", mode === "setup" ? "app-shell-setup-window" : "app-shell-window")}>
      <div
        className={cn(
          "layout-shell",
          mode === "setup" && "layout-shell-setup",
          compactSidebar && "layout-shell-compact",
        )}
      >
        {compactSidebar && sidebarOpen && mode !== "setup" ? (
          <button
            type="button"
            className="sidebar-scrim"
            aria-label={APP_FRAME_COPY.closeSidebarLabel}
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        {mode === "setup" || !showSidebar ? null : (
          <aside
            id="app-sidebar"
            className={cn(
              "sidebar",
              compactSidebar && "sidebar-compact",
              compactSidebar && sidebarOpen && "sidebar-compact-open",
            )}
          >
            <div className="sidebar-scroll">
              <div className="sidebar-brand">
                <div className="brand-lockup">
                  <BrandMark size={42} />
                  <div className="sidebar-brand-copy">
                    <h1 className="sidebar-title">AI Switcher</h1>
                  </div>
                </div>
              </div>
              <nav className="nav-list" aria-label={APP_FRAME_COPY.primaryNavAriaLabel}>
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
                          onClick={() => handleSelectNav(item.id)}
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
              {mode !== "setup" && compactSidebar ? (
                <button
                  type="button"
                  className="ghost-button icon-button sidebar-toggle"
                  aria-label={
                    sidebarOpen ? APP_FRAME_COPY.hideSidebarLabel : APP_FRAME_COPY.showSidebarLabel
                  }
                  aria-expanded={showSidebar}
                  aria-controls="app-sidebar"
                  onClick={() => setSidebarOpen((current) => !current)}
                >
                  <SymbolIcon name="sidebar" size="sm" />
                </button>
              ) : null}
              <div className="window-toolbar-meta">
                {mode === "setup" ? <p className="window-toolbar-kicker">{APP_FRAME_COPY.setupKicker}</p> : null}
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
