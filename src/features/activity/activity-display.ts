import { DATE_UNAVAILABLE_LABEL } from "../../lib/display-copy";
import { DESKTOP_ACTION_COPY } from "../../lib/desktop-action-copy";
import { toolDisplayName } from "../../lib/tool-display";
import type { ActivityTimelineEntry } from "../shared/lastCommandResult";

export type ActivityFilter = "all" | "success" | "error";
type ActivityStatus = ActivityEntry["status"];
type ActivityStatusVariant = "row" | "inspector";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const GENERIC_ACTIVITY_RESULT = "snapshot updated successfully.";
const ACTIVITY_SCOPE_FALLBACK_LABEL = "App";
const ACTIVITY_RECOVERY_AVAILABLE_LABEL = "Recovery available";
const ACTIVITY_TIME_PREFIX = {
  today: "Today at",
  yesterday: "Yesterday at",
} as const;

export const ACTIVITY_EMPTY_STATE = {
  heading: "No recent activity",
  detail:
    "Local switch, verification, and setup events will appear here as soon as you use the app.",
} as const;

export const ACTIVITY_EMPTY_SELECTION_STATE = {
  heading: "No event selected",
  detail: "Choose an event to inspect its recorded details.",
} as const;

export const ACTIVITY_CLEAR_DIALOG = {
  ariaLabel: "Clear Activity History",
  kicker: "History",
  heading: "Clear Activity History?",
  detail:
    "This removes the locally stored desktop timeline for this Mac. Credentials remain untouched.",
  confirmLabel: "Clear History",
} as const;

export const ACTIVITY_FOOTER_COPY =
  "Activity is stored locally and credentials are always redacted.";

export const ACTIVITY_INSPECTOR_COPY = {
  recordedLabel: "Recorded",
  scopeLabel: "Scope",
  durationLabel: "Duration",
  durationValue: "Not Recorded",
  initiatedByLabel: "Initiated by",
  initiatedByValue: "Desktop app",
  recoveryLabel: "Recovery",
  recoveryValue: "None required",
  commandHeading: "Recorded Command",
  commandFallback: "Command details were not recorded for this event.",
  resultHeading: "Redacted Result",
  successResultFallback: "Snapshot updated successfully.",
  errorResultFallback: "No redacted result payload was recorded for this event.",
} as const;

export const ACTIVITY_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "success", label: "Success" },
  { value: "error", label: "Failed" },
] as const;

export const ACTIVITY_TOOLBAR_COPY = {
  searchAriaLabel: "Search activity",
  searchPlaceholder: "Search activity…",
  filterAriaLabel: "Activity filters",
  menuAriaLabel: "Activity more actions",
  menuLabel: "Activity actions",
  refreshLabel: "Refresh",
  openLogLabel: "Open Log File",
  exportLabel: "Export Redacted Activity…",
  clearLabel: "Clear Activity History…",
} as const;

export const ACTIVITY_STATUS_NOTIFICATION = {
  logOpened: "Activity log opened",
  redactedExported: "Redacted activity exported",
  clearMessage: "Cleared locally stored desktop activity.",
} as const;

const ACTIVITY_GLOBAL_SCOPE_LABELS = {
  "switch-all": DESKTOP_ACTION_COPY.quickSwitchLabel,
  "profile-set": "Saved set",
  context: "Sets",
  workspace: "Project rules",
  backup: "Backups",
  settings: "Settings",
  setup: "Setup",
} as const;

const ACTIVITY_STATUS_LABELS: Record<ActivityStatus, string> = {
  success: "Success",
  error: "Failed",
};

const ACTIVITY_STATUS_SYMBOLS: Record<ActivityStatus, Record<ActivityStatusVariant, string>> = {
  success: {
    row: "✓",
    inspector: "●",
  },
  error: {
    row: "▲",
    inspector: "▲",
  },
};

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

export type ActivityInspectorRow = {
  label: string;
  value: string;
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

export function activityFooterMessage(message: string) {
  return message ? `${ACTIVITY_FOOTER_COPY} ${message}` : ACTIVITY_FOOTER_COPY;
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
  return ACTIVITY_GLOBAL_SCOPE_LABELS[id as keyof typeof ACTIVITY_GLOBAL_SCOPE_LABELS]
    ?? ACTIVITY_SCOPE_FALLBACK_LABEL;
}

export function activityStatusLabel(status: ActivityStatus) {
  return ACTIVITY_STATUS_LABELS[status];
}

export function activityStatusSymbol(
  status: ActivityStatus,
  variant: ActivityStatusVariant,
) {
  return ACTIVITY_STATUS_SYMBOLS[status][variant];
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
    return ACTIVITY_RECOVERY_AVAILABLE_LABEL;
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
    return `${ACTIVITY_TIME_PREFIX.today} ${time}`;
  }

  if (value >= yesterdayStart) {
    return `${ACTIVITY_TIME_PREFIX.yesterday} ${time}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function buildActivityInspectorRows(
  entry: ActivityEntry,
  now = new Date(),
): ActivityInspectorRow[] {
  return [
    {
      label: ACTIVITY_INSPECTOR_COPY.recordedLabel,
      value: formatFullActivityTimestamp(entry.at, now),
    },
    {
      label: ACTIVITY_INSPECTOR_COPY.durationLabel,
      value: ACTIVITY_INSPECTOR_COPY.durationValue,
    },
    {
      label: ACTIVITY_INSPECTOR_COPY.initiatedByLabel,
      value: ACTIVITY_INSPECTOR_COPY.initiatedByValue,
    },
    {
      label: ACTIVITY_INSPECTOR_COPY.recoveryLabel,
      value: entry.remediation ?? ACTIVITY_INSPECTOR_COPY.recoveryValue,
    },
  ];
}

export function activityRecordedCommand(entry: ActivityEntry) {
  return entry.command ?? ACTIVITY_INSPECTOR_COPY.commandFallback;
}

export function activityRecordedResult(entry: ActivityEntry) {
  if (entry.resultSummary) {
    return entry.resultSummary;
  }

  return entry.status === "success"
    ? ACTIVITY_INSPECTOR_COPY.successResultFallback
    : ACTIVITY_INSPECTOR_COPY.errorResultFallback;
}

export function buildActivityScopeValue(entry: ActivityEntry) {
  return entry.scopeType === "tool" && entry.scopeTool ? toolDisplayName(entry.scopeTool) : entry.scopeLabel;
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
