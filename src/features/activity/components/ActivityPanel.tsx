import { SectionCard } from "../../../components/SectionCard";
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

  const entries: ActivityEntry[] = [
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
  ].sort((left, right) => right.at - left.at);

  return (
    <SectionCard title="Activity" kicker="Recent changes and checks">
      <article className="desktop-pane-hero activity-hero">
        <div className="desktop-pane-hero-copy">
          <p className="card-kicker">Timeline</p>
          <h3>Keep switching and recovery events in one desktop timeline</h3>
          <p className="inline-note">
            Recent profile changes, verification runs, setup actions, and recovery outcomes are shown in one native activity stream instead of separate logs or terminal output.
          </p>
        </div>
        <div className="desktop-pane-hero-pills" aria-label="Activity highlights">
          <span className="status-pill">
            {entries.length} session event{entries.length === 1 ? "" : "s"}
          </span>
          <span className="status-pill">Latest first</span>
          <span className="status-pill">Local only</span>
        </div>
      </article>
      <article className="diagnostic-card desktop-pane-intro">
        <h3>Session timeline</h3>
        <p className="inline-note">
          Review the most recent switch, recovery, verification, and setup actions without leaving the app shell.
        </p>
        <p className="inline-note">
          {entries.length ? `${entries.length} recent event${entries.length === 1 ? "" : "s"} in this session.` : "No local events recorded in this session yet."}
        </p>
      </article>
      <div className="stack-list desktop-pane-stack">
        {entries.length ? (
          entries.map((entry) => (
            <article key={entry.key} className={`list-row activity-row activity-row-${entry.status}`}>
              <div>
                <strong>{entry.label}</strong>
                <p>{entry.message}</p>
                {entry.remediation ? <p>{entry.remediation}</p> : null}
              </div>
              <div className="activity-meta">
                <span className={`pill ${entry.status === "success" ? "pill-ok" : "pill-warn"}`}>
                  {entry.status === "success" ? "Success" : "Needs attention"}
                </span>
                <span>{entry.scopeLabel}</span>
                <span>{formatTimestamp(entry.at)}</span>
              </div>
            </article>
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
      return "Context";
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
