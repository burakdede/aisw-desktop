import {
  APP_SHELL_COPY,
  appNavFromShortcut,
  APP_NAV,
  buildBootstrapErrorSurface,
  buildBootstrapLoadingSurface,
  buildReapplyActiveProfileError,
  buildRuntimeRecoveryStatusRows,
  buildSidebarStatusRows,
  buildTrayCommandFeedback,
  buildToolbarActions,
  buildAppNavItems,
  createAddProfileRouteState,
  createImportCurrentLoginRouteState,
  createProfileSetupRouteState,
  createProfilesRouteState,
  createSettingsRouteState,
  describeBootstrapError,
  describeRuntimeBlocker,
  deriveAppShellState,
  navShortcutLabel,
  REAPPLY_ACTIVE_PROFILE_LABEL,
  resolveDesktopShortcutAction,
  resolveActiveReapplyAction,
  runtimeRecoveryPrimaryActionLabel,
  runtimeSelectionLabel,
  runtimeSourceLabel,
  sectionTitle,
  settingsForRecovery,
} from "./app-shell";
import { COMMAND_RESULT_GLOBAL_IDS } from "./features/shared/command-result-scope";
import { DESKTOP_ACTION_RESULT_COPY } from "./features/shared/desktop-action-result-copy";
import {
  CUSTOM_OVERRIDE_LABEL,
  INCLUDED_DESKTOP_ENGINE_LABEL,
  INCLUDED_RUNTIME_SOURCE_LABEL,
  SYSTEM_ENGINE_LABEL,
} from "./lib/runtime-display";
import type { AppSnapshot, DesktopSettings } from "./lib/schemas";
import { DesktopCommandError } from "./lib/tauri";
import { makeRuntimeToolCapabilities } from "./test-support/runtime-tool-capabilities";

function makeSettings(
  overrides: Partial<DesktopSettings> = {},
): DesktopSettings {
  return {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
    profile_labels: {
      claude: { work: "Work Claude" },
      codex: { work: "Work Codex" },
    },
    profile_sets: [],
    ...overrides,
  };
}

function makeSnapshot(
  overrides: Partial<AppSnapshot> = {},
): AppSnapshot {
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
        active_profile: "work",
        auth_method: "oauth",
        credential_backend: "system-keyring",
        state_mode: "shared",
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
        active: "work",
        profiles: [{ name: "work", auth: "oauth", label: "" }],
      },
    },
    contexts: [],
    workspace_status: null,
    project_bindings: null,
    ...overrides,
  };
}

describe("app-shell helpers", () => {
  it("returns the default recovery settings when bootstrap settings are missing", () => {
    expect(settingsForRecovery(undefined)).toMatchObject({
      runtime_kind: "bundled",
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [],
    });
  });

  it("maps section shortcuts and labels", () => {
    expect(APP_NAV.map((item) => item.id)).toEqual([
      "overview",
      "profiles",
      "sets",
      "diagnostics",
      "backups",
      "activity",
      "settings",
    ]);
    expect(navShortcutLabel("overview")).toBe("⌘1");
    expect(navShortcutLabel("settings")).toBe("⌘,");
    expect(navShortcutLabel("unknown")).toBeUndefined();
    expect(appNavFromShortcut("3")).toBe("sets");
    expect(
      resolveDesktopShortcutAction({
        key: "k",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        editableTarget: false,
        runtimeBlocked: true,
      }),
    ).toBe("quick-switch");
    expect(
      resolveDesktopShortcutAction({
        key: ",",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        editableTarget: false,
        runtimeBlocked: true,
      }),
    ).toBe("settings");
    expect(
      resolveDesktopShortcutAction({
        key: "2",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        editableTarget: false,
        runtimeBlocked: false,
      }),
    ).toBe("profiles");
    expect(
      resolveDesktopShortcutAction({
        key: "2",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        editableTarget: false,
        runtimeBlocked: true,
      }),
    ).toBeNull();
    expect(
      resolveDesktopShortcutAction({
        key: "k",
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        editableTarget: false,
        runtimeBlocked: false,
      }),
    ).toBeNull();
    expect(
      resolveDesktopShortcutAction({
        key: "k",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        editableTarget: true,
        runtimeBlocked: false,
      }),
    ).toBeNull();
    expect(sectionTitle("profiles")).toBe("Profiles");
    expect(sectionTitle("overview", true)).toBe("Get started");
    expect(buildAppNavItems(true).find((item) => item.id === "settings")).toEqual(
      expect.objectContaining({ disabled: false, shortcut: "⌘," }),
    );
    expect(buildAppNavItems(true).find((item) => item.id === "profiles")).toEqual(
      expect.objectContaining({ disabled: true, shortcut: "⌘2" }),
    );
  });

  it("derives shell state, toolbar actions, and sidebar status rows", () => {
    expect(
      deriveAppShellState({
        activeNav: "overview",
        runtimeBlocked: true,
        runtimeRecoveryOpen: false,
        setupRequired: true,
      }),
    ).toEqual({
      activeSection: "overview",
      runtimeRecoveryFocused: true,
      setupFocused: true,
      showSetupWindow: true,
    });

    expect(
      deriveAppShellState({
        activeNav: "profiles",
        runtimeBlocked: false,
        runtimeRecoveryOpen: false,
        setupRequired: false,
      }),
    ).toEqual({
      activeSection: "profiles",
      runtimeRecoveryFocused: false,
      setupFocused: false,
      showSetupWindow: false,
    });

    expect(
      buildToolbarActions({
        activeSection: "overview",
        runtimeBlocked: false,
        showSetupWindow: false,
      }),
    ).toEqual([
      {
        kind: "quick-switch",
        label: "Quick Switch",
        shortcut: "⌘K",
        tone: "primary",
        disabled: false,
      },
      {
        kind: "verify",
        label: "Verify",
        tone: "ghost",
      },
    ]);

    expect(
      buildToolbarActions({
        activeSection: "diagnostics",
        runtimeBlocked: true,
        showSetupWindow: false,
      }),
    ).toEqual([
      {
        kind: "quick-switch",
        label: "Quick Switch",
        shortcut: "⌘K",
        tone: "ghost",
        disabled: true,
      },
      {
        kind: "verify",
        label: "Verify",
        tone: "ghost",
      },
      {
        kind: "add-profile",
        label: "Add Profile",
        tone: "primary",
        disabled: true,
      },
    ]);

    expect(
      buildToolbarActions({
        activeSection: "profiles",
        runtimeBlocked: false,
        showSetupWindow: false,
      }),
    ).toEqual([]);

    expect(
      buildSidebarStatusRows({
        currentActiveSet: null,
        runtimeCompatible: true,
        runtimeKind: "custom",
      }),
    ).toEqual([
      { label: "Active set", value: "None" },
      { label: "Switching", value: "Ready" },
      { label: "Engine source", value: CUSTOM_OVERRIDE_LABEL },
    ]);

    expect(APP_SHELL_COPY.currentStateKicker).toBe("Current state");
    expect(APP_SHELL_COPY.runtimeRecovery.cardTitle).toBe("Finish setup");
    expect(APP_SHELL_COPY.waitingSnapshot.title).toBe("Waiting for snapshot");
  });

  it("shares runtime recovery and bootstrap display copy", () => {
    expect(
      buildRuntimeRecoveryStatusRows({
        runtimeKind: "system",
        nextStep: "Use the included desktop engine.",
      }),
    ).toEqual([
      { label: "Using now", value: SYSTEM_ENGINE_LABEL },
      { label: "Desktop app needs", value: INCLUDED_DESKTOP_ENGINE_LABEL },
      { label: "Next step", value: "Use the included desktop engine." },
    ]);
    expect(runtimeRecoveryPrimaryActionLabel(false)).toBe("Use Included Engine");
    expect(runtimeRecoveryPrimaryActionLabel(true)).toBe("Switching to Included Engine…");
    expect(buildBootstrapLoadingSurface()).toEqual({
      kicker: "AI Switch",
      title: "Preparing your local switchboard…",
      detail: "Loading saved profiles and the current tool state on this computer.",
      status: "Opening local state",
      summary: "This stays on-device and usually finishes in a moment.",
    });
    expect(
      buildBootstrapErrorSurface(
        new DesktopCommandError("Broken", { remediation: "Review setup" }),
      ),
    ).toEqual({
      kicker: "AI Switch",
      title: "AI Switch could not open this window.",
      detail: "Check app setup, local permissions, and compatibility details before continuing.",
      nextStepTitle: "Review setup",
      summary: "Broken",
      remediation: "Review setup",
    });
  });

  it("builds shared route state for profiles and settings", () => {
    expect(
      createProfilesRouteState({
        tool: "codex",
        expandedProfile: "work",
      }),
    ).toEqual({
      tool: "codex",
      expandedProfile: "work",
    });

    expect(createAddProfileRouteState({ openToken: 4 })).toEqual({
      tool: "claude",
      expandedProfile: null,
      openToken: 5,
    });

    expect(createImportCurrentLoginRouteState()).toEqual({
      tool: "claude",
      expandedProfile: null,
      mode: "from_live",
    });

    expect(
      createProfileSetupRouteState({
        tool: "codex",
        mode: "oauth",
        credentialBackend: "system-keyring",
        openToken: 2,
      }),
    ).toEqual({
      tool: "codex",
      expandedProfile: null,
      mode: "oauth",
      credentialBackend: "system-keyring",
      openToken: 2,
    });

    expect(createSettingsRouteState("updates")).toEqual({ section: "updates" });
  });

  it("formats bootstrap and runtime errors for the shell", () => {
    expect(
      describeBootstrapError(
        new DesktopCommandError("Broken", { remediation: "Repair it" }),
      ),
    ).toEqual({
      message: "Broken",
      remediation: "Repair it",
    });

    expect(describeBootstrapError(new Error("Oops"))).toEqual({
      message: "Oops",
      remediation: undefined,
    });

    expect(describeBootstrapError(null)).toEqual({
      message: "AI Switch could not load its local desktop state.",
      remediation: undefined,
    });
  });

  it("describes runtime blockers based on compatibility evidence", () => {
    expect(
      describeRuntimeBlocker({
        resolved_path: "/bin/aisw",
        version: null,
        capabilities: null,
        issues: ["aisw version info is unavailable"],
      }).nextStep,
    ).toContain("desktop-compatible");

    expect(
      describeRuntimeBlocker({
        resolved_path: "/bin/aisw",
        version: { version: "0.3.7" },
        capabilities: { features: {} },
        issues: ["unsupported feature"],
      }).summary,
    ).toContain("not compatible");

    expect(
      describeRuntimeBlocker({
        resolved_path: null,
        version: null,
        capabilities: null,
        issues: [],
      }).summary,
    ).toContain("could not use");
  });

  it("formats runtime labels for the shell", () => {
    expect(runtimeSelectionLabel("bundled")).toBe(INCLUDED_DESKTOP_ENGINE_LABEL);
    expect(runtimeSelectionLabel("system")).toBe(SYSTEM_ENGINE_LABEL);
    expect(runtimeSourceLabel("bundled")).toBe(INCLUDED_RUNTIME_SOURCE_LABEL);
    expect(runtimeSourceLabel("custom")).toBe(CUSTOM_OVERRIDE_LABEL);
  });

  it("normalizes tray command feedback and reapply failures", () => {
    expect(
      buildTrayCommandFeedback({
        scope: "global",
        id: COMMAND_RESULT_GLOBAL_IDS.context,
        status: "error",
        label: "Use context",
        message: "AISW cannot switch.",
        remediation: "Run aisw verify.",
      }),
    ).toEqual({
      scope: { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.context },
      result: {
        label: DESKTOP_ACTION_RESULT_COPY.labels.useSet,
        status: "error",
        message: "AI Switch cannot switch.",
        kind: undefined,
        remediation: "Run AI Switch verify.",
      },
      notification: {
        title: DESKTOP_ACTION_RESULT_COPY.labels.useSet,
        body: "AI Switch cannot switch. Run AI Switch verify.",
      },
    });

    expect(
      buildTrayCommandFeedback({
        scope: "tool",
        tool: "claude",
        status: "success",
        label: DESKTOP_ACTION_RESULT_COPY.labels.useProfile,
        message: "AISW switched successfully.",
        remediation: undefined,
      }),
    ).toEqual({
      scope: { type: "tool", tool: "claude" },
      result: {
        label: DESKTOP_ACTION_RESULT_COPY.labels.useProfile,
        status: "success",
        message: "AI Switch switched successfully.",
        kind: undefined,
        remediation: "",
      },
      notification: {
        title: DESKTOP_ACTION_RESULT_COPY.labels.useProfile,
        body: "AI Switch switched successfully.",
      },
    });

    const desktopError = new DesktopCommandError("Broken", {
      remediation: "Repair it",
      kind: "ProfileMissing",
    });
    expect(buildReapplyActiveProfileError(desktopError)).toEqual({
      notificationBody: "Broken Repair it",
      result: {
        label: REAPPLY_ACTIVE_PROFILE_LABEL,
        status: "error",
        message: "Broken",
        kind: "ProfileMissing",
        remediation: "Repair it",
      },
    });
  });

  it("resolves active profile reapply actions for sets, shared profiles, and tool profiles", () => {
    expect(
      resolveActiveReapplyAction({
        snapshot: makeSnapshot(),
        settings: makeSettings({
          profile_sets: [
            {
              name: "work",
              label: "Work",
              profiles: { claude: "work", codex: "work" },
            },
          ],
        }),
        toolCapabilities: makeRuntimeToolCapabilities({
          claude: undefined,
          codex: undefined,
        }),
        runtimeBlocked: false,
      }),
    ).toEqual({
      scope: { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.profileSet },
      resultLabel: DESKTOP_ACTION_RESULT_COPY.labels.reapplyActiveProfile,
      message: "Re-applied current set Work.",
      action: {
        kind: "set",
        name: "work",
        label: "Work",
      },
    });

    expect(
      resolveActiveReapplyAction({
        snapshot: makeSnapshot(),
        settings: makeSettings(),
        toolCapabilities: makeRuntimeToolCapabilities({
          claude: undefined,
          codex: undefined,
        }),
        runtimeBlocked: false,
      }),
    ).toEqual({
      scope: { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.switchAll },
      resultLabel: DESKTOP_ACTION_RESULT_COPY.labels.reapplyActiveProfile,
      message: "Re-applied shared profile Work Claude.",
      action: {
        kind: "shared-profile",
        profile: "work",
        label: "Work Claude",
        stateMode: "isolated",
      },
    });

    expect(
      resolveActiveReapplyAction({
        snapshot: makeSnapshot({
          statuses: [
            { ...makeSnapshot().statuses[0] },
            { ...makeSnapshot().statuses[1], active_profile: null },
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
        }),
        settings: makeSettings(),
        toolCapabilities: makeRuntimeToolCapabilities({
          claude: undefined,
          codex: undefined,
        }),
        runtimeBlocked: false,
      }),
    ).toEqual({
      scope: { type: "tool", tool: "claude" },
      resultLabel: DESKTOP_ACTION_RESULT_COPY.labels.reapplyActiveProfile,
      message: "Re-applied Claude profile Work Claude.",
      action: {
        kind: "tool-profile",
        tool: "claude",
        profile: "work",
        label: "Work Claude",
        stateMode: "isolated",
      },
    });
  });

  it("rejects active reapply when no usable active target exists", () => {
    expect(() =>
      resolveActiveReapplyAction({
        snapshot: null,
        settings: makeSettings(),
        toolCapabilities: {},
        runtimeBlocked: false,
      }),
    ).toThrow("No active desktop snapshot is available yet.");

    expect(() =>
      resolveActiveReapplyAction({
        snapshot: makeSnapshot({
          statuses: [
            { ...makeSnapshot().statuses[0], active_profile: "work" },
            { ...makeSnapshot().statuses[1], active_profile: "personal" },
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
        }),
        settings: makeSettings(),
        toolCapabilities: makeRuntimeToolCapabilities({
          claude: undefined,
          codex: undefined,
        }),
        runtimeBlocked: false,
      }),
    ).toThrow("AI Switch could not determine a single active profile to re-apply.");
  });
});
