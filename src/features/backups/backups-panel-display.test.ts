import { describe, expect, it } from "vitest";
import type { AppSnapshot, BackupEntry, DesktopSettings } from "../../lib/schemas";
import {
  backupIdCopyMessage,
  buildBackupInspectorState,
  buildRestoreSheetState,
  filterBackups,
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
      {
        tool: "claude",
        binary_found: true,
        stored_profiles: 1,
        active_profile: "work",
        auth_method: "oauth",
        credential_backend: "system-keyring",
        state_mode: "isolated",
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
        token_warning: null,
        warnings: [],
      },
      {
        tool: "codex",
        binary_found: true,
        stored_profiles: 1,
        active_profile: "personal",
        auth_method: "oauth",
        credential_backend: "system-keyring",
        state_mode: "isolated",
        active_profile_applied: true,
        credentials_present: true,
        permissions_ok: true,
        token_warning: null,
        warnings: [],
      },
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
        filteredBackups,
        sortedBackups,
        settings,
        snapshot,
      ),
    ).toEqual(
      expect.objectContaining({
        profileLabel: "Work Claude",
        toolLabel: "Claude Code",
      }),
    );
    expect(
      buildRestoreSheetState(null, filteredBackups, sortedBackups, settings, snapshot),
    ).toBeNull();

    expect(backupIdCopyMessage(true, "backup-123")).toBe("Copied backup ID.");
    expect(backupIdCopyMessage(false, "backup-123")).toBe(
      "Clipboard access is unavailable. Copy backup id backup-123 manually.",
    );
  });
});
