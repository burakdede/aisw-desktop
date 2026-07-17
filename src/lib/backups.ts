import { DAY_IN_MS, calendarDayDifference } from "./calendar-time";
import { DATE_UNAVAILABLE_LABEL, parseStoredDate } from "./date-format";

const BACKUP_REASON_RULES = [
  {
    patterns: ["before-switch", "switch"],
    label: "Before profile switch",
  },
  {
    patterns: ["remove"],
    label: "Before removal",
  },
  {
    patterns: ["rename"],
    label: "Before rename",
  },
] as const;

const BACKUP_REASON_FALLBACK_LABEL = "Created restore point";
const GEMINI_BACKUP_CONTENTS_LABEL = "Profile data snapshot";
const DEFAULT_BACKUP_CONTENTS_LABEL = "Profile files and config snapshot";
const BACKUP_TIME_COPY = {
  todayPrefix: "Today",
  yesterdayPrefix: "Yesterday",
  inspectorConnector: "at",
} as const;

export type BackupLike = {
  backup_id: string;
  created_at?: string | null;
};

export type BackupTarget = {
  tool: string;
  profile: string;
};

export type BackupEntryLike = BackupLike & BackupTarget;

export function compareBackupsNewestFirst(left: BackupLike, right: BackupLike) {
  const leftSortKey = backupSortKey(backupTimestampValue(left));
  const rightSortKey = backupSortKey(backupTimestampValue(right));
  return rightSortKey.localeCompare(leftSortKey);
}

export function backupTimestampValue(backup: BackupLike) {
  return backup.created_at ?? backup.backup_id;
}

export function resolveBackupTarget(tool: string, profile: string): BackupTarget {
  if (profile.includes("/")) {
    const [resolvedTool, resolvedProfile] = profile.split("/", 2);
    if (resolvedTool && resolvedProfile) {
      return { tool: resolvedTool, profile: resolvedProfile };
    }
  }
  return { tool, profile };
}

export function backupReasonLabel(entry: Pick<BackupLike, "backup_id">) {
  const normalized = entry.backup_id.toLowerCase();
  for (const rule of BACKUP_REASON_RULES) {
    if (rule.patterns.some((pattern) => normalized.includes(pattern))) {
      return rule.label;
    }
  }
  return BACKUP_REASON_FALLBACK_LABEL;
}

export function backupContainsLabel(entry: Pick<BackupEntryLike, "tool" | "profile">) {
  const target = resolveBackupTarget(entry.tool, entry.profile);
  if (target.tool === "gemini") {
    return GEMINI_BACKUP_CONTENTS_LABEL;
  }
  return DEFAULT_BACKUP_CONTENTS_LABEL;
}

export function formatBackupInspectorTimestamp(value: string) {
  const date = parseStoredDate(value);
  if (!date) {
    return DATE_UNAVAILABLE_LABEL;
  }
  return formatFriendlyInspectorDate(date);
}

export function formatBackupListTimestamp(value: string, now = new Date()) {
  const date = parseStoredDate(value);
  if (!date) {
    return DATE_UNAVAILABLE_LABEL;
  }

  const diffDays = calendarDayDifference(date, now);
  const timeLabel = formatBackupTime(date);

  if (diffDays === 0) {
    return `${BACKUP_TIME_COPY.todayPrefix}, ${timeLabel}`;
  }

  if (diffDays === 1) {
    return `${BACKUP_TIME_COPY.yesterdayPrefix}, ${timeLabel}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: now.getFullYear() === date.getFullYear() ? undefined : "numeric",
  }).format(date);
}

function backupSortKey(value: string) {
  const date = parseStoredDate(value);
  if (date) {
    return date.toISOString();
  }
  return value;
}

function formatFriendlyInspectorDate(date: Date, now = new Date()) {
  const diffDays = calendarDayDifference(date, now);
  const timeLabel = formatBackupTime(date);

  if (diffDays === 0) {
    return `${BACKUP_TIME_COPY.todayPrefix} ${BACKUP_TIME_COPY.inspectorConnector} ${timeLabel}`;
  }

  if (diffDays === 1) {
    return `${BACKUP_TIME_COPY.yesterdayPrefix} ${BACKUP_TIME_COPY.inspectorConnector} ${timeLabel}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatBackupTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
