import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { KeyValueGrid } from "../../../components/KeyValueGrid";
import { SectionCard } from "../../../components/SectionCard";
import { SplitView } from "../../../components/SplitView";
import { exportActivityLog, exportDiagnosticBundle } from "../../../lib/client";
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

export function ActivityPanel({
  externalClearSignal = 0,
  externalOpenLogSignal = 0,
}: {
  externalClearSignal?: number;
  externalOpenLogSignal?: number;
}) {
  const lastCommandResults = useLastCommandResults();
  const [selectedEntryKey, setSelectedEntryKey] = useState<string | null>(null);
  const [clearMessage, setClearMessage] = useState("");
  const [logMessage, setLogMessage] = useState("");

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

  const exportActivityLogMutation = useMutation({
    mutationFn: exportActivityLog,
    onSuccess: async (result) => {
      const message = `Opened ${result.filename}.`;
      setLogMessage(message);
      await notifyDesktop({
        title: "Activity log opened",
        body: message,
      });
    },
    onError: (error) => {
      setLogMessage(
        error instanceof Error
          ? error.message
          : "AI Switch could not open the local activity log.",
      );
    },
  });

  const entries = useMemo(
    () =>
      lastCommandResults.timeline.map((entry) => ({
        key: entry.key,
        scopeLabel:
          entry.scope.type === "tool"
            ? formatToolScope(entry.scope.tool)
            : formatGlobalScope(entry.scope.id),
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
  const errorCount = entries.filter((entry) => entry.status === "error").length;
  const latestEntry = entries[0] ?? null;
  const historySummary = entries.length
    ? `${entries.length} event${entries.length === 1 ? "" : "s"}`
    : "Idle";
  const attentionSummary = errorCount
    ? `${errorCount} item${errorCount === 1 ? "" : "s"}`
    : "None";

  useEffect(() => {
    if (selectedEntryKey && entries.some((entry) => entry.key === selectedEntryKey)) {
      return;
    }
    setSelectedEntryKey(entries[0]?.key ?? null);
  }, [entries, selectedEntryKey]);

  useEffect(() => {
    if (externalClearSignal < 1) {
      return;
    }
    setSelectedEntryKey(null);
    setClearMessage("Cleared locally stored desktop activity.");
    setLogMessage("");
  }, [externalClearSignal]);

  useEffect(() => {
    if (externalOpenLogSignal < 1 || !entries.length) {
      return;
    }
    openActivityLog();
  }, [entries.length, externalOpenLogSignal]);

  const selectedEntry = entries.find((entry) => entry.key === selectedEntryKey) ?? entries[0] ?? null;

  function clearTimeline() {
    clearLastCommandResults();
    setSelectedEntryKey(null);
    setClearMessage("Cleared locally stored desktop activity.");
    setLogMessage("");
  }

  function openActivityLog() {
    if (!entries.length) {
      return;
    }

    const payload = entries.map((entry) => ({
      ...entry,
      recordedAt: new Date(entry.at).toISOString(),
    }));
    setClearMessage("");
    setLogMessage("");
    exportActivityLogMutation.mutate(JSON.stringify(payload, null, 2));
  }

  return (
    <SectionCard title="Activity" kicker="Recent activity">
      <div className="desktop-status-strip activity-status-strip">
        <article className="desktop-status-card">
          <span className="overview-current-set-cell-label">History</span>
          <p className="desktop-status-value">{historySummary}</p>
          <p className="inline-note">Local switch, verification, and setup events stay on this computer.</p>
        </article>
        <article className="desktop-status-card">
          <span className="overview-current-set-cell-label">Latest</span>
          <p className="desktop-status-value">{latestEntry?.label ?? "No activity yet"}</p>
          <p className="inline-note">Open the latest entry to inspect the recorded command and result.</p>
        </article>
        <article className="desktop-status-card">
          <span className="overview-current-set-cell-label">Attention</span>
          <p className="desktop-status-value">{attentionSummary}</p>
          <div className="desktop-status-pill-stack">
            <span className="pill pill-soft">Redacted</span>
            <span className="pill pill-soft">Local only</span>
          </div>
        </article>
      </div>
      <SplitView
        className="activity-layout"
        primaryClassName="activity-list-pane"
        secondaryClassName="activity-detail-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <article className="diagnostic-card activity-list-card">
              <div className="desktop-pane-section-header activity-list-header">
                <div>
                  <p className="card-kicker">Events</p>
                  <h3>Recent desktop activity</h3>
                </div>
                <span className="pill pill-soft">{latestEntry ? formatFullTimestamp(latestEntry.at) : "Idle"}</span>
              </div>
              <p className="inline-note">
                Latest first. Inspect one event at a time without leaving the current workspace.
              </p>
              <div className="activity-list-columns" aria-hidden="true">
                <span>Time</span>
                <span>Event</span>
                <span>Scope</span>
              </div>
              <div className="stack-list activity-table-rows">
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
                    <div className="activity-list-time">
                      <strong>{formatTimestamp(entry.at)}</strong>
                      <p className="inline-note">{formatDayTimestamp(entry.at)}</p>
                    </div>
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
                      <span>{entry.status === "success" ? "Success" : "Needs attention"}</span>
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
            </article>
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
                <div className="activity-detail-main">
                  <div className="activity-detail-copy stack-list">
                    <div className="desktop-pane-section-header">
                      <div>
                        <p className="card-kicker">Entry</p>
                        <h3>{selectedEntry.label}</h3>
                      </div>
                      <span
                        className={`pill ${selectedEntry.status === "success" ? "pill-ok" : "pill-warn"}`}
                      >
                        {selectedEntry.status === "success" ? "Success" : "Needs attention"}
                      </span>
                    </div>
                    <div className="activity-detail-summary">
                      <div>
                        <span className="overview-current-set-cell-label">Time</span>
                        <strong>{formatFullTimestamp(selectedEntry.at)}</strong>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">Scope</span>
                        <strong>{selectedEntry.scopeLabel}</strong>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">Result</span>
                        <strong>{selectedEntry.status === "success" ? "Success" : "Needs attention"}</strong>
                      </div>
                    </div>
                    <div className="activity-detail-block">
                      <div>
                        <p className="card-kicker">What happened</p>
                        <p className="inline-note">{selectedEntry.message}</p>
                      </div>
                      <div>
                        <p className="card-kicker">Result</p>
                        <p className="inline-note">
                          {selectedEntry.status === "success"
                            ? "Completed successfully."
                            : "Needs attention before you retry or continue."}
                        </p>
                      </div>
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
                    <div>
                      <p className="card-kicker">Command</p>
                      <p className="inline-note">
                        {selectedEntry.command ?? "Command details were not recorded for this event."}
                      </p>
                    </div>
                    <div>
                      <p className="card-kicker">Output</p>
                      <p className="inline-note">
                        {selectedEntry.resultSummary ??
                          (selectedEntry.status === "success"
                          ? "Snapshot updated successfully."
                          : "AI Switch recorded a recoverable failure for this event.")}
                      </p>
                    </div>
                    <KeyValueGrid
                      rows={[
                        {
                          label: "Recorded",
                          value: formatFullTimestamp(selectedEntry.at),
                        },
                        {
                          label: "Scope",
                          value: selectedEntry.scopeLabel,
                        },
                      ]}
                    />
                    {selectedEntry.command ? (
                      <div>
                        <p className="card-kicker">Recorded command</p>
                        <pre>{selectedEntry.command}</pre>
                      </div>
                    ) : null}
                  </div>
                  <aside className="activity-detail-rail">
                    <span className="overview-current-set-cell-label">Actions</span>
                    <p className="inline-note">
                      Export a support report only when this event needs deeper debugging or sharing.
                    </p>
                    {selectedEntry.status === "error" ? (
                      <div className="button-row button-row-column">
                        <button
                          className="ghost-button"
                          type="button"
                          disabled={exportBundleMutation.isPending}
                          onClick={() => exportBundleMutation.mutate()}
                        >
                          {exportBundleMutation.isPending ? "Exporting…" : "Export support report"}
                        </button>
                      </div>
                    ) : (
                      <p className="inline-note">No extra action is needed for this completed event.</p>
                    )}
                  </aside>
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
            <article className="diagnostic-card activity-session-card">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Local log</p>
                  <h3>Activity storage</h3>
                </div>
                <span className="pill pill-soft">On this computer</span>
              </div>
              {clearMessage || logMessage ? (
                <div className="stack-list">
                  <h4>{clearMessage ? "Timeline cleared" : "Log snapshot opened"}</h4>
                  <p className="inline-note">{clearMessage || logMessage}</p>
                </div>
              ) : (
                <div className="stack-list">
                  <p className="inline-note">
                    Keep a short local history while you are debugging switches, setup flows, or recovery actions.
                  </p>
                  <p className="inline-note">
                    Recent events stay on this computer and persist across relaunches.
                  </p>
                </div>
              )}
              {exportBundleMutation.data ? (
                <article className="diagnostic-card diagnostic-pass activity-session-card-nested">
                  <h4>Support report ready</h4>
                  <p className="inline-note">Saved {exportBundleMutation.data.filename}.</p>
                </article>
              ) : null}
              {exportBundleMutation.error ? (
                <article className="diagnostic-card diagnostic-warn activity-session-card-nested">
                  <h4>Support report could not be exported</h4>
                  <p className="inline-note">
                    {exportBundleMutation.error instanceof Error
                      ? exportBundleMutation.error.message
                      : "AI Switch could not complete that action."}
                  </p>
                </article>
              ) : null}
            </article>
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
      return "Detected sets";
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

function formatDayTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(timestamp);
}
