import { describe, expect, it } from "vitest";
import type { DesktopPreferences } from "../../lib/desktop-preferences";
import { DesktopCommandError } from "../../lib/tauri";
import type { AppBootstrap, DesktopSettings } from "../../lib/schemas";
import {
  appDataFolderErrorMessage,
  buildDesktopPreferencesUpdate,
  buildResetOnboardingPreferences,
  buildSettingsRequest,
  clipboardSuccessMessage,
  clipboardUnavailableMessage,
  createDesktopPreferencesDraft,
  createSettingsDraft,
  DEFAULT_SETTINGS_SECTION,
  effectiveRuntimePath,
  exportedDiagnosticMessage,
  findShellHookCheck,
  formatSettingsMutationError,
  launchAtLoginDescription,
  launchAtLoginErrorMessage,
  LAUNCH_AT_LOGIN_DISABLED_MESSAGE,
  LAUNCH_AT_LOGIN_ENABLED_MESSAGE,
  launchAtLoginSuccessMessage,
  nextSettingsSection,
  nextRuntimeSourceSelection,
  openedAppDataFolderMessage,
  patchDesktopPreferencesDraft,
  patchSettingsDraft,
  resolveSelectedShell,
  resolveSelectedShellVariant,
  sectionLabel,
  selectedRuntimePath,
  settingsSectionDirectionForKey,
  SETTINGS_SECTIONS,
  WINDOW_LAYOUT_RESET_MESSAGE,
} from "./settings-panel-display";

function makeSettings(overrides: Partial<DesktopSettings> = {}): DesktopSettings {
  return {
    runtime_kind: "bundled",
    runtime_path: null,
    aisw_home: null,
    update_channel: "stable",
    profile_labels: {},
    profile_sets: [],
    ...overrides,
  };
}

function makeRuntimeStatus(
  overrides: Partial<AppBootstrap["runtime_status"]> = {},
): AppBootstrap["runtime_status"] {
  return {
    resolved_path: null,
    version: null,
    capabilities: null,
    inventory: {
      bundled_path: "/Applications/AI Switcher.app/Contents/MacOS/aisw",
      system_path: "/opt/homebrew/bin/aisw",
      configured_path: null,
    },
    compatible: true,
    issues: [],
    ...overrides,
  };
}

function makeDesktopPreferences(
  overrides: Partial<DesktopPreferences> = {},
): DesktopPreferences {
  return {
    appearance: "system",
    defaultSection: "overview",
    showMenuBarIcon: true,
    restoreWindowState: true,
    reopenSetupAssistant: false,
    ...overrides,
  };
}

function makeShellGuidance() {
  return {
    note: "Use the detected shell",
    capabilities: ["install", "verify"],
    manual_apply_examples: ["source ~/.zshrc"],
    detected_shell: "zsh",
    variants: [
      {
        title: "Zsh",
        shell: "zsh",
        config_path: "~/.zshrc",
        alternate_config_path: null,
        install_command: "source ~/.zshrc",
        reload_command: "exec zsh",
        verify_command: "aisw doctor",
        verify_expected: "ok",
      },
      {
        title: "Bash",
        shell: "bash",
        config_path: "~/.bashrc",
        alternate_config_path: null,
        install_command: "source ~/.bashrc",
        reload_command: "exec bash",
        verify_command: "aisw doctor",
        verify_expected: "ok",
      },
    ],
  };
}

describe("settings-panel-display", () => {
  it("shares stable settings feedback copy", () => {
    expect(LAUNCH_AT_LOGIN_ENABLED_MESSAGE).toBe("Launch at login enabled.");
    expect(LAUNCH_AT_LOGIN_DISABLED_MESSAGE).toBe("Launch at login disabled.");
    expect(WINDOW_LAYOUT_RESET_MESSAGE).toBe("Cleared the saved window size and position.");
  });

  it("shares normalized mutation errors and shell checks", () => {
    expect(
      formatSettingsMutationError(
        new DesktopCommandError("AISW cannot load CLI context.", {
          remediation: "Re-open aisw and verify the imported context.",
        }),
      ),
    ).toEqual({
      message: "AI Switch cannot load set.",
      remediation: "Re-open AI Switch and verify the set.",
    });
    expect(formatSettingsMutationError(new Error("AISW cannot update runtime."))).toEqual({
      message: "AI Switch cannot update runtime.",
      remediation: undefined,
    });

    expect(
      findShellHookCheck({
        checks: [
          { name: "workspace", status: "pass", detail: "ignored" },
          {
            name: "shell hook",
            status: "fail",
            detail: "Shell hook guidance remains informational.",
          },
        ],
      }),
    ).toEqual({
      status: "fail",
      detail: "Terminal integration guidance remains informational.",
    });
    expect(findShellHookCheck(undefined)).toBeNull();
  });

  it("shares shell selection, keyboard navigation, and action copy", () => {
    expect(resolveSelectedShellVariant(makeShellGuidance(), "bash")).toEqual(
      makeShellGuidance().variants[1],
    );
    expect(resolveSelectedShellVariant(makeShellGuidance(), "fish")).toEqual(
      makeShellGuidance().variants[0],
    );
    expect(resolveSelectedShell(makeShellGuidance(), "")).toBe("zsh");
    expect(resolveSelectedShell(makeShellGuidance(), "bash")).toBe("bash");
    expect(resolveSelectedShell(undefined, "")).toBe("");

    expect(settingsSectionDirectionForKey("ArrowDown")).toBe("next");
    expect(settingsSectionDirectionForKey("ArrowLeft")).toBe("previous");
    expect(settingsSectionDirectionForKey("Home")).toBe("first");
    expect(settingsSectionDirectionForKey("End")).toBe("last");
    expect(settingsSectionDirectionForKey("Enter")).toBeNull();

    expect(clipboardUnavailableMessage("setup")).toBe(
      "Clipboard access is unavailable. Copy the setup step manually.",
    );
    expect(clipboardSuccessMessage("verify")).toBe("Copied verify step.");
    expect(exportedDiagnosticMessage("support.zip")).toBe("Saved support.zip.");
    expect(openedAppDataFolderMessage("/tmp/aisw")).toBe("Opened /tmp/aisw.");
    expect(launchAtLoginErrorMessage(new Error("Nope"))).toBe("Nope");
    expect(launchAtLoginErrorMessage(null)).toBe(
      "AI Switch could not update launch at login.",
    );
    expect(appDataFolderErrorMessage(new Error("Missing"))).toBe("Missing");
    expect(appDataFolderErrorMessage(null)).toBe(
      "AI Switch could not open the app data folder.",
    );
    expect(launchAtLoginDescription(true, "ignored")).toBeUndefined();
    expect(launchAtLoginDescription(false, "Managed externally")).toBe(
      "Managed externally",
    );
    expect(launchAtLoginDescription(false, null)).toBe(
      "Launch at login is not available in this environment.",
    );
    expect(launchAtLoginSuccessMessage(true)).toBe(
      LAUNCH_AT_LOGIN_ENABLED_MESSAGE,
    );
    expect(launchAtLoginSuccessMessage(false)).toBe(
      LAUNCH_AT_LOGIN_DISABLED_MESSAGE,
    );
  });

  it("shares effective and resolved runtime paths", () => {
    expect(effectiveRuntimePath("bundled", "/tmp/aisw")).toBe("");
    expect(effectiveRuntimePath("custom", "/tmp/aisw")).toBe("/tmp/aisw");

    expect(selectedRuntimePath(makeSettings(), makeRuntimeStatus())).toBe(
      "/Applications/AI Switcher.app/Contents/MacOS/aisw",
    );
    expect(
      selectedRuntimePath(makeSettings({ runtime_kind: "system" }), makeRuntimeStatus()),
    ).toBe("/opt/homebrew/bin/aisw");
    expect(
      selectedRuntimePath(
        makeSettings({ runtime_kind: "custom", runtime_path: "/Users/test/bin/aisw" }),
        makeRuntimeStatus(),
      ),
    ).toBe("/Users/test/bin/aisw");
  });

  it("shares section metadata and navigation order", () => {
    expect(SETTINGS_SECTIONS).toEqual([
      "general",
      "runtime",
      "shell",
      "keyring",
      "updates",
      "advanced",
    ]);
    expect(DEFAULT_SETTINGS_SECTION).toBe("general");
    expect(sectionLabel("runtime")).toBe("Engine");
    expect(nextSettingsSection("runtime", "next")).toBe("shell");
    expect(nextSettingsSection("runtime", "previous")).toBe("general");
    expect(nextSettingsSection("runtime", "first")).toBe("general");
    expect(nextSettingsSection("runtime", "last")).toBe("advanced");
    expect(nextSettingsSection("advanced", "next")).toBe("advanced");
  });

  it("builds settings requests and desktop preference updates", () => {
    expect(createSettingsDraft(makeSettings())).toEqual({
      runtimeKind: "bundled",
      runtimePath: "",
      aiswHome: "",
      updateChannel: "stable",
    });
    expect(
      createDesktopPreferencesDraft(
        makeDesktopPreferences({ appearance: "dark", showMenuBarIcon: false }),
      ),
    ).toEqual({
      appearance: "dark",
      defaultSection: "overview",
      showMenuBarIcon: false,
      restoreWindowState: true,
    });
    expect(nextRuntimeSourceSelection("system", "/tmp/aisw")).toEqual({
      runtimeKind: "system",
      runtimePath: "",
    });
    expect(nextRuntimeSourceSelection("custom", "/tmp/aisw")).toEqual({
      runtimeKind: "custom",
      runtimePath: "/tmp/aisw",
    });
    expect(
      patchSettingsDraft(
        {
          runtimeKind: "bundled",
          runtimePath: "",
          aiswHome: "",
          updateChannel: "stable",
        },
        {
          runtimeKind: "custom",
          runtimePath: "/Users/test/bin/aisw",
          updateChannel: "beta",
        },
      ),
    ).toEqual({
      runtimeKind: "custom",
      runtimePath: "/Users/test/bin/aisw",
      aiswHome: "",
      updateChannel: "beta",
    });

    expect(
      buildSettingsRequest({
        settings: makeSettings({
          profile_sets: [{ name: "work", label: null, profiles: {} }],
        }),
        draft: {
          runtimeKind: "bundled",
          runtimePath: "/tmp/ignored",
          aiswHome: "",
          updateChannel: "stable",
        },
        next: {
          runtimeKind: "custom",
          runtimePath: "/Users/test/bin/aisw",
          aiswHome: "/Users/test/.aisw",
          updateChannel: "beta",
        },
      }),
    ).toEqual({
      runtime_kind: "custom",
      runtime_path: "/Users/test/bin/aisw",
      aisw_home: "/Users/test/.aisw",
      update_channel: "beta",
      profile_labels: {},
      profile_sets: [{ name: "work", label: null, profiles: {} }],
    });

    expect(
      buildDesktopPreferencesUpdate({
        desktopPreferences: makeDesktopPreferences({ reopenSetupAssistant: true }),
        draft: {
          appearance: "system",
          defaultSection: "overview",
          showMenuBarIcon: true,
          restoreWindowState: true,
        },
        next: { appearance: "dark", showMenuBarIcon: false },
      }),
    ).toEqual({
      appearance: "dark",
      defaultSection: "overview",
      showMenuBarIcon: false,
      restoreWindowState: true,
      reopenSetupAssistant: true,
    });
    expect(
      patchDesktopPreferencesDraft(
        {
          appearance: "system",
          defaultSection: "overview",
          showMenuBarIcon: true,
          restoreWindowState: true,
        },
        { defaultSection: "profiles", restoreWindowState: false },
      ),
    ).toEqual({
      appearance: "system",
      defaultSection: "profiles",
      showMenuBarIcon: true,
      restoreWindowState: false,
    });

    expect(
      buildResetOnboardingPreferences({
        appearance: "light",
        showMenuBarIcon: false,
        restoreWindowState: false,
      }),
    ).toEqual({
      appearance: "light",
      defaultSection: "overview",
      showMenuBarIcon: false,
      restoreWindowState: false,
      reopenSetupAssistant: true,
    });
  });
});
