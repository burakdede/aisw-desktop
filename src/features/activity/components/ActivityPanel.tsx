import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { DesktopStatusStrip } from "../../../components/DesktopStatusStrip";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SectionCard } from "../../../components/SectionCard";
import { SplitView } from "../../../components/SplitView";
import { exportDiagnosticBundle } from "../../../lib/client";
import { notifyDesktop } from "../../../lib/notifications";
import {
  clearLastCommandResults,
  useLastCommandResults,
} from "../../shared/lastCommandResult";

type ActivityEntry = {
  key: string;
  scopeLabel: string;
  label: string;
  status: "success" | "error";
  message: string;
  remediation?: string;
  command?: string;
  resultSummary?: string;
  at: number;
};

export function ActivityPanel() {
  const lastCommandResults = useLastCommandResults();
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [clearMessage, setClearMessage] = useState("");

  const exportBundleMutation = useMutation({
    mutationFn: exportDiagnosticBundle,
    onSuccess: async (result) => {
      const message = `Saved ${result.filename}.`;
      await notifyDesktop({
        title: "Support report exported",
        body: message,
      });
    },
  });

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
                  command: result.command,
                  resultSummary: result.resultSummary,
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
                  command: result.command,
                  resultSummary: result.resultSummary,
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

  function clearTimeline() {
    clearLastCommandResults();
    setSelectedEntryKey(null);
    setClearMessage("Cleared activity recorded in this desktop session.");
  }

  return (
    <SectionCard
      title="Activity"
      kicker="Recent changes and checks"
      actions={
        <div className="button-row">
          <button
            className="ghost-button"
            type="button"
            disabled={!entries.length}
            onClick={clearTimeline}
          >
            Clear
          </button>
          <button
            className="ghost-button"
            type="button"
            disabled={exportBundleMutation.isPending}
            onClick={() => exportBundleMutation.mutate()}
          >
            {exportBundleMutation.isPending ? "Exporting…" : "Export support report"}
          </button>
        </div>
      }
    >
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
            label: "Privacy",
            value: "Redacted support",
            pills: ["No tokens", "No API keys", "Local only"],
          },
        ]}
      />
      <article className="diagnostic-card desktop-pane-intro">
        <h3>Recent activity</h3>
        <p className="inline-note">
          Review the latest switch, recovery, verification, and setup actions in a compact session timeline with a dedicated inspector.
        </p>
        <p className="inline-note">
          {entries.length
            ? `${entries.length} recent event${entries.length === 1 ? "" : "s"} in this desktop session.`
            : "No local events recorded in this desktop session yet."}
        </p>
        {clearMessage ? <p className="inline-note">{clearMessage}</p> : null}
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
                  <h3>Session events</h3>
                </div>
                <p className="inline-note">
                  Select an event to inspect its result, recorded command, and recovery guidance.
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
                      <span>{formatTimestamp(entry.at)}</span>
                      <span>{entry.scopeLabel}</span>
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
                    { label: "Time", value: formatFullTimestamp(selectedEntry.at) },
                    { label: "Scope", value: selectedEntry.scopeLabel },
                    {
                      label: "Result",
                      value: selectedEntry.status === "success" ? "Success" : "Needs attention",
                    },
                    {
                      label: "Command",
                      value: selectedEntry.command ?? "Desktop command details were not recorded for this event.",
                    },
                  ]}
                />
                <div className="activity-detail-copy stack-list">
                  <div>
                    <p className="card-kicker">Output</p>
                    <p className="inline-note">{selectedEntry.message}</p>
                  </div>
                  <div>
                    <p className="card-kicker">Recorded result</p>
                    <p className="inline-note">
                      {selectedEntry.resultSummary ??
                        (selectedEntry.status === "success"
                          ? "Snapshot updated successfully."
                          : "The desktop app recorded a recoverable failure for this event.")}
                    </p>
                  </div>
                  <div>
                    <p className="card-kicker">Recovery</p>
                    {selectedEntry.remediation ? (
                      <p className="inline-note">{selectedEntry.remediation}</p>
                    ) : (
                      <p className="inline-note">
                        No extra recovery steps were recorded for this event.
                      </p>
                    )}
                  </div>
                </div>
                {selectedEntry.status === "error" ? (
                  <div className="button-row">
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={exportBundleMutation.isPending}
                      onClick={() => exportBundleMutation.mutate()}
                    >
                      {exportBundleMutation.isPending ? "Exporting…" : "Export support report"}
                    </button>
                  </div>
                ) : null}
              </article>
            ) : (
              <article className="diagnostic-card">
                <h3>No recent activity</h3>
                <p className="inline-note">
                  Local switch, verification, and setup events will appear here as soon as you use the app.
                </p>
              </article>
            )}
            {exportBundleMutation.data ? (
              <article className="diagnostic-card diagnostic-pass">
                <h3>Support report ready</h3>
                <p className="inline-note">Saved {exportBundleMutation.data.filename}.</p>
              </article>
            ) : null}
            {exportBundleMutation.error ? (
              <article className="diagnostic-card diagnostic-warn">
                <h3>Support report could not be exported</h3>
                <p className="inline-note">
                  {exportBundleMutation.error instanceof Error
                    ? exportBundleMutation.error.message
                    : "Desktop command failed."}
                </p>
              </article>
            ) : null}
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
