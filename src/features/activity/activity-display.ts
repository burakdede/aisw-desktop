import { DATE_UNAVAILABLE_LABEL } from "../../lib/display-copy";
import { toolDisplayName } from "../../lib/tool-display";
import type { ActivityTimelineEntry } from "../shared/lastCommandResult";

export type ActivityFilter = "all" | "success" | "error";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const GENERIC_ACTIVITY_RESULT = "snapshot updated successfully.";

export const ACTIVITY_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "error", label: "Failed" },
] as const;

export type ActivityEntry = {
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

export function buildActivityEntries(timeline: ActivityTimelineEntry[]): ActivityEntry[] {
  return timeline.map((entry) => ({
    key: entry.key,
    scopeLabel: activityScopeLabel(entry.scope),
    scopeType: entry.scope.type,
    scopeTool: entry.scope.type === "tool" ? entry.scope.tool : undefined,
    label: entry.label,
    status: entry.status,
    message: entry.message,
    remediation: entry.remediation,
    command: entry.command,
    resultSummary: entry.resultSummary,
    at: entry.at,
  }));
}

export function buildActivityExportBody(entries: ActivityEntry[]) {
  return JSON.stringify(
    entries.map((entry) => ({
      ...entry,
      recordedAt: new Date(entry.at).toISOString(),
    })),
    null,
    2,
  );
}

export function buildActivityExportMessage(filename: string) {
  return `Opened ${filename}.`;
}

export function resolveSelectedActivityEntryKey(
  currentEntryKey: string | null,
  entries: ActivityEntry[],
) {
  if (currentEntryKey && entries.some((entry) => entry.key === currentEntryKey)) {
    return currentEntryKey;
  }

  return entries[0]?.key ?? null;
}

export function activityScopeLabel(scope: { type: "tool"; tool: string } | { type: "global"; id: string }) {
  return scope.type === "tool" ? toolDisplayName(scope.tool) : activityGlobalScopeLabel(scope.id);
}

export function activityGlobalScopeLabel(id: string) {
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

export function activityStatusLabel(status: ActivityEntry["status"]) {
  return status === "success" ? "Success" : "Failed";
}

export function activityStatusSymbol(
  status: ActivityEntry["status"],
  variant: "row" | "inspector",
) {
  if (status === "error") {
    return "▲";
  }
  return variant === "inspector" ? "●" : "✓";
}

export function filterActivity(entries: ActivityEntry[], search: string, filter: ActivityFilter) {
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

export function groupActivityEntries(entries: ActivityEntry[], now = new Date()) {
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - DAY_IN_MS;

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

export function activitySecondaryLine(entry: ActivityEntry) {
  const targetSummary = parseActivityTargetSummary(entry);
  if (targetSummary) {
    return targetSummary;
  }

  if (entry.resultSummary && !isGenericActivityResult(entry.resultSummary)) {
    return entry.resultSummary;
  }

  return entry.scopeLabel;
}

export function activityTrailingLine(entry: ActivityEntry) {
  if (entry.resultSummary && !isGenericActivityResult(entry.resultSummary)) {
    return entry.resultSummary;
  }

  if (entry.remediation) {
    return "Recovery available";
  }

  return activityStatusLabel(entry.status);
}

export function formatActivityTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

export function formatFullActivityTimestamp(timestamp: number, now = new Date()) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return DATE_UNAVAILABLE_LABEL;
  }

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - DAY_IN_MS;
  const value = date.getTime();
  const time = formatActivityTimestamp(value);

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

function activityPreview(entry: ActivityEntry) {
  return entry.message;
}

function parseActivityTargetSummary(entry: ActivityEntry) {
  if (entry.scopeType === "tool" && entry.scopeTool) {
    const toolLabel = toolDisplayName(entry.scopeTool);
    const switchedMatch = entry.message.match(/\b(?:switched|re-applied)\b.*?\bto\s+([^.;]+)/i);
    if (switchedMatch?.[1]) {
      return `${toolLabel} → ${switchedMatch[1].trim()}`;
    }

    const profileMatch = entry.message.match(/\bprofile\s+([^.;]+)/i);
    if (profileMatch?.[1]) {
      return `${toolLabel} · ${profileMatch[1].trim()}`;
    }

    return toolLabel;
  }

  return null;
}

function isGenericActivityResult(value: string) {
  return value.trim().toLowerCase() === GENERIC_ACTIVITY_RESULT;
}
