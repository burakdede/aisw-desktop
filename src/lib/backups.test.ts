import { describe, expect, it } from "vitest";
import { DATE_UNAVAILABLE_LABEL } from "./date-format";
import {
  backupContainsLabel,
  backupReasonLabel,
  backupTimestampValue,
  compareBackupsNewestFirst,
  formatBackupInspectorTimestamp,
  formatBackupListTimestamp,
  resolveBackupTarget,
} from "./backups";

describe("backups", () => {
  it("sorts backups newest first", () => {
    expect(
      compareBackupsNewestFirst(
        { backup_id: "2026-07-12T10:00:00Z" },
        { backup_id: "2026-07-11T10:00:00Z" },
      ),
    ).toBeLessThan(0);
  });

  it("resolves embedded tool/profile targets", () => {
    expect(resolveBackupTarget("claude", "codex/personal")).toEqual({
      tool: "codex",
      profile: "personal",
    });
    expect(resolveBackupTarget("agy", "lab")).toEqual({
      tool: "antigravity",
      profile: "lab",
    });
    expect(resolveBackupTarget("claude", "agy/lab")).toEqual({
      tool: "antigravity",
      profile: "lab",
    });
    expect(resolveBackupTarget("claude", "personal")).toEqual({
      tool: "claude",
      profile: "personal",
    });
  });

  it("shares backup reason and contents labels", () => {
    expect(backupReasonLabel({ backup_id: "claude-before-switch-1" })).toBe(
      "Before profile switch",
    );
    expect(backupReasonLabel({ backup_id: "claude-remove-1" })).toBe("Before removal");
    expect(backupReasonLabel({ backup_id: "claude-rename-1" })).toBe("Before rename");
    expect(backupReasonLabel({ backup_id: "claude-manual-1" })).toBe("Created restore point");

    expect(backupContainsLabel({ tool: "gemini", profile: "personal" })).toBe(
      "Profile data snapshot",
    );
    expect(backupContainsLabel({ tool: "claude", profile: "personal" })).toBe(
      "Profile files and config snapshot",
    );
  });

  it("formats backup timestamps for list and inspector views", () => {
    const now = new Date("2026-07-15T12:00:00Z");

    expect(
      backupTimestampValue({
        backup_id: "2026-07-15T08:30:00Z-claude-work",
        created_at: "2026-07-15T08:30:00Z",
      }),
    ).toBe("2026-07-15T08:30:00Z");
    expect(backupTimestampValue({ backup_id: "2026-07-15T08:30:00Z-claude-work" })).toBe(
      "2026-07-15T08:30:00Z-claude-work",
    );

    expect(formatBackupListTimestamp("2026-07-15T08:30:00Z", now)).toMatch(/^Today, /);
    expect(formatBackupListTimestamp("2026-07-14T08:30:00Z", now)).toMatch(/^Yesterday, /);
    expect(formatBackupListTimestamp("2026-07-10T08:30:00Z", now)).toBe("Jul 10");
    expect(formatBackupListTimestamp("2025-12-31T08:30:00Z", now)).toBe("Dec 31, 2025");

    expect(formatBackupInspectorTimestamp("2025-12-31T08:30:00Z")).toContain("2025");
    expect(formatBackupInspectorTimestamp("not-a-date")).toBe(DATE_UNAVAILABLE_LABEL);
  });
});
