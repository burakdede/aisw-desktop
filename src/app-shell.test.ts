import {
  appNavFromShortcut,
  APP_NAV,
  buildSidebarStatusRows,
  buildToolbarActions,
  buildAppNavItems,
  createAddProfileRouteState,
  createImportCurrentLoginRouteState,
  createProfilesRouteState,
  createSettingsRouteState,
  describeBootstrapError,
  describeRuntimeBlocker,
  deriveAppShellState,
  navShortcutLabel,
  runtimeSelectionLabel,
  runtimeSourceLabel,
  sectionTitle,
  settingsForRecovery,
} from "./app-shell";
import { DesktopCommandError } from "./lib/tauri";

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
      { label: "Engine source", value: "Custom override" },
    ]);
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
    expect(runtimeSelectionLabel("bundled")).toBe("Included desktop engine");
    expect(runtimeSelectionLabel("system")).toBe("System engine");
    expect(runtimeSourceLabel("bundled")).toBe("Included");
    expect(runtimeSourceLabel("custom")).toBe("Custom override");
  });
});
