import {
  backupContainsLabel,
  backupReasonLabel,
  compareBackupsNewestFirst,
  formatBackupInspectorTimestamp,
  resolveBackupTarget,
} from "../../lib/backups";
import { toolProfileDisplayLabel } from "../../lib/profile-display";
import type { AppSnapshot, BackupEntry, DesktopSettings } from "../../lib/schemas";
import { toolDisplayName } from "../../lib/tool-display";

export type ToolFilter = "all" | "claude" | "codex" | "gemini";
export type DateFilter = "newest" | "oldest";
export type PendingRestoreMode = "files" | "activate";

export type BackupInspectorState = {
  entry: BackupEntry;
  target: ReturnType<typeof resolveBackupTarget>;
  profileLabel: string;
  reason: string | null;
  contains: string | null;
  created: string;
  toolLabel: string;
  title: string;
  subtitle: string;
};

export type BackupRestoreSheetState = {
  entry: BackupEntry;
  target: ReturnType<typeof resolveBackupTarget>;
  profileLabel: string;
  toolLabel: string;
};

export function sortBackups(
  left: BackupEntry,
  right: BackupEntry,
  mode: DateFilter,
) {
  return mode === "newest"
    ? compareBackupsNewestFirst(left, right)
    : compareBackupsNewestFirst(right, left);
}

export function filterBackups(
  backups: BackupEntry[],
  toolFilter: ToolFilter,
  search: string,
  settings: DesktopSettings,
  snapshot: AppSnapshot,
) {
  const normalizedQuery = search.trim().toLowerCase();

  return backups.filter((entry) => {
    const target = resolveBackupTarget(entry.tool, entry.profile);
    if (toolFilter !== "all" && target.tool !== toolFilter) {
      return false;
    }
    if (!normalizedQuery) {
      return true;
    }
    const profileLabel = toolProfileDisplayLabel(
      settings,
      snapshot,
      target.tool,
      target.profile,
    );
    return [
      entry.backup_id,
      toolDisplayName(target.tool),
      target.profile,
      profileLabel,
      backupReasonLabel(entry),
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

export function resolveSelectedBackupId(
  currentBackupId: string | null,
  backups: BackupEntry[],
) {
  if (currentBackupId && backups.some((entry) => entry.backup_id === currentBackupId)) {
    return currentBackupId;
  }
  return backups[0]?.backup_id ?? null;
}

export function buildBackupInspectorState(
  selectedBackupId: string | null,
  backups: BackupEntry[],
  settings: DesktopSettings,
  snapshot: AppSnapshot,
): BackupInspectorState | null {
  const selectedBackup =
    backups.find((entry) => entry.backup_id === selectedBackupId) ?? backups[0] ?? null;
  if (!selectedBackup) {
    return null;
  }

  const target = resolveBackupTarget(selectedBackup.tool, selectedBackup.profile);
  const profileLabel = toolProfileDisplayLabel(
    settings,
    snapshot,
    target.tool,
    target.profile,
  );
  const created = formatBackupInspectorTimestamp(
    selectedBackup.created_at ?? selectedBackup.backup_id,
  );
  const toolLabel = toolDisplayName(target.tool);

  return {
    entry: selectedBackup,
    target,
    profileLabel,
    reason: backupReasonLabel(selectedBackup),
    contains: backupContainsLabel(selectedBackup),
    created,
    toolLabel,
    title: profileLabel,
    subtitle: `${toolLabel} backup`,
  };
}

export function buildRestoreSheetState(
  pendingRestoreBackupId: string | null,
  filteredBackups: BackupEntry[],
  sortedBackups: BackupEntry[],
  settings: DesktopSettings,
  snapshot: AppSnapshot,
): BackupRestoreSheetState | null {
  if (!pendingRestoreBackupId) {
    return null;
  }

  const entry =
    filteredBackups.find((candidate) => candidate.backup_id === pendingRestoreBackupId) ??
    sortedBackups.find((candidate) => candidate.backup_id === pendingRestoreBackupId) ??
    null;
  if (!entry) {
    return null;
  }

  const target = resolveBackupTarget(entry.tool, entry.profile);
  const profileLabel = toolProfileDisplayLabel(
    settings,
    snapshot,
    target.tool,
    target.profile,
  );

  return {
    entry,
    target,
    profileLabel,
    toolLabel: toolDisplayName(target.tool),
  };
}

export function backupIdCopyMessage(clipboardAvailable: boolean, backupId: string) {
  return clipboardAvailable
    ? "Copied backup ID."
    : `Clipboard access is unavailable. Copy backup id ${backupId} manually.`;
}
