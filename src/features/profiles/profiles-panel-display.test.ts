import { describe, expect, it } from "vitest";
import type {
  AppSnapshot,
  BackupEntry,
  DesktopSettings,
  OAuthProgressEvent,
} from "../../lib/schemas";
import { DesktopCommandError } from "../../lib/tauri";
import {
  buildProfileActivationRequest,
  buildInventoryProfiles,
  buildProfileActionMenu,
  buildProfileEditSheetState,
  buildProfileRemovalSheetState,
  buildProfileSheetDraftReset,
  buildProfileSheetSubmitLabel,
  buildSelectedProfileInspectorState,
  buildOauthWizardSteps,
  defaultExpandedProfileName,
  filterInventoryProfiles,
  formatDesktopError,
  findSelectedInventoryEntry,
  INVENTORY_FILTERS,
  inventoryKeyActionForEvent,
  isDuplicateProfileName,
  latestBackupForProfile,
  nextInventorySelectionIndex,
  oauthEventStage,
  profileMutationError,
  resolveAvailableSelection,
  shouldAutoOpenProfileSheet,
  toggleProfileActionMenu,
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

function makeSettings(overrides: Partial<DesktopSettings> = {}): DesktopSettings {
  return {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
    profile_labels: {
      claude: {
        work: "Work Laptop",
      },
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
        active_profile: null,
        auth_method: "oauth",
        credential_backend: "file",
        state_mode: "isolated",
        active_profile_applied: null,
        credentials_present: null,
        permissions_ok: null,
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
        active: null,
        profiles: [{ name: "personal", auth: "oauth", label: "" }],
      },
    },
    contexts: [],
    ...overrides,
  };
}

describe("profiles-panel-display", () => {
  it("builds, filters, and selects inventory entries", () => {
    expect(INVENTORY_FILTERS).toEqual(["all", "claude", "codex", "gemini"]);

    const snapshot = makeSnapshot();
    const settings = makeSettings();
    const backups = [
      makeBackup(),
      makeBackup({
        tool: "codex",
        profile: "personal",
        backup_id: "20260324T114502Z-codex-personal",
        created_at: "2026-03-24T11:45:02Z",
      }),
    ];

    const inventory = buildInventoryProfiles({
      backups,
      inventoryFilter: "all",
      settings,
      snapshot,
    });

    expect(inventory).toHaveLength(2);
    expect(inventory[0]).toMatchObject({
      tool: "claude",
      name: "work",
      auth: "oauth",
      label: "Work Laptop",
      active: true,
      backend: "Keychain",
      state: "active",
      hasBackup: true,
    });
    expect(inventory[0].lastChecked).toContain("2026");
    expect(inventory[1]).toMatchObject({
      tool: "codex",
      name: "personal",
      auth: "oauth",
      label: "",
      active: false,
      backend: "File",
      state: "stored",
      hasBackup: true,
    });
    expect(inventory[1].lastChecked).toContain("2026");
    expect(inventory[1].lastChecked).not.toContain("Active now");

    expect(filterInventoryProfiles(inventory, "work laptop")).toEqual([inventory[0]]);
    expect(filterInventoryProfiles(inventory, "personal codex oauth file stored")).toEqual([
      inventory[1],
    ]);
    expect(findSelectedInventoryEntry(inventory, "claude", "work")).toEqual(inventory[0]);
    expect(findSelectedInventoryEntry(inventory, "claude", "missing")).toBeNull();
  });

  it("shares profile panel selection, routing, keyboard, and submit-label policy", () => {
    expect(buildProfileSheetDraftReset(null)).toEqual({
      credentialBackend: "auto",
      label: "",
      mode: "from_live",
      profile: "",
    });
    expect(buildProfileSheetDraftReset("file")).toEqual({
      credentialBackend: "file",
      label: "",
      mode: "from_live",
      profile: "",
    });

    expect(resolveAvailableSelection("oauth", ["oauth", "from_live"], "from_live")).toBe(
      "oauth",
    );
    expect(resolveAvailableSelection("api_key", ["oauth", "from_live"], "from_live")).toBe(
      "oauth",
    );

    expect(
      defaultExpandedProfileName({
        expandedDetails: "work",
        activeProfile: "personal",
        profiles: [{ name: "work" }, { name: "personal" }],
      }),
    ).toBe("work");
    expect(
      defaultExpandedProfileName({
        expandedDetails: "missing",
        activeProfile: "personal",
        profiles: [{ name: "work" }, { name: "personal" }],
      }),
    ).toBe("personal");
    expect(
      defaultExpandedProfileName({
        expandedDetails: null,
        activeProfile: null,
        profiles: [{ name: "work" }],
      }),
    ).toBe("work");

    expect(
      shouldAutoOpenProfileSheet({
        initialExpandedProfile: null,
        resolvedInitialTool: "claude",
        initialMode: undefined,
        initialCredentialBackend: null,
        openToken: undefined,
      }),
    ).toBe(true);
    expect(
      shouldAutoOpenProfileSheet({
        initialExpandedProfile: "work",
        resolvedInitialTool: "claude",
        initialMode: "from_live",
        initialCredentialBackend: "file",
        openToken: 1,
      }),
    ).toBe(false);

    expect(toggleProfileActionMenu(null, { tool: "claude", name: "work", scope: "table" })).toEqual({
      tool: "claude",
      name: "work",
      scope: "table",
    });
    expect(
      toggleProfileActionMenu(
        { tool: "claude", name: "work", scope: "table" },
        { tool: "claude", name: "work", scope: "table" },
      ),
    ).toBeNull();

    expect(inventoryKeyActionForEvent("ArrowDown", false, false)).toEqual({
      kind: "move",
      direction: "next",
    });
    expect(inventoryKeyActionForEvent("Enter", true, false)).toEqual({
      kind: "activate",
    });
    expect(inventoryKeyActionForEvent("Enter", false, false)).toBeNull();
    expect(inventoryKeyActionForEvent("ArrowDown", false, true)).toBeNull();
    expect(nextInventorySelectionIndex(1, 4, "next")).toBe(2);
    expect(nextInventorySelectionIndex(3, 4, "next")).toBe(3);
    expect(nextInventorySelectionIndex(1, 4, "previous")).toBe(0);
    expect(nextInventorySelectionIndex(1, 4, "first")).toBe(0);
    expect(nextInventorySelectionIndex(1, 4, "last")).toBe(3);
    expect(nextInventorySelectionIndex(1, 0, "last")).toBeNull();

    expect(
      buildProfileSheetSubmitLabel({
        mode: "oauth",
        addProfilePending: false,
        addProfileOAuthPending: true,
        apiKeyPending: false,
      }),
    ).toBe("Waiting for sign-in…");
    expect(
      buildProfileSheetSubmitLabel({
        mode: "api_key",
        addProfilePending: false,
        addProfileOAuthPending: false,
        apiKeyPending: false,
      }),
    ).toBe("Save Profile");
    expect(
      buildProfileSheetSubmitLabel({
        mode: "from_env",
        addProfilePending: true,
        addProfileOAuthPending: false,
        apiKeyPending: false,
      }),
    ).toBe("Saving…");
    expect(
      buildProfileSheetSubmitLabel({
        mode: "from_live",
        addProfilePending: false,
        addProfileOAuthPending: false,
        apiKeyPending: false,
      }),
    ).toBe("Import");
  });

  it("builds edit/removal sheet state and profile activation requests", () => {
    const settings = makeSettings();
    const profiles = [
      { name: "work", auth: "oauth", label: "Work Laptop" },
      { name: "personal", auth: "oauth", label: "" },
    ];

    expect(
      buildProfileEditSheetState({
        pendingEdit: { name: "work", focus: "name" },
        profiles,
        settings,
        tool: "claude",
        renameDrafts: { work: "PERSONAL" },
        labelDrafts: {},
      }),
    ).toEqual({
      display: "Work Laptop",
      labelDraft: "Work Laptop",
      profile: profiles[0],
      renameDraft: "PERSONAL",
      renameDuplicate: true,
    });

    expect(
      buildProfileEditSheetState({
        pendingEdit: null,
        profiles,
        settings,
        tool: "claude",
        renameDrafts: {},
        labelDrafts: {},
      }),
    ).toBeNull();

    expect(
      buildProfileRemovalSheetState({
        pendingRemoval: "work",
        profiles,
        settings,
        tool: "claude",
      }),
    ).toEqual({
      display: "Work Laptop",
      profile: profiles[0],
    });

    expect(
      buildProfileRemovalSheetState({
        pendingRemoval: "missing",
        profiles,
        settings,
        tool: "claude",
      }),
    ).toBeNull();

    expect(
      buildProfileActivationRequest({
        tool: "claude",
        profileName: "work",
        profileLabel: "Work Laptop",
        selectedStateMode: "shared",
        availableStateModes: ["isolated", "shared"],
      }),
    ).toEqual({
      tool: "claude",
      profile: "work",
      stateMode: "shared",
      label: "Work Laptop",
    });

    expect(
      buildProfileActivationRequest({
        tool: "gemini",
        profileName: "work",
        profileLabel: "Work Laptop",
        selectedStateMode: "shared",
        availableStateModes: [],
      }),
    ).toEqual({
      tool: "gemini",
      profile: "work",
      stateMode: null,
      label: "Work Laptop",
    });
  });

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
