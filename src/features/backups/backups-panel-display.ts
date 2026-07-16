import {
  backupContainsLabel,
  backupReasonLabel,
  compareBackupsNewestFirst,
  formatBackupInspectorTimestamp,
  resolveBackupTarget,
} from "../../lib/backups";
import {
  clipboardCopiedMessage,
  clipboardUnavailableManualMessage,
} from "../../lib/display-copy";
import { toolProfileDisplayLabel } from "../../lib/profile-display";
import type { AppSnapshot, BackupEntry, DesktopSettings } from "../../lib/schemas";
import { toolDisplayName } from "../../lib/tool-display";

export type ToolFilter = "all" | "claude" | "codex" | "gemini";
export type DateFilter = "newest" | "oldest";
export type PendingRestoreMode = "files" | "activate";

export const BACKUPS_TOOL_FILTER_OPTIONS = [
  { value: "all", label: "All tools" },
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
  { value: "gemini", label: "Gemini" },
] as const satisfies ReadonlyArray<{ value: ToolFilter; label: string }>;

export const BACKUPS_DATE_FILTER_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
] as const satisfies ReadonlyArray<{ value: DateFilter; label: string }>;

export const BACKUPS_PANEL_COPY = {
  toolbarAriaLabel: "Backups filters",
  toolFilterLabel: "Tool",
  dateFilterLabel: "Date",
  searchAriaLabel: "Search backups",
  searchPlaceholder: "Search backups…",
  toolbarMenuMoreAriaLabel: "Backups more actions",
  toolbarMenuAriaLabel: "Backups actions",
  tableAriaLabel: "Backups list",
  refreshLabel: "Refresh",
  columns: {
    created: "Created",
    tool: "Tool",
    profile: "Profile",
    reason: "Reason",
  },
  emptyStates: {
    loading: {
      heading: "Loading backups…",
      detail: "Loading local restore points.",
    },
    none: {
      heading: "No backups found",
      detail: "Restore points appear here automatically before AI Switch changes a saved profile.",
    },
    unselected: {
      heading: "No backup selected",
      detail: "Choose a restore point to inspect its contents and restore options.",
    },
  },
  inspector: {
    backLabel: "Back",
    restoreLabel: "Restore…",
    menuAriaLabel: "Backup actions",
    restoreAndActivateLabel: "Restore and Activate…",
    openProfileLabel: "Open Profile",
    copyBackupIdLabel: "Copy Backup ID",
    revealBackupFolderLabel: "Reveal Backup Folder",
    infoLabels: {
      created: "Created",
      reason: "Reason",
      contains: "Contains",
      backupId: "Backup ID",
    },
    reasonFallback: "Created restore point",
    containsFallback: "Profile files",
    copyLabel: "Copy",
  },
  restoreSheet: {
    ariaLabel: "Restore Backup",
    kicker: "Restore point",
    profileLabel: "Profile",
    toolLabel: "Tool",
    createdLabel: "Created",
    cancelLabel: "Cancel",
    restoreFilesLabel: "Restore Files",
    restoreAndActivateLabel: "Restore and Activate",
  },
} as const;

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
  confirmLabel: string;
  detail: string;
  followup: string;
  heading: string;
  kicker: string;
  profileLabel: string;
  toolLabel: string;
};

type BackupPresentation = {
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

  const presentation = buildBackupPresentation(selectedBackup, settings, snapshot);
  const created = formatBackupInspectorTimestamp(
    selectedBackup.created_at ?? selectedBackup.backup_id,
  );

  return {
    ...presentation,
    reason: backupReasonLabel(selectedBackup),
    contains: backupContainsLabel(selectedBackup),
    created,
    title: presentation.profileLabel,
    subtitle: `${presentation.toolLabel} backup`,
  };
}

export function buildRestoreSheetState(
  pendingRestoreBackupId: string | null,
  pendingRestoreMode: PendingRestoreMode | null,
  filteredBackups: BackupEntry[],
  sortedBackups: BackupEntry[],
  settings: DesktopSettings,
  snapshot: AppSnapshot,
): BackupRestoreSheetState | null {
  if (!pendingRestoreBackupId || !pendingRestoreMode) {
    return null;
  }

  const entry =
    filteredBackups.find((candidate) => candidate.backup_id === pendingRestoreBackupId) ??
    sortedBackups.find((candidate) => candidate.backup_id === pendingRestoreBackupId) ??
    null;
  if (!entry) {
    return null;
  }

  const presentation = buildBackupPresentation(entry, settings, snapshot);
  return {
    ...presentation,
    ...buildBackupRestoreSheetCopy(
      pendingRestoreMode,
      presentation.profileLabel,
      presentation.toolLabel,
    ),
  };
}

export function backupIdCopyMessage(clipboardAvailable: boolean, backupId: string) {
  return clipboardAvailable
    ? clipboardCopiedMessage("backup ID")
    : clipboardUnavailableManualMessage("backup id", backupId);
}

export function buildBackupsEmptyState(isLoading: boolean) {
  return isLoading
    ? BACKUPS_PANEL_COPY.emptyStates.loading
    : BACKUPS_PANEL_COPY.emptyStates.none;
}

export function backupRowAriaLabel(toolLabel: string, profileLabel: string) {
  return `Inspect backup for ${toolLabel} ${profileLabel}`;
}

export function buildBackupRestoreSheetCopy(
  mode: PendingRestoreMode,
  profileLabel: string,
  toolLabel: string,
) {
  return mode === "files"
    ? {
        kicker: BACKUPS_PANEL_COPY.restoreSheet.kicker,
        heading: `Restore “${profileLabel}”?`,
        detail: `This replaces the stored ${toolLabel} profile files with the selected restore point.`,
        followup: `The active ${toolLabel} account will not change until you activate the profile.`,
        confirmLabel: BACKUPS_PANEL_COPY.restoreSheet.restoreFilesLabel,
      }
    : {
        kicker: BACKUPS_PANEL_COPY.restoreSheet.kicker,
        heading: `Restore and Activate “${profileLabel}”?`,
        detail: `AI Switch will restore the stored files and then activate ${profileLabel} for ${toolLabel}.`,
        followup: "This restores the files first and only then switches the live profile.",
        confirmLabel: BACKUPS_PANEL_COPY.restoreSheet.restoreAndActivateLabel,
      };
}

function buildBackupPresentation(
  entry: BackupEntry,
  settings: DesktopSettings,
  snapshot: AppSnapshot,
): BackupPresentation {
  const target = resolveBackupTarget(entry.tool, entry.profile);
  return {
    entry,
    target,
    profileLabel: toolProfileDisplayLabel(
      settings,
      snapshot,
      target.tool,
      target.profile,
    ),
    toolLabel: toolDisplayName(target.tool),
  };
}
