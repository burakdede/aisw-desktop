import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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

export function ActivityPanel({ externalClearSignal = 0 }: { externalClearSignal?: number }) {
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
  }, [externalClearSignal]);

  const selectedEntry = entries.find((entry) => entry.key === selectedEntryKey) ?? entries[0] ?? null;

  function clearTimeline() {
    clearLastCommandResults();
    setSelectedEntryKey(null);
    setClearMessage("Cleared locally stored desktop activity.");
  }

  return (
    <SectionCard
      title="Activity"
      kicker="Recent activity"
      actions={
        <button
          className="ghost-button"
          type="button"
          disabled={!entries.length}
          onClick={clearTimeline}
        >
          Clear history
        </button>
      }
    >
      <SplitView
        className="activity-layout"
        primaryClassName="activity-list-pane"
        secondaryClassName="activity-detail-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <article className="diagnostic-card activity-overview-card">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Timeline</p>
                  <h3>
                    {entries.length
                      ? `${entries.length} event${entries.length === 1 ? "" : "s"}`
                      : "No events yet"}
                  </h3>
                </div>
                <span className="pill pill-soft">On this Mac</span>
              </div>
              <p className="inline-note">
                Latest first. Review local switch, verification, setup, and recovery events in one
                persistent desktop timeline.
              </p>
              <div className="activity-overview-meta">
                <div>
                  <span className="overview-current-set-cell-label">History</span>
                  <strong>{entries.length ? `${entries.length} event${entries.length === 1 ? "" : "s"}` : "Idle"}</strong>
                  <p className="inline-note">Recent events stay on this Mac and persist across relaunches.</p>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Latest scope</span>
                  <strong>{latestEntry?.scopeLabel ?? "No activity yet"}</strong>
                  <p className="inline-note">{latestEntry ? latestEntry.label : "Run a switch, verification, or settings change to populate the timeline."}</p>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Needs attention</span>
                  <strong>{errorCount ? `${errorCount} item${errorCount === 1 ? "" : "s"}` : "None"}</strong>
                  <p className="inline-note">
                    {errorCount ? "Open the failing event and export a report if you need support." : "Recent recorded events completed without extra recovery steps."}
                  </p>
                </div>
              </div>
            </article>
            <article className="diagnostic-card activity-list-card">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Events</p>
                  <h3>Recent desktop activity</h3>
                </div>
                <p className="inline-note">
                  Inspect one event at a time and keep the detail pane focused on what happened next.
                </p>
              </div>
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
                        <p className="card-kicker">Inspector</p>
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
                    <div className="activity-detail-meta">
                      <div>
                        <span className="overview-current-set-cell-label">Timeline</span>
                        <strong>{formatTimestamp(selectedEntry.at)}</strong>
                        <p className="inline-note">Recent desktop events stay local to this Mac unless you export a support report.</p>
                      </div>
                      <div>
                        <span className="overview-current-set-cell-label">Recorded scope</span>
                        <strong>{selectedEntry.scopeLabel}</strong>
                        <p className="inline-note">{selectedEntry.label}</p>
                      </div>
                    </div>
                    <div>
                      <p className="card-kicker">What happened</p>
                      <p className="inline-note">{selectedEntry.message}</p>
                    </div>
                    <div>
                      <p className="card-kicker">Desktop record</p>
                      <p className="inline-note">
                        {selectedEntry.resultSummary ??
                          (selectedEntry.status === "success"
                          ? "Snapshot updated successfully."
                          : "AI Switch recorded a recoverable failure for this event.")}
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
                    <KeyValueGrid
                      rows={[
                        {
                          label: "Command",
                          value:
                            selectedEntry.command ?? "Command details were not recorded for this event.",
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
                  <p className="card-kicker">Session</p>
                  <h3>Local timeline state</h3>
                </div>
                <span className="pill pill-soft">On this Mac</span>
              </div>
              {clearMessage ? (
                <div className="stack-list">
                  <h4>Timeline cleared</h4>
                  <p className="inline-note">{clearMessage}</p>
                </div>
              ) : (
                <p className="inline-note">
                  Keep a short local history while you are debugging switches, setup flows, or recovery actions.
                </p>
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
