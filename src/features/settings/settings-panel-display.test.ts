import { describe, expect, it } from "vitest";
import type { DesktopPreferences } from "../../lib/desktop-preferences";
import { selectedShellValue, selectedShellVariant } from "../../lib/settings-display";
import { DesktopCommandError } from "../../lib/tauri";
import type { AppBootstrap, DesktopSettings } from "../../lib/schemas";
import {
  appDataFolderErrorMessage,
  buildUpdateCheckResultLines,
  buildDesktopPreferencesUpdate,
  buildResetOnboardingPreferences,
  buildRuntimeSelectionSettings,
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
  initialSettingsSection,
  launchAtLoginDescription,
  launchAtLoginErrorMessage,
  launchAtLoginState,
  LAUNCH_AT_LOGIN_DISABLED_MESSAGE,
  LAUNCH_AT_LOGIN_ENABLED_MESSAGE,
  launchAtLoginSuccessMessage,
  nextSettingsSection,
  nextRuntimeSourceSelection,
  openedAppDataFolderMessage,
  persistedRuntimePath,
  patchDesktopPreferencesDraft,
  patchSettingsDraft,
  sectionLabel,
  selectedAiswHomePath,
  selectedRuntimePath,
  SETTINGS_APPEARANCE_OPTIONS,
  SETTINGS_CHECK_FOR_UPDATES_LABEL,
  SETTINGS_COPY_REDACTED_REPORT_LABEL,
  SETTINGS_DEFAULT_SECTION_OPTIONS,
  SETTINGS_EXPORT_REDACTED_SUPPORT_BUNDLE_LABEL,
  SETTINGS_INSTALLING_UPDATE_LABEL,
  SETTINGS_INSTALL_UPDATE_LABEL,
  SETTINGS_NO_UPDATE_AVAILABLE_MESSAGE,
  SETTINGS_OPEN_APP_DATA_FOLDER_LABEL,
  SETTINGS_PANEL_COPY,
  SETTINGS_RESET_ONBOARDING_LABEL,
  SETTINGS_RESET_WINDOW_LAYOUT_LABEL,
  SETTINGS_REOPEN_SETUP_ASSISTANT_LABEL,
  SETTINGS_REVEAL_IN_FINDER_LABEL,
  SETTINGS_RUNTIME_SOURCE_OPTIONS,
  SETTINGS_SAVE_FAILED_TITLE,
  settingsSectionDirectionForKey,
  SETTINGS_SECTIONS,
  SETTINGS_SHELL_NOTE,
  SETTINGS_UPDATE_CHECK_FAILED_TITLE,
  SETTINGS_UPDATE_INSTALL_FAILED_TITLE,
  SETTINGS_UPDATE_CHANNEL_OPTIONS,
  WINDOW_LAYOUT_RESET_MESSAGE,
  releaseChannelDescription,
  runtimeVersionLabel,
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
    expect(SETTINGS_SAVE_FAILED_TITLE).toBe("Settings could not be saved");
    expect(SETTINGS_UPDATE_CHECK_FAILED_TITLE).toBe("Update check failed");
    expect(SETTINGS_UPDATE_INSTALL_FAILED_TITLE).toBe("Update install failed");
    expect(SETTINGS_NO_UPDATE_AVAILABLE_MESSAGE).toBe("No update is currently available.");
    expect(SETTINGS_REVEAL_IN_FINDER_LABEL).toBe("Reveal in Finder");
    expect(SETTINGS_OPEN_APP_DATA_FOLDER_LABEL).toBe("Open App Data Folder");
    expect(SETTINGS_COPY_REDACTED_REPORT_LABEL).toBe("Copy Redacted Report…");
    expect(SETTINGS_EXPORT_REDACTED_SUPPORT_BUNDLE_LABEL).toBe(
      "Export Redacted Support Bundle…",
    );
    expect(SETTINGS_CHECK_FOR_UPDATES_LABEL).toBe("Check for Updates");
    expect(SETTINGS_INSTALL_UPDATE_LABEL).toBe("Install Update");
    expect(SETTINGS_INSTALLING_UPDATE_LABEL).toBe("Installing…");
    expect(SETTINGS_REOPEN_SETUP_ASSISTANT_LABEL).toBe("Reopen Setup Assistant");
    expect(SETTINGS_RESET_ONBOARDING_LABEL).toBe("Reset Onboarding");
    expect(SETTINGS_RESET_WINDOW_LAYOUT_LABEL).toBe("Reset Window Layout");
    expect(SETTINGS_SHELL_NOTE).toBe(
      "Current terminal sessions only need the hook when they must receive live environment changes immediately.",
    );
    expect(SETTINGS_PANEL_COPY.mobilePickerLabel).toBe("Section");
    expect(SETTINGS_PANEL_COPY.general.rows.launchAtLogin).toBe("Launch at login");
    expect(SETTINGS_PANEL_COPY.shell.installButton).toBe("Copy Install");
    expect(SETTINGS_PANEL_COPY.keyring.values.disabled).toBe("Disabled");
    expect(SETTINGS_PANEL_COPY.updates.rows.availableReleases).toBe("Available releases");
    expect(SETTINGS_PANEL_COPY.advanced.rows.supportBundle).toBe("Support bundle");
    expect(releaseChannelDescription("beta")).toBe(
      "Check for a signed desktop release on the selected beta channel.",
    );
    expect(
      buildUpdateCheckResultLines({
        configured: true,
        channel: "beta",
        current_version: "0.1.0",
        endpoint: "https://updates.example.com/beta.json",
        update: {
          version: "0.2.0-beta.1",
          current_version: "0.1.0",
          target: "darwin-aarch64",
          notes: "Includes staged fixes.",
        },
      }),
    ).toEqual([
      "Channel: beta",
      "Endpoint: https://updates.example.com/beta.json",
      "Update available: 0.2.0-beta.1",
      "Includes staged fixes.",
    ]);
    expect(
      buildUpdateCheckResultLines({
        configured: true,
        channel: "stable",
        current_version: "0.1.0",
        endpoint: null,
        update: null,
        message: null,
      }),
    ).toEqual([
      "Channel: stable",
      "No update is currently available.",
    ]);
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
    expect(selectedShellVariant(makeShellGuidance(), "bash")).toEqual(
      makeShellGuidance().variants[1],
    );
    expect(selectedShellVariant(makeShellGuidance(), "fish")).toEqual(
      makeShellGuidance().variants[0],
    );
    expect(selectedShellValue(makeShellGuidance(), "")).toBe("zsh");
    expect(selectedShellValue(makeShellGuidance(), "bash")).toBe("bash");
    expect(selectedShellValue(makeShellGuidance(), "fish")).toBe("zsh");
    expect(selectedShellValue(undefined, "")).toBe("");

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
    expect(launchAtLoginState(null)).toEqual({
      supported: false,
      enabled: false,
      detail: undefined,
    });
    expect(
      launchAtLoginState({
        supported: true,
        enabled: true,
        detail: "Configured",
      }),
    ).toEqual({
      supported: true,
      enabled: true,
      detail: "Configured",
    });
    expect(runtimeVersionLabel(makeRuntimeStatus())).toBe("Date Unavailable");
    expect(
      runtimeVersionLabel(
        makeRuntimeStatus({
          version: {
            version: "0.3.7",
            cli_api_version: 3,
            json_schema_version: 1,
            progress_schema_version: 1,
          },
        }),
      ),
    ).toBe("0.3.7");
  });

  it("shares effective and resolved runtime paths", () => {
    expect(effectiveRuntimePath("bundled", "/tmp/aisw")).toBe("");
    expect(effectiveRuntimePath("custom", "/tmp/aisw")).toBe("/tmp/aisw");
    expect(persistedRuntimePath("bundled", "/tmp/aisw")).toBeNull();
    expect(persistedRuntimePath("custom", "")).toBeNull();
    expect(persistedRuntimePath("custom", "/tmp/aisw")).toBe("/tmp/aisw");

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
    expect(selectedAiswHomePath(makeSettings())).toBe("~/.aisw");
    expect(selectedAiswHomePath(makeSettings({ aisw_home: "/Users/test/.aisw" }))).toBe(
      "/Users/test/.aisw",
    );
    expect(
      buildRuntimeSelectionSettings(makeSettings(), {
        runtimeKind: "system",
        runtimePath: "/tmp/ignored",
      }),
    ).toMatchObject({
      runtime_kind: "system",
      runtime_path: null,
    });
    expect(
      buildRuntimeSelectionSettings(makeSettings(), {
        runtimeKind: "custom",
        runtimePath: "/Users/test/bin/aisw",
      }),
    ).toMatchObject({
      runtime_kind: "custom",
      runtime_path: "/Users/test/bin/aisw",
    });
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
    expect(initialSettingsSection("runtime")).toBe("runtime");
    expect(initialSettingsSection(null)).toBe("general");
    expect(initialSettingsSection(undefined)).toBe("general");
    expect(sectionLabel("runtime")).toBe("Engine");
    expect(nextSettingsSection("runtime", "next")).toBe("shell");
    expect(nextSettingsSection("runtime", "previous")).toBe("general");
    expect(nextSettingsSection("runtime", "first")).toBe("general");
    expect(nextSettingsSection("runtime", "last")).toBe("advanced");
    expect(nextSettingsSection("advanced", "next")).toBe("advanced");
  });

  it("shares stable option sets for settings selectors", () => {
    expect(SETTINGS_APPEARANCE_OPTIONS).toEqual([
      { value: "system", label: "System" },
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" },
    ]);
    expect(SETTINGS_DEFAULT_SECTION_OPTIONS).toEqual([
      { value: "overview", label: "Overview" },
      { value: "profiles", label: "Profiles" },
      { value: "sets", label: "Sets" },
      { value: "diagnostics", label: "Diagnostics" },
      { value: "backups", label: "Backups" },
      { value: "activity", label: "Activity" },
    ]);
    expect(SETTINGS_RUNTIME_SOURCE_OPTIONS).toEqual([
      { value: "bundled", label: "Bundled" },
      { value: "system", label: "System engine" },
      { value: "custom", label: "Custom path" },
    ]);
    expect(SETTINGS_UPDATE_CHANNEL_OPTIONS).toEqual([
      { value: "stable", label: "Stable" },
      { value: "beta", label: "Beta" },
    ]);
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
      buildSettingsRequest({
        settings: makeSettings(),
        draft: {
          runtimeKind: "custom",
          runtimePath: "",
          aiswHome: "",
          updateChannel: "stable",
        },
      }),
    ).toEqual({
      runtime_kind: "custom",
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [],
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
