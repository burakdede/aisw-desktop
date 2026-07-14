import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SFEllipsisCircle } from "sf-symbols-lib/monochrome/SFEllipsisCircle";
import { AnchoredMenu } from "../../../components/AnchoredMenu";
import { DialogSurface } from "../../../components/DialogSurface";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SearchField } from "../../../components/SearchField";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { SplitView } from "../../../components/SplitView";
import { ToolBrand } from "../../../components/ToolBrand";
import { exportActivityLog } from "../../../lib/client";
import { notifyDesktop } from "../../../lib/notifications";
import {
  clearLastCommandResults,
  useLastCommandResults,
} from "../../shared/lastCommandResult";

type ActivityFilter = "all" | "success" | "error";
const ACTIVITY_COMPACT_BREAKPOINT = 800;

function measuredPaneWidth(element: HTMLDivElement | null) {
  if (!element) {
    return typeof window !== "undefined" ? window.innerWidth : ACTIVITY_COMPACT_BREAKPOINT;
  }

  const width = element.getBoundingClientRect().width;
  if (width > 0) {
    return width;
  }

  return typeof window !== "undefined" ? window.innerWidth : ACTIVITY_COMPACT_BREAKPOINT;
}

type ActivityEntry = {
  key: string;
  scopeLabel: string;
  scopeType: "tool" | "global";
  scopeTool?: string;
  label: string;
  status: "success" | "error";
  message: string;
  remediation?: string;
  command?: string;
  resultSummary?: string;
  at: number;
};

export function ActivityPanel({
  externalClearSignal = 0,
  externalOpenLogSignal = 0,
}: {
  externalClearSignal?: number;
  externalOpenLogSignal?: number;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const lastCommandResults = useLastCommandResults();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [clearMessage, setClearMessage] = useState("");
  const [logMessage, setLogMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);
  const [compactLayout, setCompactLayout] = useState(false);
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);

  const entries = useMemo<ActivityEntry[]>(
    () =>
      lastCommandResults.timeline.map((entry) => ({
        key: entry.key,
        scopeLabel:
          entry.scope.type === "tool"
            ? formatToolScope(entry.scope.tool)
            : formatGlobalScope(entry.scope.id),
        scopeType: entry.scope.type,
        scopeTool: entry.scope.type === "tool" ? entry.scope.tool : undefined,
        label: entry.label,
        status: entry.status,
        message: entry.message,
        remediation: entry.remediation,
        command: entry.command,
        resultSummary: entry.resultSummary,
        at: entry.at,
      })),
    [lastCommandResults.timeline],
  );

  const filteredEntries = useMemo(
    () => filterActivity(entries, search, filter),
    [entries, filter, search],
  );
  const groupedEntries = useMemo(() => groupEntries(filteredEntries), [filteredEntries]);
  const selectedEntry =
    filteredEntries.find((entry) => entry.key === selectedEntryKey) ?? filteredEntries[0] ?? null;
  const hasEntries = entries.length > 0;
  const footerMessage = clearMessage || logMessage;
  const showList = !compactLayout || !compactInspectorOpen;
  const showInspector = !compactLayout || compactInspectorOpen;

  useEffect(() => {
    if (selectedEntryKey && filteredEntries.some((entry) => entry.key === selectedEntryKey)) {
      return;
    }
    setSelectedEntryKey(filteredEntries[0]?.key ?? null);
  }, [filteredEntries, selectedEntryKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateLayout = () => {
      setCompactLayout(measuredPaneWidth(rootRef.current) < ACTIVITY_COMPACT_BREAKPOINT);
    };

    updateLayout();
    const observer =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(() => {
            updateLayout();
          })
        : null;

    if (rootRef.current) {
      observer?.observe(rootRef.current);
    }
    window.addEventListener("resize", updateLayout);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", updateLayout);
    };
  }, []);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    setCompactLayout(measuredPaneWidth(rootRef.current) < ACTIVITY_COMPACT_BREAKPOINT);
  });

  useEffect(() => {
    if (!compactLayout) {
      setCompactInspectorOpen(false);
    }
  }, [compactLayout]);

  useEffect(() => {
    if (externalClearSignal < 1) {
      return;
    }
    applyClear();
  }, [externalClearSignal]);

  useEffect(() => {
    if (externalOpenLogSignal < 1 || !entries.length) {
      return;
    }
    void openActivityLog();
  }, [entries.length, externalOpenLogSignal]);

  async function openActivityLog() {
    if (!entries.length) {
      return;
    }

    const payload = entries.map((entry) => ({
      ...entry,
      recordedAt: new Date(entry.at).toISOString(),
    }));
    const result = await exportActivityLog(JSON.stringify(payload, null, 2));
    const message = `Opened ${result.filename}.`;
    setClearMessage("");
    setLogMessage(message);
    await notifyDesktop({
      title: "Activity log opened",
      body: message,
    });
  }

  async function exportRedactedActivity() {
    if (!entries.length) {
      return;
    }

    const payload = entries.map((entry) => ({
      ...entry,
      recordedAt: new Date(entry.at).toISOString(),
    }));
    const result = await exportActivityLog(JSON.stringify(payload, null, 2));
    const message = `Opened ${result.filename}.`;
    setClearMessage("");
    setLogMessage(message);
    await notifyDesktop({
      title: "Redacted activity exported",
      body: message,
    });
  }

  function applyClear() {
    clearLastCommandResults();
    setSelectedEntryKey(null);
    setPendingClear(false);
    setClearMessage("Cleared locally stored desktop activity.");
    setLogMessage("");
    setMenuOpen(false);
  }

  function refreshActivity() {
    setMenuOpen(false);
    setClearMessage("");
    setLogMessage("");
    setSelectedEntryKey(filteredEntries[0]?.key ?? null);
    void queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
  }

  return (
    <div ref={rootRef} className="activity-screen screen-content">
      <div className="activity-toolbar-row">
        <SearchField
          className="search-field activity-search-field"
          inputClassName="search-field-input"
          ariaLabel="Search activity"
          placeholder="Search activity…"
          value={search}
          onChange={setSearch}
        />
        <SegmentedControl
          ariaLabel="Activity filters"
          options={[
            { value: "all", label: "All" },
            { value: "success", label: "Success" },
            { value: "error", label: "Failed" },
          ]}
          value={filter}
          onChange={(value) => setFilter(value as ActivityFilter)}
        />
        <div className="activity-toolbar-menu-wrap">
          <button
            ref={menuAnchorRef}
            className="ghost-button icon-button"
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Activity more actions"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <SFEllipsisCircle aria-hidden="true" focusable="false" size={16} />
          </button>
          {menuOpen ? (
            <AnchoredMenu
              anchorRef={menuAnchorRef}
              className="profile-row-actions-menu"
              role="menu"
              aria-label="Activity actions"
            >
              <button className="ghost-button" role="menuitem" type="button" onClick={refreshActivity}>
                Refresh
              </button>
              <button
                className="ghost-button"
                role="menuitem"
                type="button"
                disabled={!hasEntries}
                onClick={() => {
                  setMenuOpen(false);
                  void openActivityLog();
                }}
              >
                Open Log File
              </button>
              <button
                className="ghost-button"
                role="menuitem"
                type="button"
                disabled={!hasEntries}
                onClick={() => {
                  setMenuOpen(false);
                  void exportRedactedActivity();
                }}
              >
                Export Redacted Activity…
              </button>
              <div className="menu-divider" aria-hidden="true" />
              <button
                className="ghost-button profile-row-actions-danger"
                role="menuitem"
                type="button"
                disabled={!hasEntries}
                onClick={() => {
                  setMenuOpen(false);
                  setPendingClear(true);
                }}
              >
                Clear Activity History…
              </button>
            </AnchoredMenu>
          ) : null}
        </div>
      </div>

      <SplitView
        className="activity-master-detail"
        primaryClassName="activity-list-pane"
        secondaryClassName="activity-inspector-pane"
        primary={showList ? (
          <section className="activity-pane">
            <div className="activity-list-body" aria-label="Activity timeline">
              {groupedEntries.length ? (
                groupedEntries.map((group) => (
                  <section key={group.label} className="activity-group" aria-label={group.label}>
                    <h3 className="activity-group-heading">{group.label}</h3>
                    <div className="activity-group-list">
                      {group.entries.map((entry) => (
                        <button
                          key={entry.key}
                          type="button"
                          className={`activity-event-row ${
                            selectedEntry?.key === entry.key ? "activity-event-row-selected" : ""
                          }`}
                          aria-label={`Inspect ${entry.label}`}
                          aria-pressed={selectedEntry?.key === entry.key}
                          onClick={() => {
                            setSelectedEntryKey(entry.key);
                            setClearMessage("");
                            setLogMessage("");
                            if (compactLayout) {
                              setCompactInspectorOpen(true);
                            }
                          }}
                        >
                          <div className="activity-event-time">{formatTimestamp(entry.at)}</div>
                          <div className="activity-event-main">
                            <div className="activity-event-title-row">
                              <span className={`activity-event-status activity-event-status-${entry.status}`}>
                                <span aria-hidden="true">{entry.status === "success" ? "✓" : "▲"}</span>
                                <strong>{entry.label}</strong>
                              </span>
                            </div>
                            <p className="activity-event-detail">{activitySecondaryLine(entry)}</p>
                          </div>
                          <div className="activity-event-tail">
                            <span>{activityTrailingLine(entry)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="activity-empty-state">
                  <h3>No recent activity</h3>
                  <p className="inline-note">
                    Local switch, verification, and setup events will appear here as soon as you use the app.
                  </p>
                </div>
              )}
            </div>
          </section>
        ) : null}
        secondary={showInspector ? (
          <aside className="activity-pane activity-inspector-surface">
            {selectedEntry ? (
              <div className="activity-inspector-content">
                <header className="activity-inspector-header">
                  <div>
                    {compactLayout ? (
                      <button
                        className="ghost-button activity-inspector-back"
                        type="button"
                        onClick={() => setCompactInspectorOpen(false)}
                      >
                        Back
                      </button>
                    ) : null}
                    <h3>{selectedEntry.label}</h3>
                    <p className={`activity-inspector-status activity-inspector-status-${selectedEntry.status}`}>
                      <span aria-hidden="true">{selectedEntry.status === "success" ? "●" : "▲"}</span>
                      <span>{selectedEntry.status === "success" ? "Success" : "Failed"}</span>
                    </p>
                  </div>
                </header>
                <p className="inline-note activity-inspector-message">{selectedEntry.message}</p>
                <KeyValueGrid
                  variant="plain"
                  rows={[
                    {
                      label: "Recorded",
                      value: formatFullTimestamp(selectedEntry.at),
                    },
                    {
                      label: "Scope",
                      value:
                        selectedEntry.scopeType === "tool" && selectedEntry.scopeTool ? (
                          <ToolBrand
                            tool={selectedEntry.scopeTool}
                            className="tool-brand-inline"
                            logoSize={16}
                          />
                        ) : (
                          selectedEntry.scopeLabel
                        ),
                    },
                    {
                      label: "Duration",
                      value: "Not Recorded",
                    },
                    {
                      label: "Initiated by",
                      value: "Desktop app",
                    },
                    {
                      label: "Recovery",
                      value: selectedEntry.remediation ?? "None required",
                    },
                  ]}
                />
                <details className="activity-disclosure">
                  <summary>Recorded Command</summary>
                  {selectedEntry.command ? (
                    <pre>{selectedEntry.command}</pre>
                  ) : (
                    <p className="inline-note">Command details were not recorded for this event.</p>
                  )}
                </details>
                <details className="activity-disclosure">
                  <summary>Redacted Result</summary>
                  {selectedEntry.resultSummary ? (
                    <pre>{selectedEntry.resultSummary}</pre>
                  ) : (
                    <p className="inline-note">
                      {selectedEntry.status === "success"
                        ? "Snapshot updated successfully."
                        : "No redacted result payload was recorded for this event."}
                    </p>
                  )}
                </details>
              </div>
            ) : (
              <div className="activity-empty-state activity-empty-state-compact">
                <h3>No event selected</h3>
                <p className="inline-note">Choose an event to inspect its recorded details.</p>
              </div>
            )}
          </aside>
        ) : null}
      />

      <div className="activity-footer-line">
        <p>
          Activity is stored locally and credentials are always redacted.
          {footerMessage ? ` ${footerMessage}` : ""}
        </p>
      </div>

      {pendingClear ? (
        <DialogSurface
          ariaLabel="Clear Activity History"
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="button:not([disabled])"
          onClose={() => setPendingClear(false)}
        >
          <div className="quick-switch-header">
            <div>
              <p className="card-kicker">History</p>
              <h3>Clear Activity History?</h3>
              <p className="inline-note">
                This removes the locally stored desktop timeline for this Mac. Credentials remain untouched.
              </p>
            </div>
          </div>
          <footer className="quick-switch-footer">
            <div className="button-row">
              <button className="ghost-button" type="button" onClick={() => setPendingClear(false)}>
                Cancel
              </button>
              <button className="ghost-button danger-button" type="button" onClick={applyClear}>
                Clear History
              </button>
            </div>
          </footer>
        </DialogSurface>
      ) : null}
    </div>
  );
}

function filterActivity(entries: ActivityEntry[], search: string, filter: ActivityFilter) {
  const query = search.trim().toLowerCase();

  return entries.filter((entry) => {
    if (filter !== "all" && entry.status !== filter) {
      return false;
    }

    if (!query) {
      return true;
    }

    return [
      entry.label,
      entry.message,
      entry.remediation ?? "",
      entry.scopeLabel,
      activityPreview(entry),
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
}

function groupEntries(entries: ActivityEntry[]) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  const groups = [
    { label: "Today", entries: [] as ActivityEntry[] },
    { label: "Yesterday", entries: [] as ActivityEntry[] },
    { label: "Earlier", entries: [] as ActivityEntry[] },
  ];

  for (const entry of entries) {
    if (entry.at >= todayStart) {
      groups[0].entries.push(entry);
    } else if (entry.at >= yesterdayStart) {
      groups[1].entries.push(entry);
    } else {
      groups[2].entries.push(entry);
    }
  }

  return groups.filter((group) => group.entries.length > 0);
}

function activityPreview(entry: ActivityEntry) {
  if (entry.scopeType === "tool" && entry.scopeTool) {
    return entry.message;
  }
  return entry.message;
}

function activitySecondaryLine(entry: ActivityEntry) {
  const targetSummary = parseActivityTargetSummary(entry);
  if (targetSummary) {
    return targetSummary;
  }

  if (entry.resultSummary && !isGenericActivityResult(entry.resultSummary)) {
    return entry.resultSummary;
  }

  return entry.scopeLabel;
}

function activityTrailingLine(entry: ActivityEntry) {
  if (entry.resultSummary && !isGenericActivityResult(entry.resultSummary)) {
    return entry.resultSummary;
  }

  if (entry.remediation) {
    return "Recovery available";
  }

  return entry.status === "success" ? "Success" : "Failed";
}

function parseActivityTargetSummary(entry: ActivityEntry) {
  if (entry.scopeType === "tool" && entry.scopeTool) {
    const switchedMatch = entry.message.match(/\b(?:switched|re-applied)\b.*?\bto\s+([^.;]+)/i);
    if (switchedMatch?.[1]) {
      return `${formatToolScope(entry.scopeTool)} → ${switchedMatch[1].trim()}`;
    }

    const profileMatch = entry.message.match(/\bprofile\s+([^.;]+)/i);
    if (profileMatch?.[1]) {
      return `${formatToolScope(entry.scopeTool)} · ${profileMatch[1].trim()}`;
    }

    return formatToolScope(entry.scopeTool);
  }

  return null;
}

function isGenericActivityResult(value: string) {
  return value.trim().toLowerCase() === "snapshot updated successfully.";
}

function formatToolScope(tool: string) {
  return tool === "claude"
    ? "Claude Code"
    : tool === "codex"
      ? "Codex CLI"
      : tool === "gemini"
        ? "Gemini CLI"
        : tool;
}

function formatGlobalScope(id: string) {
  switch (id) {
    case "switch-all":
      return "Quick Switch";
    case "profile-set":
      return "Saved set";
    case "context":
      return "Sets";
    case "workspace":
      return "Project rules";
    case "backup":
      return "Backups";
    case "settings":
      return "Settings";
    case "setup":
      return "Setup";
    default:
      return "App";
  }
}

function formatTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function formatFullTimestamp(timestamp: number) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const value = date.getTime();
  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (value >= todayStart) {
    return `Today at ${time}`;
  }

  if (value >= yesterdayStart) {
    return `Yesterday at ${time}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
