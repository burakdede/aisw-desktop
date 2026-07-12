import { useEffect, useMemo, useRef, useState } from "react";
import { DialogSurface } from "./DialogSurface";
import { SearchField } from "./SearchField";
import type { AppBootstrap, AppSnapshot, DesktopSettings } from "../lib/schemas";
import {
  profileSetDisplayLabel,
  profileSetHasUsableSelections,
  sharedProfileEntries,
  toolProfileDisplayLabel,
} from "../lib/profile-display";
import { toolDisplayName } from "../lib/tool-display";
import { titleCase } from "../lib/utils";
import { resolveGlobalStateMode, supportedStateModes } from "../features/shared/state-modes";
import { useDesktopActions } from "../features/shared/useDesktopActions";

type QuickSwitchPaletteProps = {
  open: boolean;
  onClose: () => void;
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
};

type QuickSwitchItem =
  | {
      id: string;
      kind: "profile_set";
      group: "Sets";
      badge: "Set";
      title: string;
      subtitle: string;
      searchText: string;
      active: boolean;
      name: string;
      label?: string;
    }
  | {
      id: string;
      kind: "shared_profile";
      group: "All tools";
      badge: "Match";
      title: string;
      subtitle: string;
      searchText: string;
      active: boolean;
      profile: string;
      label: string;
    }
  | {
      id: string;
      kind: "tool_profile";
      group: string;
      badge: string;
      title: string;
      subtitle: string;
      searchText: string;
      active: boolean;
      tool: string;
      profile: string;
      label: string;
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
    window.setTimeout(() => inputRef.current?.focus(), 0);
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

  return (
    <DialogSurface
      ariaLabel="Quick Switch"
      className="quick-switch-palette"
      initialFocusSelector="input, button:not([disabled])"
      onClose={onClose}
    >
        <div className="quick-switch-header">
          <div>
            <p className="card-kicker">Quick Switch</p>
            <h3>Switch profiles without leaving the current view</h3>
            <p className="inline-note">
              Search sets, matching profiles, or individual tool profiles.
            </p>
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
            {filteredItems.length} result{filteredItems.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="quick-switch-hint-bar" aria-live="polite">
          {selectedItem ? (
            <>
              <span className="quick-switch-hint-label">{selectedItem.group}</span>
              <strong>{selectedItem.title}</strong>
              <span className="quick-switch-hint-copy">
                {selectedItem.active ? "Current selection" : selectedItem.subtitle}
              </span>
            </>
          ) : (
            <>
              <span className="quick-switch-hint-label">Selection</span>
              <strong>No matches</strong>
              <span className="quick-switch-hint-copy">Search by set name, tool, profile name, or saved label.</span>
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
                        <div className="quick-switch-option-copy">
                          <div className="quick-switch-option-line">
                            <strong>{item.title}</strong>
                            <span className="quick-switch-option-badge">{item.badge}</span>
                          </div>
                          <p>{item.subtitle}</p>
                        </div>
                        <span className="quick-switch-option-meta">
                          {item.active ? "Current" : "Switch"}
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
                Search by set name, tool, profile name, or saved label.
              </p>
            </article>
          )}
        </div>
        <footer className="quick-switch-footer">
          <div className="quick-switch-selection" aria-live="polite">
            {selectedItem ? (
              <>
                <p className="card-kicker">Selected</p>
                <strong>{selectedItem.title}</strong>
                <p>
                  {selectedItem.kind === "profile_set"
                    ? "Enter switches this set."
                    : selectedItem.kind === "shared_profile"
                      ? "Enter switches every matching tool."
                      : `Enter switches ${titleCase(selectedItem.tool)}.`}
                </p>
              </>
            ) : (
              <>
                <p className="card-kicker">Selected</p>
                <strong>No matches</strong>
                <p>Search by set name, tool, profile name, or saved label.</p>
              </>
            )}
          </div>
          <div className="quick-switch-shortcuts" aria-label="Quick Switch shortcuts">
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
          </div>
        </footer>
    </DialogSurface>
  );
}

function buildQuickSwitchItems(settings: DesktopSettings, snapshot: AppSnapshot): QuickSwitchItem[] {
  const items: QuickSwitchItem[] = [];

  for (const set of [...(settings.profile_sets ?? [])].sort((left, right) => left.name.localeCompare(right.name))) {
    if (!profileSetHasUsableSelections(snapshot, set)) {
      continue;
    }
    const active = Object.entries(set.profiles)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
      .every(([tool, profile]) => snapshot.profiles[tool]?.active === profile);
    items.push({
      id: `set:${set.name}`,
      kind: "profile_set",
      group: "Sets",
      badge: "Set",
      title: profileSetDisplayLabel(set),
      subtitle: buildSetSubtitle(set),
      searchText: `${set.name} ${set.label ?? ""} ${buildSetSubtitle(set)}`.toLowerCase(),
      active,
      name: set.name,
      label: set.label ?? undefined,
    });
  }

  for (const profile of sharedProfileEntries(settings, snapshot)) {
    const active = snapshot.statuses
      .filter((status) => status.active_profile)
      .every((status) => status.active_profile === profile.name);
    const matchingTools = sharedProfileTools(snapshot, profile.name);
    items.push({
      id: `shared:${profile.name}`,
      kind: "shared_profile",
      group: "All tools",
      badge: "Match",
      title: profile.label,
      subtitle: `Across ${matchingTools.join(", ")}`,
      searchText: `${profile.name} ${profile.label} ${matchingTools.join(" ")}`.toLowerCase(),
      active,
      profile: profile.name,
      label: profile.label,
    });
  }

  for (const tool of Object.keys(snapshot.profiles).sort((left, right) => left.localeCompare(right))) {
    const profiles = snapshot.profiles[tool]?.profiles ?? [];
    for (const profile of profiles) {
      const label = toolProfileDisplayLabel(settings, snapshot, tool, profile.name);
      items.push({
        id: `tool:${tool}:${profile.name}`,
        kind: "tool_profile",
        group: quickSwitchToolLabel(tool),
        badge: "Tool",
        title: label,
        subtitle: `${quickSwitchToolLabel(tool)} · ${profile.name} · ${profile.auth}`,
        searchText: `${tool} ${profile.name} ${profile.auth} ${label}`.toLowerCase(),
        active: snapshot.profiles[tool]?.active === profile.name,
        tool,
        profile: profile.name,
        label,
      });
    }
  }

  return items;
}

function buildSetSubtitle(set: NonNullable<DesktopSettings["profile_sets"]>[number]) {
  return Object.entries(set.profiles)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
    .map(([tool, profile]) => `${quickSwitchToolLabel(tool)}: ${profile}`)
    .join("  ");
}

function sharedProfileTools(snapshot: AppSnapshot, profileName: string) {
  return Object.keys(snapshot.profiles)
    .filter((tool) =>
      snapshot.profiles[tool]?.profiles.some((profile) => profile.name === profileName),
    )
    .map((tool) => quickSwitchToolLabel(tool));
}

function quickSwitchToolLabel(tool: string) {
  return toolDisplayName(tool);
}
