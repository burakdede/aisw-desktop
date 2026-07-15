import { useEffect, useMemo, useRef, useState } from "react";
import { DialogSurface } from "./DialogSurface";
import { SearchField } from "./SearchField";
import { ToolBrand } from "./ToolBrand";
import type { AppBootstrap, AppSnapshot, DesktopSettings } from "../lib/schemas";
import { resolveGlobalStateMode, supportedStateModes } from "../features/shared/state-modes";
import { useDesktopActions } from "../features/shared/useDesktopActions";
import {
  buildQuickSwitchItems,
  quickSwitchNoMatchesDescription,
  quickSwitchResultCountLabel,
  quickSwitchStatusCopy,
  type QuickSwitchItem,
} from "./quick-switch-display";

type QuickSwitchPaletteProps = {
  open: boolean;
  onClose: () => void;
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
};

export function QuickSwitchPalette({
  open,
  onClose,
  settings,
  snapshot,
  toolCapabilities,
}: QuickSwitchPaletteProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { activateProfileSetMutation, useAllProfilesMutation, useProfileMutation, mutationLock } =
    useDesktopActions();

  const items = useMemo(
    () => buildQuickSwitchItems(settings, snapshot),
    [settings, snapshot],
  );
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return items;
    }
    return items.filter((item) => item.searchText.includes(needle));
  }, [items, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setSelectedIndex(0);
    const focusSearchField = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    const frame = window.requestAnimationFrame(focusSearchField);
    const timeout = window.setTimeout(focusSearchField, 40);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (!filteredItems.length) {
      setSelectedIndex(0);
      return;
    }
    if (selectedIndex >= filteredItems.length) {
      setSelectedIndex(filteredItems.length - 1);
    }
  }, [filteredItems, open, selectedIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const selectedItem = filteredItems[selectedIndex];
    if (!selectedItem) {
      return;
    }
    const selectedNode = optionRefs.current[selectedItem.id];
    if (selectedNode && typeof selectedNode.scrollIntoView === "function") {
      selectedNode.scrollIntoView({
        block: "nearest",
      });
    }
  }, [filteredItems, open, selectedIndex]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((current) =>
          filteredItems.length ? (current + 1) % filteredItems.length : 0,
        );
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((current) =>
          filteredItems.length ? (current - 1 + filteredItems.length) % filteredItems.length : 0,
        );
        return;
      }
      if (event.key === "Enter") {
        if (!filteredItems.length) {
          return;
        }
        event.preventDefault();
        if (event.metaKey) {
          activateMatchingItem(filteredItems[selectedIndex]);
          return;
        }
        activateItem(filteredItems[selectedIndex]);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [filteredItems, onClose, open, selectedIndex]);

  function activateItem(item: QuickSwitchItem) {
    if (mutationLock.isBusy) {
      return;
    }
    if (item.kind === "profile_set") {
      activateProfileSetMutation.mutate({
        name: item.name,
        label: item.label ?? item.title,
      });
      onClose();
      return;
    }
    if (item.kind === "shared_profile") {
      useAllProfilesMutation.mutate({
        profile: item.profile,
        stateMode: resolveGlobalStateMode(snapshot),
        label: item.label,
      });
      onClose();
      return;
    }
    const stateModes = supportedStateModes(item.tool, toolCapabilities);
    useProfileMutation.mutate({
      tool: item.tool,
      profile: item.profile,
      stateMode: stateModes.length ? stateModes[0] : null,
      label: item.label,
    });
    onClose();
  }

  function activateMatchingItem(item: QuickSwitchItem) {
    if (mutationLock.isBusy) {
      return;
    }
    if (item.kind === "profile_set") {
      activateItem(item);
      return;
    }
    useAllProfilesMutation.mutate({
      profile: item.profile,
      stateMode: resolveGlobalStateMode(snapshot),
      label: item.label,
    });
    onClose();
  }

  if (!open) {
    return null;
  }

  const groupedItems = filteredItems.reduce<Record<string, QuickSwitchItem[]>>((acc, item) => {
    acc[item.group] ??= [];
    acc[item.group].push(item);
    return acc;
  }, {});
  const selectedItem = filteredItems[selectedIndex] ?? null;
  const statusCopy = quickSwitchStatusCopy(selectedItem);

  return (
    <DialogSurface
      ariaLabel="Quick Switch"
      className="quick-switch-palette"
      initialFocusSelector="input, button:not([disabled])"
      onClose={onClose}
    >
        <div className="quick-switch-header quick-switch-header-compact">
          <div>
            <p className="card-kicker">Quick Switch</p>
            <h3>Search sets or profiles</h3>
          </div>
          <button className="ghost-button" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="quick-switch-search-row">
          <SearchField
            ref={inputRef}
            className="search-field quick-switch-search-field"
            inputClassName="search-field-input quick-switch-search"
            ariaLabel="Search Quick Switch"
            ariaControls="quick-switch-results-listbox"
            ariaActiveDescendant={selectedItem ? `quick-switch-option-${selectedItem.id}` : undefined}
            placeholder="Search profiles or sets"
            value={query}
            onChange={setQuery}
          />
          <span className="quick-switch-count" aria-live="polite">
            {quickSwitchResultCountLabel(filteredItems.length)}
          </span>
        </div>
        <div className="quick-switch-status-strip" aria-live="polite">
          {selectedItem ? (
            <>
              <span className="quick-switch-hint-label">{statusCopy.label}</span>
              <strong>{statusCopy.title}</strong>
              <span className="quick-switch-hint-copy">
                {statusCopy.subtitle}
              </span>
              <span className="quick-switch-status-shortcut">{statusCopy.shortcut}</span>
            </>
          ) : (
            <>
              <span className="quick-switch-hint-label">{statusCopy.label}</span>
              <strong>{statusCopy.title}</strong>
              <span className="quick-switch-hint-copy">{statusCopy.subtitle}</span>
            </>
          )}
        </div>
        <div
          className="quick-switch-results"
          role="listbox"
          id="quick-switch-results-listbox"
          aria-label="Quick Switch results"
        >
          {filteredItems.length ? (
            Object.entries(groupedItems).map(([group, groupItems]) => (
              <div key={group} className="quick-switch-group">
                <p className="nav-group-label">{group}</p>
                <div className="quick-switch-options">
                  {groupItems.map((item) => {
                    const itemIndex = filteredItems.findIndex((entry) => entry.id === item.id);
                    return (
                      <button
                        key={item.id}
                        id={`quick-switch-option-${item.id}`}
                        ref={(node) => {
                          optionRefs.current[item.id] = node;
                        }}
                        className={
                          itemIndex === selectedIndex
                            ? "quick-switch-option quick-switch-option-active"
                            : "quick-switch-option"
                        }
                        type="button"
                        role="option"
                        aria-selected={itemIndex === selectedIndex}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        onClick={() => activateItem(item)}
                      >
                        <span
                          className={`quick-switch-option-state ${item.active ? "quick-switch-option-state-active" : ""}`}
                          aria-hidden="true"
                        />
                        <div className="quick-switch-option-copy">
                          <div className="quick-switch-option-line">
                            <strong>
                              {item.kind === "tool_profile" ? (
                                <ToolBrand
                                  tool={item.tool}
                                  className="tool-brand-inline"
                                  logoSize={15}
                                  shortName
                                />
                              ) : (
                                item.title
                              )}
                            </strong>
                            {item.active ? (
                              <span className="quick-switch-option-badge">Current</span>
                            ) : null}
                          </div>
                          <p>
                            {item.kind === "tool_profile" ? `${item.title} · ${item.profile}` : item.subtitle}
                          </p>
                        </div>
                        <span className="quick-switch-option-meta">
                          {item.active ? "Selected" : "Return"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <article className="diagnostic-card">
              <h3>No matches</h3>
              <p className="inline-note">
                {quickSwitchNoMatchesDescription()}
              </p>
            </article>
          )}
        </div>
        <footer className="quick-switch-footer quick-switch-footer-compact" aria-label="Quick Switch shortcuts">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            Move
          </span>
          <span>
            <kbd>Enter</kbd>
            Switch
          </span>
          <span>
            <kbd>⌘</kbd>
            <kbd>Enter</kbd>
            Match all
          </span>
          <span>
            <kbd>Esc</kbd>
            Close
          </span>
        </footer>
    </DialogSurface>
  );
}
