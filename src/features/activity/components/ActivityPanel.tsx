import { useEffect, useMemo, useState } from "react";
import { DesktopStatusStrip } from "../../../components/DesktopStatusStrip";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SectionCard } from "../../../components/SectionCard";
import { SplitView } from "../../../components/SplitView";
import { useLastCommandResults } from "../../shared/lastCommandResult";

type ActivityEntry = {
  key: string;
  scopeLabel: string;
  label: string;
  status: "success" | "error";
  message: string;
  remediation?: string;
  at: number;
};

export function ActivityPanel() {
  const lastCommandResults = useLastCommandResults();
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      [
        ...Object.entries(lastCommandResults.global).flatMap(([id, result]) =>
          result
            ? [
                {
                  key: `global-${id}`,
                  scopeLabel: formatGlobalScope(id),
                  label: result.label,
                  status: result.status,
                  message: result.message,
                  remediation: result.remediation,
                  at: result.at,
                },
              ]
            : [],
        ),
        ...Object.entries(lastCommandResults.tool).flatMap(([tool, result]) =>
          result
            ? [
                {
                  key: `tool-${tool}`,
                  scopeLabel: formatToolScope(tool),
                  label: result.label,
                  status: result.status,
                  message: result.message,
                  remediation: result.remediation,
                  at: result.at,
                },
              ]
            : [],
        ),
      ].sort((left, right) => right.at - left.at),
    [lastCommandResults.global, lastCommandResults.tool],
  );

  useEffect(() => {
    if (selectedEntryKey && entries.some((entry) => entry.key === selectedEntryKey)) {
      return;
    }
    setSelectedEntryKey(entries[0]?.key ?? null);
  }, [entries, selectedEntryKey]);

  const selectedEntry = entries.find((entry) => entry.key === selectedEntryKey) ?? entries[0] ?? null;

  return (
    <SectionCard title="Activity" kicker="Recent changes and checks">
      <DesktopStatusStrip
        ariaLabel="Activity highlights"
        items={[
          {
            label: "Timeline",
            value: `${entries.length} session event${entries.length === 1 ? "" : "s"}`,
            note: "Recent profile changes, verification runs, setup actions, and recovery outcomes stay in one local stream.",
          },
          {
            label: "Ordering",
            value: "Latest first",
            note: "Inspect the newest switch, verify, and repair events without opening separate logs.",
          },
          {
            label: "Scope",
            value: "Local only",
            pills: ["Switches", "Verification", "Recovery"],
          },
        ]}
      />
      <article className="diagnostic-card desktop-pane-intro">
        <h3>Session timeline</h3>
        <p className="inline-note">
          Review the most recent switch, recovery, verification, and setup actions in one compact timeline with a dedicated detail inspector.
        </p>
        <p className="inline-note">
          {entries.length ? `${entries.length} recent event${entries.length === 1 ? "" : "s"} in this session.` : "No local events recorded in this session yet."}
        </p>
      </article>
      <SplitView
        className="activity-layout"
        primaryClassName="activity-list-pane"
        secondaryClassName="activity-detail-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <div className="desktop-pane-section desktop-list-surface">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Timeline</p>
                  <h3>Recent events</h3>
                </div>
                <p className="inline-note">
                  Select an event to inspect its message, remediation, and source.
                </p>
              </div>
            </div>
            <div className="stack-list desktop-list-stack">
              {entries.length ? (
                entries.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={`list-row activity-list-row ${
                      selectedEntry?.key === entry.key ? "activity-list-row-selected" : ""
                    }`}
                    onClick={() => setSelectedEntryKey(entry.key)}
                    aria-pressed={selectedEntry?.key === entry.key}
                    aria-label={`Inspect ${entry.label}`}
                  >
                    <div className="activity-list-main">
                      <div className="activity-list-title">
                        <strong>{entry.label}</strong>
                        <span
                          className={`pill ${entry.status === "success" ? "pill-ok" : "pill-warn"}`}
                        >
                          {entry.status === "success" ? "Success" : "Needs attention"}
                        </span>
                      </div>
                      <p className="inline-note">{entry.message}</p>
                    </div>
                    <div className="activity-list-meta">
                      <span>{entry.scopeLabel}</span>
                      <span>{formatTimestamp(entry.at)}</span>
                    </div>
                    <span className="activity-row-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))
              ) : (
                <article className="diagnostic-card">
                  <h3>No recent activity</h3>
                  <p className="inline-note">
                    Switch a set, change a profile, or run verification to build a local activity trail.
                  </p>
                </article>
              )}
            </div>
          </div>
        }
        secondary={
          <div className="stack-list desktop-pane-column">
            {selectedEntry ? (
              <article
                className={`diagnostic-card activity-detail-card ${
                  selectedEntry.status === "success" ? "diagnostic-pass" : "diagnostic-warn"
                }`}
              >
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Inspector</p>
                    <h3>{selectedEntry.label}</h3>
                  </div>
                  <span
                    className={`pill ${selectedEntry.status === "success" ? "pill-ok" : "pill-warn"}`}
                  >
                    {selectedEntry.status === "success" ? "Success" : "Needs attention"}
                  </span>
                </div>
                <KeyValueGrid
                  rows={[
                    { label: "Scope", value: selectedEntry.scopeLabel },
                    { label: "Time", value: formatFullTimestamp(selectedEntry.at) },
                    {
                      label: "Status",
                      value: selectedEntry.status === "success" ? "Success" : "Needs attention",
                    },
                  ]}
                />
                <div className="activity-detail-copy">
                  <p className="inline-note">{selectedEntry.message}</p>
                  {selectedEntry.remediation ? (
                    <p className="inline-note">{selectedEntry.remediation}</p>
                  ) : (
                    <p className="inline-note">
                      No extra recovery steps were recorded for this event.
                    </p>
                  )}
                </div>
              </article>
            ) : (
              <article className="diagnostic-card">
                <h3>No recent activity</h3>
                <p className="inline-note">
                  Local switch, verification, and setup events will appear here as soon as you use the app.
                </p>
              </article>
            )}
          </div>
        }
      />
    </SectionCard>
  );
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
      return "Set";
    case "context":
      return "Imported sets";
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
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}
