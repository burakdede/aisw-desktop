import { describe, expect, it } from "vitest";
import type { AppSnapshot, BackupEntry, DesktopSettings } from "../../lib/schemas";
import { makeToolStatus } from "../../test-support/runtime-tool-statuses";
import {
  BACKUPS_DATE_FILTER_OPTIONS,
  DEFAULT_BACKUPS_DATE_FILTER,
  DEFAULT_BACKUPS_TOOL_FILTER,
  BACKUPS_PANEL_COPY,
  BACKUPS_TOOL_FILTER_OPTIONS,
  backupIdCopyMessage,
  backupRowAriaLabel,
  buildBackupsEmptyState,
  buildBackupInspectorState,
  buildBackupRestoreSheetCopy,
  buildRestoreSheetState,
  filterBackups,
  normalizeBackupsDateFilter,
  normalizeBackupsToolFilter,
  resolveSelectedBackupId,
  sortBackups,
} from "./backups-panel-display";

function makeBackup(overrides: Partial<BackupEntry> = {}): BackupEntry {
  return {
    backup_id: "20260325T114502Z-claude-work",
    tool: "claude",
    profile: "work",
    created_at: "2026-03-25T11:45:02Z",
    ...overrides,
  };
}

function makeSettings(overrides: Partial<DesktopSettings> = {}): DesktopSettings {
  return {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
    profile_labels: {
      claude: { work: "Work Claude" },
      codex: { personal: "Personal Codex" },
    },
    profile_sets: [],
    ...overrides,
  };
}

function makeSnapshot(overrides: Partial<AppSnapshot> = {}): AppSnapshot {
  return {
    statuses: [
      makeToolStatus("claude", {
        stored_profiles: 1,
        active_profile: "work",
        auth_method: "oauth",
        credential_backend: "system-keyring",
        state_mode: "isolated",
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
      }),
      makeToolStatus("codex", {
        stored_profiles: 1,
        active_profile: "personal",
        auth_method: "oauth",
        credential_backend: "system-keyring",
        state_mode: "isolated",
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
      }),
    ],
    profiles: {
      claude: {
        active: "work",
        profiles: [{ name: "work", auth: "oauth", label: "" }],
      },
      codex: {
        active: "personal",
        profiles: [{ name: "personal", auth: "oauth", label: "" }],
      },
    },
    contexts: [],
    workspace_status: null,
    project_bindings: null,
    ...overrides,
  };
}

describe("backups-panel-display", () => {
  it("shares filter options and static panel copy", () => {
    expect(BACKUPS_TOOL_FILTER_OPTIONS).toEqual([
      { value: "all", label: "All tools" },
      { value: "claude", label: "Claude" },
      { value: "codex", label: "Codex" },
      { value: "gemini", label: "Gemini" },
    ]);
    expect(BACKUPS_DATE_FILTER_OPTIONS).toEqual([
      { value: "newest", label: "Newest first" },
      { value: "oldest", label: "Oldest first" },
    ]);
    expect(DEFAULT_BACKUPS_TOOL_FILTER).toBe("all");
    expect(DEFAULT_BACKUPS_DATE_FILTER).toBe("newest");
    expect(normalizeBackupsToolFilter("codex")).toBe("codex");
    expect(normalizeBackupsToolFilter("bad")).toBe("all");
    expect(normalizeBackupsDateFilter("oldest")).toBe("oldest");
    expect(normalizeBackupsDateFilter("bad", "oldest")).toBe("oldest");
    expect(BACKUPS_PANEL_COPY.toolbarAriaLabel).toBe("Backups filters");
    expect(BACKUPS_PANEL_COPY.inspector.restoreLabel).toBe("Restore…");
    expect(BACKUPS_PANEL_COPY.restoreSheet.cancelLabel).toBe("Cancel");
    expect(backupRowAriaLabel("Claude Code", "Work Claude")).toBe(
      "Inspect backup for Claude Code Work Claude",
    );
    expect(buildBackupsEmptyState(true)).toEqual({
      heading: "Loading backups…",
      detail: "Loading local restore points.",
    });
    expect(buildBackupsEmptyState(false)).toEqual({
      heading: "No backups found",
      detail:
        "Restore points appear here automatically before AI Switch changes a saved profile.",
    });
  });

  it("sorts and filters backups by tool and search query", () => {
    const settings = makeSettings();
    const snapshot = makeSnapshot();
    const backups = [
      makeBackup(),
      makeBackup({
        backup_id: "20260324T114502Z-codex-personal",
        tool: "codex",
        profile: "personal",
        created_at: "2026-03-24T11:45:02Z",
      }),
    ];

    expect(sortBackups(backups[0], backups[1], "newest")).toBeLessThan(0);
    expect(sortBackups(backups[0], backups[1], "oldest")).toBeGreaterThan(0);
    expect(filterBackups(backups, "codex", "", settings, snapshot)).toEqual([backups[1]]);
    expect(filterBackups(backups, "all", "work claude", settings, snapshot)).toEqual([
      backups[0],
    ]);
    expect(filterBackups(backups, "all", "personal codex", settings, snapshot)).toEqual([
      backups[1],
    ]);
  });

  it("resolves selected backup ids and inspector state", () => {
    const settings = makeSettings();
    const snapshot = makeSnapshot();
    const backups = [
      makeBackup(),
      makeBackup({
        backup_id: "20260324T114502Z-codex-personal",
        tool: "codex",
        profile: "personal",
        created_at: "2026-03-24T11:45:02Z",
      }),
    ];

    expect(resolveSelectedBackupId("20260324T114502Z-codex-personal", backups)).toBe(
      "20260324T114502Z-codex-personal",
    );
    expect(resolveSelectedBackupId("missing", backups)).toBe(
      "20260325T114502Z-claude-work",
    );
    expect(resolveSelectedBackupId(null, [])).toBeNull();

    expect(
      buildBackupInspectorState(
        "20260324T114502Z-codex-personal",
        backups,
        settings,
        snapshot,
      ),
    ).toEqual(
      expect.objectContaining({
        profileLabel: "Personal Codex",
        toolLabel: "Codex CLI",
        title: "Personal Codex",
        subtitle: "Codex CLI backup",
      }),
    );
  });

  it("builds restore sheet state and backup id copy messages", () => {
    const settings = makeSettings();
    const snapshot = makeSnapshot();
    const filteredBackups = [
      makeBackup({
        backup_id: "20260324T114502Z-codex-personal",
        tool: "codex",
        profile: "personal",
        created_at: "2026-03-24T11:45:02Z",
      }),
    ];
    const sortedBackups = [makeBackup(), ...filteredBackups];

    expect(
      buildRestoreSheetState(
        "20260325T114502Z-claude-work",
        "files",
        filteredBackups,
        sortedBackups,
        settings,
        snapshot,
      ),
    ).toEqual(
      expect.objectContaining({
        profileLabel: "Work Claude",
        toolLabel: "Claude Code",
        heading: "Restore “Work Claude”?",
        confirmLabel: "Restore Files",
      }),
    );
    expect(
      buildRestoreSheetState(
        null,
        null,
        filteredBackups,
        sortedBackups,
        settings,
        snapshot,
      ),
    ).toBeNull();

    expect(backupIdCopyMessage(true, "backup-123")).toBe("Copied backup ID.");
    expect(backupIdCopyMessage(false, "backup-123")).toBe(
      "Clipboard access is unavailable. Copy backup id backup-123 manually.",
    );
    expect(buildBackupRestoreSheetCopy("activate", "Work Claude", "Claude Code")).toEqual({
      kicker: "Restore point",
      heading: "Restore and Activate “Work Claude”?",
      detail: "AI Switch will restore the stored files and then activate Work Claude for Claude Code.",
      followup: "This restores the files first and only then switches the live profile.",
      confirmLabel: "Restore and Activate",
    });
  });
});
