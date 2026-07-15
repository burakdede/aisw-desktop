import { DATE_UNAVAILABLE_LABEL, parseStoredDate } from "./date-format";

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
  const leftSortKey = backupSortKey(left.created_at ?? left.backup_id);
  const rightSortKey = backupSortKey(right.created_at ?? right.backup_id);
  return rightSortKey.localeCompare(leftSortKey);
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
  if (normalized.includes("before-switch")) {
    return "Before profile switch";
  }
  if (normalized.includes("switch")) {
    return "Before profile switch";
  }
  if (normalized.includes("remove")) {
    return "Before removal";
  }
  if (normalized.includes("rename")) {
    return "Before rename";
  }
  return "Created restore point";
}

export function backupContainsLabel(entry: Pick<BackupEntryLike, "tool" | "profile">) {
  const target = resolveBackupTarget(entry.tool, entry.profile);
  if (target.tool === "gemini") {
    return "Profile data snapshot";
  }
  return "Profile files and config snapshot";
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

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEntry = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfEntry.getTime()) / (1000 * 60 * 60 * 24),
  );

  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (diffDays === 0) {
    return `Today, ${timeLabel}`;
  }

  if (diffDays === 1) {
    return `Yesterday, ${timeLabel}`;
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
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEntry = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfEntry.getTime()) / (1000 * 60 * 60 * 24),
  );

  const timeLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (diffDays === 0) {
    return `Today at ${timeLabel}`;
  }

  if (diffDays === 1) {
    return `Yesterday at ${timeLabel}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
