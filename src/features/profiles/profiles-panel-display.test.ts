import { describe, expect, it } from "vitest";
import type { BackupEntry, OAuthProgressEvent } from "../../lib/schemas";
import { DesktopCommandError } from "../../lib/tauri";
import {
  buildProfileActionMenu,
  buildSelectedProfileInspectorState,
  buildOauthWizardSteps,
  formatDesktopError,
  isDuplicateProfileName,
  latestBackupForProfile,
  oauthEventStage,
  profileMutationError,
} from "./profiles-panel-display";

function makeBackup(overrides: Partial<BackupEntry> = {}): BackupEntry {
  return {
    backup_id: "20260325T114502Z-claude-work",
    tool: "claude",
    profile: "work",
    created_at: "2026-03-25T11:45:02Z",
    ...overrides,
  };
}

function makeOauthEvent(overrides: Partial<OAuthProgressEvent> = {}): OAuthProgressEvent {
  return {
    type: null,
    seq: null,
    command: null,
    tool: "claude",
    profile: "work",
    phase: "started",
    safe_to_cancel: null,
    message: null,
    ok: null,
    result: null,
    error: null,
    ...overrides,
  };
}

describe("profiles-panel-display", () => {
  it("finds the newest backup for a profile and supports tool-prefixed profile ids", () => {
    const backup = latestBackupForProfile("claude", "work", [
      makeBackup(),
      makeBackup({
        backup_id: "20260326T120000Z-claude-work",
        created_at: "2026-03-26T12:00:00Z",
      }),
      makeBackup({
        profile: "claude/work",
        backup_id: "20260327T120000Z-claude-work",
        created_at: "2026-03-27T12:00:00Z",
      }),
      makeBackup({
        tool: "codex",
        profile: "work",
        backup_id: "20260328T120000Z-codex-work",
        created_at: "2026-03-28T12:00:00Z",
      }),
    ]);

    expect(backup?.backup_id).toBe("20260327T120000Z-claude-work");
  });

  it("maps oauth progress into wizard steps and failure state", () => {
    expect(oauthEventStage(makeOauthEvent({ phase: "browser_launch" }))).toBe("browser");
    expect(oauthEventStage(makeOauthEvent({ phase: "unknown" }))).toBeNull();

    const steps = buildOauthWizardSteps(
      "claude",
      [
        makeOauthEvent({ phase: "started", message: "Preparing" }),
        makeOauthEvent({ phase: "browser_launch", message: "Opening browser" }),
        makeOauthEvent({ phase: "result", ok: false, message: "AISW cannot finish login." }),
      ],
      "",
    );

    expect(steps[0]).toEqual(
      expect.objectContaining({
        label: "1. Starting Claude login",
        status: "pass",
        detail: "Preparing",
      }),
    );
    expect(steps[1]).toEqual(
      expect.objectContaining({
        label: "2. Browser opens",
        status: "pass",
        detail: "Opening browser",
      }),
    );
    expect(steps[4]).toEqual(
      expect.objectContaining({
        label: "5. OAuth failed",
        status: "fail",
        detail: "AISW cannot finish login.",
      }),
    );
  });

  it("uses the oauth error as the terminal step detail when no result event exists", () => {
    const steps = buildOauthWizardSteps(
      "codex",
      [makeOauthEvent({ phase: "started" })],
      "Login timed out.",
    );
    expect(steps[4]).toEqual(
      expect.objectContaining({
        label: "5. OAuth failed",
        detail: "Login timed out.",
        status: "fail",
      }),
    );
  });

  it("formats desktop command errors and picks the first present mutation error", () => {
    const runtimeError = new DesktopCommandError("AISW cannot continue.", {
      remediation: "Run aisw doctor.",
    });
    expect(formatDesktopError(runtimeError)).toBe(
      "AI Switch cannot continue. Remediation: Run AI Switch doctor.",
    );
    expect(formatDesktopError(new Error("AISW cannot save."))).toBe("AI Switch cannot save.");
    expect(
      formatDesktopError({ message: "AISW cannot update.", remediation: "Retry aisw verify." }),
    ).toBe("AI Switch cannot update. Remediation: Retry AI Switch verify.");
    expect(formatDesktopError(null)).toBe("AI Switch could not complete that action.");
    expect(profileMutationError(null, undefined, new Error("AISW failed."))).toBe(
      "AI Switch failed.",
    );
  });

  it("detects duplicate profile names case-insensitively while allowing the current name", () => {
    const profiles = [{ name: "Work" }, { name: "Personal" }];
    expect(isDuplicateProfileName(profiles, "Work", "work")).toBe(false);
    expect(isDuplicateProfileName(profiles, "Work", "PERSONAL")).toBe(true);
    expect(isDuplicateProfileName(profiles, "Work", "Travel")).toBe(false);
  });

  it("builds profile action menus for table and inspector scopes", () => {
    expect(
      buildProfileActionMenu({
        active: false,
        hasBackup: true,
        scope: "table",
        state: "stored",
      }),
    ).toEqual([
      { kind: "activate", label: "Activate" },
      { kind: "rename", label: "Rename…" },
      { kind: "change_label", label: "Change Label…" },
      { kind: "view_backups", label: "View Backups", disabled: false },
      { kind: "remove", label: "Remove…", danger: true },
    ]);

    expect(
      buildProfileActionMenu({
        active: true,
        hasBackup: false,
        scope: "table",
        state: "live_mismatch",
      }),
    ).toEqual([
      { kind: "reapply", label: "Reapply Active Profile" },
      { kind: "rename", label: "Rename…" },
      { kind: "change_label", label: "Change Label…" },
      { kind: "view_backups", label: "View Backups", disabled: true },
      { kind: "remove", label: "Remove…", danger: true },
    ]);

    expect(
      buildProfileActionMenu({
        active: true,
        hasBackup: true,
        scope: "inspector",
        state: "active",
      }),
    ).toEqual([
      { kind: "rename", label: "Rename…" },
      { kind: "change_label", label: "Change Label…" },
      { kind: "view_backups", label: "View Backups", disabled: false },
      { kind: "remove", label: "Remove…", danger: true },
    ]);
  });

  it("builds selected-profile inspector state consistently", () => {
    expect(
      buildSelectedProfileInspectorState({
        activeProfileApplied: true,
        activeProfileName: "work",
        selectedProfileDisplay: "Work Laptop",
        selectedProfileName: "work",
      }),
    ).toEqual({
      canActivate: false,
      hasCustomLabel: true,
      isActive: true,
      needsReapply: false,
      primaryActionLabel: null,
      state: "active",
    });

    expect(
      buildSelectedProfileInspectorState({
        activeProfileApplied: false,
        activeProfileName: "work",
        selectedProfileDisplay: "Work",
        selectedProfileName: "work",
      }),
    ).toEqual({
      canActivate: false,
      hasCustomLabel: false,
      isActive: true,
      needsReapply: true,
      primaryActionLabel: "Reapply Work",
      state: "live_mismatch",
    });

    expect(
      buildSelectedProfileInspectorState({
        activeProfileApplied: true,
        activeProfileName: "work",
        selectedProfileDisplay: "Personal",
        selectedProfileName: "personal",
      }),
    ).toEqual({
      canActivate: true,
      hasCustomLabel: false,
      isActive: false,
      needsReapply: false,
      primaryActionLabel: "Activate Profile",
      state: "stored",
    });
  });
});
