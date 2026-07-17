import {
  DEFAULT_SECTIONS,
  DESKTOP_APPEARANCES,
  DEFAULT_DESKTOP_PREFERENCES,
  type DesktopPreferences,
} from "../../lib/desktop-preferences";
import { APP_NAV_IDS, APP_NAV_LABELS, type DefaultAppSection } from "../../lib/app-navigation";
import {
  DESKTOP_UPDATE_CHANNELS,
  buildDesktopSettingsUpdate,
  normalizeDesktopUpdateChannel,
  type DesktopUpdateChannel,
} from "../../lib/desktop-settings";
import {
  emptyStringToNull,
  normalizeOneOf,
  nullishToEmptyString,
  nullishToNull,
} from "../../lib/parse-guards";
import {
  resolveErrorMessage,
  resolveNormalizedErrorDetails,
} from "../../lib/error-details";
import { normalizeResolvedCheckStatus } from "../../lib/check-status";
import {
  DEFAULT_SETTINGS_SECTION,
  settingsSectionLabel,
  SETTINGS_SECTION_IDS,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "../../lib/settings-sections";
import { doctorCheckHasKeyword, parseDoctorReportChecks } from "../diagnostics/diagnostic-doctor-checks";
import type {
  AppBootstrap,
  DesktopSettings,
  DoctorReport,
  LaunchAtLoginStatus,
  UpdateCheckReport,
} from "../../lib/schemas";
import {
  clipboardCopiedMessage,
  clipboardUnavailableManualMessage,
  DATE_UNAVAILABLE_LABEL,
  DEFAULT_ACTION_FAILURE_MESSAGE,
  NOT_FOUND_LABEL,
  NOT_SET_LABEL,
  openedItemMessage,
} from "../../lib/display-copy";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";
import { SYSTEM_ENGINE_LABEL } from "../../lib/runtime-display";
import {
  diagnosticExportedMessage,
} from "../diagnostics/diagnostics-copy";

export {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "../../lib/settings-sections";

export const LAUNCH_AT_LOGIN_ENABLED_MESSAGE = "Launch at login enabled.";
export const LAUNCH_AT_LOGIN_DISABLED_MESSAGE = "Launch at login disabled.";
export const WINDOW_LAYOUT_RESET_MESSAGE = "Cleared the saved window size and position.";
export const SETTINGS_SAVE_FAILED_TITLE = "Settings could not be saved";
export const SETTINGS_UPDATE_CHECK_FAILED_TITLE = "Update check failed";
export const SETTINGS_UPDATE_INSTALL_FAILED_TITLE = "Update install failed";
export const SETTINGS_NO_UPDATE_AVAILABLE_MESSAGE = "No update is currently available.";
export const SETTINGS_REVEAL_IN_FINDER_LABEL = "Reveal in Finder";
export const SETTINGS_OPEN_APP_DATA_FOLDER_LABEL = "Open App Data Folder";
export const SETTINGS_COPY_REDACTED_REPORT_LABEL = "Copy Redacted Report…";
export const SETTINGS_EXPORT_REDACTED_SUPPORT_BUNDLE_LABEL =
  "Export Redacted Support Bundle…";
export const SETTINGS_CHECK_FOR_UPDATES_LABEL = "Check for Updates";
export const SETTINGS_INSTALL_UPDATE_LABEL = "Install Update";
export const SETTINGS_INSTALLING_UPDATE_LABEL = "Installing…";
export const SETTINGS_REOPEN_SETUP_ASSISTANT_LABEL = "Reopen Setup Assistant";
export const SETTINGS_RESET_ONBOARDING_LABEL = "Reset Onboarding";
export const SETTINGS_RESET_WINDOW_LAYOUT_LABEL = "Reset Window Layout";
export const SETTINGS_SHELL_NOTE =
  "Current terminal sessions only need the hook when they must receive live environment changes immediately.";
export const SETTINGS_PANEL_COPY = {
  mobilePickerLabel: "Section",
  mobilePickerAriaLabel: "Settings section",
  sectionNavAriaLabel: "Settings sections",
  general: {
    groups: {
      appearance: "Appearance",
      startup: "Startup",
      window: "Window",
    },
    rows: {
      appearance: "Appearance",
      launchAtLogin: "Launch at login",
      showMenuBarIcon: "Show menu bar icon",
      openAtLaunch: "Open at launch",
      restoreWindowState: "Restore previous window size and position",
    },
    defaultSectionAriaLabel: "Default section",
  },
  runtime: {
    groups: {
      runtime: "AISW Runtime",
      data: "AISW Data",
    },
    rows: {
      bundledRuntime: "Bundled runtime",
      status: "Status",
      currentPath: "Current path",
      runtimeSource: "Runtime source",
      systemRuntime: "System runtime",
      customRuntime: "Custom runtime",
      aiswHome: "AISW home",
      localDataFolder: "Local data folder",
    },
    customPathAriaLabel: "Engine path",
  },
  shell: {
    groupTitle: "Terminal Integration",
    rows: {
      detectedShell: "Detected shell",
      shellHook: "Shell hook",
      configFile: "Config file",
      completionScripts: "Completion scripts",
      shellHookActions: "Shell hook actions",
    },
    installButton: "Copy Install",
    verifyButton: "Copy Verify",
  },
  keyring: {
    groups: {
      storage: "Credential Storage",
      localData: "Local Data",
      diagnostics: "Diagnostics",
    },
    rows: {
      macosKeychain: "macOS Keychain",
      filePermissions: "File permissions",
      remoteSync: "Remote sync",
      telemetry: "Telemetry",
      aiswDataFolder: "AISW data folder",
      finder: "Finder",
      supportBundle: "Support bundle",
    },
    values: {
      available: "Available",
      correct: "Correct",
      disabled: "Disabled",
    },
  },
  updates: {
    groups: {
      desktop: "AISW Desktop",
      bundledRuntime: "Bundled AISW Engine",
    },
    rows: {
      currentVersion: "Current version",
      updateChannel: "Update channel",
      availableReleases: "Available releases",
      version: "Version",
      compatibility: "Compatibility",
    },
  },
  advanced: {
    groups: {
      applicationState: "Application State",
      data: "Data",
    },
    rows: {
      setupAssistant: "Setup assistant",
      setupState: "Setup state",
      windowLayout: "Window layout",
      appDataFolder: "App data folder",
      supportBundle: "Support bundle",
      aiswHome: "AISW home",
    },
    aiswHomeAriaLabel: "AISW home",
  },
} as const;
export type SettingsSectionDirection = "next" | "previous" | "first" | "last";
export type SettingsDraft = {
  runtimeKind: DesktopSettings["runtime_kind"];
  runtimePath: string;
  aiswHome: string;
  updateChannel: DesktopUpdateChannel;
};
export type DesktopPreferencesDraft = Pick<
  DesktopPreferences,
  "appearance" | "defaultSection" | "showMenuBarIcon" | "restoreWindowState"
>;
export type SettingsDraftPatch = Partial<SettingsDraft>;
export type DesktopPreferencesDraftPatch = Partial<DesktopPreferencesDraft>;
export type SettingsOption<Value extends string> = {
  value: Value;
  label: string;
};

type RuntimeInventoryPathKey = "bundled_path" | "system_path";

const SETTINGS_SECTION_KEY_DIRECTIONS = {
  ArrowDown: "next",
  ArrowRight: "next",
  ArrowUp: "previous",
  ArrowLeft: "previous",
  Home: "first",
  End: "last",
} as const satisfies Record<string, SettingsSectionDirection>;
const DEFAULT_SECTION_LABELS: Record<DefaultAppSection, string> = {
  [APP_NAV_IDS.overview]: APP_NAV_LABELS[APP_NAV_IDS.overview],
  [APP_NAV_IDS.profiles]: APP_NAV_LABELS[APP_NAV_IDS.profiles],
  [APP_NAV_IDS.sets]: APP_NAV_LABELS[APP_NAV_IDS.sets],
  [APP_NAV_IDS.diagnostics]: APP_NAV_LABELS[APP_NAV_IDS.diagnostics],
  [APP_NAV_IDS.backups]: APP_NAV_LABELS[APP_NAV_IDS.backups],
  [APP_NAV_IDS.activity]: APP_NAV_LABELS[APP_NAV_IDS.activity],
};
const APPEARANCE_LABELS: Record<(typeof DESKTOP_APPEARANCES)[number], string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};
const RUNTIME_SOURCE_LABELS: Record<DesktopSettings["runtime_kind"], string> = {
  bundled: "Bundled",
  system: SYSTEM_ENGINE_LABEL,
  custom: "Custom path",
};
const UPDATE_CHANNEL_LABELS: Record<DesktopUpdateChannel, string> = {
  stable: "Stable",
  beta: "Beta",
};

const RUNTIME_INVENTORY_PATH_KEYS: Record<
  Exclude<DesktopSettings["runtime_kind"], "custom">,
  RuntimeInventoryPathKey
> = {
  bundled: "bundled_path",
  system: "system_path",
};

export const SETTINGS_APPEARANCE_OPTIONS = DESKTOP_APPEARANCES.map((value) => ({
  value,
  label: APPEARANCE_LABELS[value],
})) satisfies SettingsOption<DesktopPreferencesDraft["appearance"]>[];

export const SETTINGS_DEFAULT_SECTION_OPTIONS = DEFAULT_SECTIONS.map((value) => ({
  value,
  label: DEFAULT_SECTION_LABELS[value],
})) satisfies SettingsOption<DesktopPreferencesDraft["defaultSection"]>[];

export const SETTINGS_RUNTIME_SOURCE_OPTIONS = (
  Object.entries(RUNTIME_SOURCE_LABELS) as [
    DesktopSettings["runtime_kind"],
    string,
  ][]
).map(([value, label]) => ({
  value,
  label,
})) satisfies SettingsOption<DesktopSettings["runtime_kind"]>[];

export const SETTINGS_UPDATE_CHANNEL_OPTIONS = DESKTOP_UPDATE_CHANNELS.map((value) => ({
  value,
  label: UPDATE_CHANNEL_LABELS[value],
})) satisfies SettingsOption<SettingsDraft["updateChannel"]>[];

export function formatSettingsMutationError(error: unknown) {
  return resolveNormalizedErrorDetails(
    error,
    DEFAULT_ACTION_FAILURE_MESSAGE,
    normalizeRuntimeLanguage,
  );
}

export function findShellHookCheck(report: DoctorReport | undefined) {
  const checks = parseDoctorReportChecks(report, {
    detailTransform: normalizeTerminalIntegrationText,
  });
  for (const check of checks) {
    if (!doctorCheckHasKeyword(check, "shell")) {
      continue;
    }
    return {
      status: check.status,
      detail: check.detail,
    };
  }
  return null;
}

export function effectiveRuntimePath(
  runtimeKind: DesktopSettings["runtime_kind"],
  runtimePath: string,
) {
  return runtimeKind === "custom" ? runtimePath : "";
}

export function persistedRuntimePath(
  runtimeKind: DesktopSettings["runtime_kind"],
  runtimePath: string,
) {
  return emptyStringToNull(effectiveRuntimePath(runtimeKind, runtimePath));
}

export function sectionLabel(section: SettingsSection) {
  return settingsSectionLabel(section);
}

export function nextSettingsSection(
  currentSection: SettingsSection,
  direction: SettingsSectionDirection,
) {
  const currentIndex = SETTINGS_SECTIONS.indexOf(currentSection);
  if (currentIndex === -1) {
    return currentSection;
  }

  const targetIndex = resolveSettingsSectionIndex(currentIndex, direction);

  return SETTINGS_SECTIONS[targetIndex] ?? currentSection;
}

export function initialSettingsSection(section: SettingsSection | null | undefined) {
  return normalizeOneOf(SETTINGS_SECTIONS, section, DEFAULT_SETTINGS_SECTION);
}

export function settingsSectionDirectionForKey(key: string): SettingsSectionDirection | null {
  return nullishToNull(
    SETTINGS_SECTION_KEY_DIRECTIONS[key as keyof typeof SETTINGS_SECTION_KEY_DIRECTIONS],
  );
}

export function clipboardUnavailableMessage(label: string) {
  return clipboardUnavailableManualMessage(`the ${label} step`);
}

export function clipboardSuccessMessage(label: string) {
  return clipboardCopiedMessage(`${label} step`);
}

export function exportedDiagnosticMessage(filename: string) {
  return diagnosticExportedMessage(filename);
}

export function openedAppDataFolderMessage(path: string) {
  return openedItemMessage(path);
}

export function launchAtLoginErrorMessage(error: unknown) {
  return resolveErrorMessage(error, "AI Switch could not update launch at login.");
}

export function appDataFolderErrorMessage(error: unknown) {
  return resolveErrorMessage(error, "AI Switch could not open the app data folder.");
}

export function launchAtLoginDescription(
  supported: boolean,
  detail: string | null | undefined,
) {
  return supported
    ? undefined
    : detail ?? "Launch at login is not available in this environment.";
}

export function launchAtLoginSuccessMessage(enabled: boolean) {
  return enabled
    ? LAUNCH_AT_LOGIN_ENABLED_MESSAGE
    : LAUNCH_AT_LOGIN_DISABLED_MESSAGE;
}

export function launchAtLoginState(status: LaunchAtLoginStatus | null | undefined) {
  return {
    supported: status?.supported ?? false,
    enabled: status?.enabled ?? false,
    detail: status?.detail,
  };
}

export function releaseChannelDescription(channel: string) {
  return `Check for a signed desktop release on the selected ${channel} channel.`;
}

export function runtimeVersionLabel(runtimeStatus: AppBootstrap["runtime_status"]) {
  return runtimeStatus.version?.version ?? DATE_UNAVAILABLE_LABEL;
}

export function buildUpdateCheckResultLines(report: UpdateCheckReport) {
  const lines = [`Channel: ${report.channel}`];

  if (report.endpoint) {
    lines.push(`Endpoint: ${report.endpoint}`);
  }

  if (report.update) {
    lines.push(`Update available: ${report.update.version}`);
    if (report.update.notes) {
      lines.push(report.update.notes);
    }
    return lines;
  }

  lines.push(report.message ?? SETTINGS_NO_UPDATE_AVAILABLE_MESSAGE);
  return lines;
}

export function createSettingsDraft(settings: DesktopSettings): SettingsDraft {
  return {
    runtimeKind: settings.runtime_kind,
    runtimePath: nullishToEmptyString(settings.runtime_path),
    aiswHome: nullishToEmptyString(settings.aisw_home),
    updateChannel: normalizeDesktopUpdateChannel(settings.update_channel),
  };
}

export function createDesktopPreferencesDraft(
  desktopPreferences?: DesktopPreferences,
): DesktopPreferencesDraft {
  const preferences = desktopPreferences ?? DEFAULT_DESKTOP_PREFERENCES;
  return {
    appearance: preferences.appearance,
    defaultSection: preferences.defaultSection,
    showMenuBarIcon: preferences.showMenuBarIcon,
    restoreWindowState: preferences.restoreWindowState,
  };
}

export function patchSettingsDraft(
  draft: SettingsDraft,
  next: SettingsDraftPatch,
): SettingsDraft {
  return {
    runtimeKind: next.runtimeKind ?? draft.runtimeKind,
    runtimePath: next.runtimePath ?? draft.runtimePath,
    aiswHome: next.aiswHome ?? draft.aiswHome,
    updateChannel: next.updateChannel ?? draft.updateChannel,
  };
}

export function patchDesktopPreferencesDraft(
  draft: DesktopPreferencesDraft,
  next: DesktopPreferencesDraftPatch,
): DesktopPreferencesDraft {
  return {
    appearance: next.appearance ?? draft.appearance,
    defaultSection: next.defaultSection ?? draft.defaultSection,
    showMenuBarIcon: next.showMenuBarIcon ?? draft.showMenuBarIcon,
    restoreWindowState:
      next.restoreWindowState ?? draft.restoreWindowState,
  };
}

export function nextRuntimeSourceSelection(
  nextRuntimeKind: DesktopSettings["runtime_kind"],
  currentRuntimePath: string,
) {
  return {
    runtimeKind: nextRuntimeKind,
    runtimePath: effectiveRuntimePath(nextRuntimeKind, currentRuntimePath),
  } satisfies Pick<SettingsDraft, "runtimeKind" | "runtimePath">;
}

export function buildRuntimeSelectionSettings(
  settings: DesktopSettings,
  draft: Pick<SettingsDraft, "runtimeKind" | "runtimePath">,
): DesktopSettings {
  return {
    ...settings,
    runtime_kind: draft.runtimeKind,
    runtime_path: persistedRuntimePath(draft.runtimeKind, draft.runtimePath),
  };
}

export function buildSettingsRequest(input: {
  settings: DesktopSettings;
  draft: SettingsDraft;
  next?: SettingsDraftPatch;
}): DesktopSettings {
  const nextDraft = patchSettingsDraft(input.draft, input.next ?? {});

  return buildDesktopSettingsUpdate(input.settings, {
    runtime_kind: nextDraft.runtimeKind,
    runtime_path: persistedRuntimePath(nextDraft.runtimeKind, nextDraft.runtimePath),
    aisw_home: emptyStringToNull(nextDraft.aiswHome),
    update_channel: nextDraft.updateChannel,
  });
}

export function buildDesktopPreferencesUpdate(input: {
  desktopPreferences?: DesktopPreferences;
  draft: DesktopPreferencesDraft;
  next: DesktopPreferencesDraftPatch;
}): DesktopPreferences {
  const nextDraft = patchDesktopPreferencesDraft(input.draft, input.next);
  return {
    appearance: nextDraft.appearance,
    defaultSection: nextDraft.defaultSection,
    showMenuBarIcon: nextDraft.showMenuBarIcon,
    restoreWindowState: nextDraft.restoreWindowState,
    reopenSetupAssistant:
      input.desktopPreferences?.reopenSetupAssistant ?? false,
  };
}

export function buildResetOnboardingPreferences(input: {
  appearance: DesktopPreferences["appearance"];
  showMenuBarIcon: boolean;
  restoreWindowState: boolean;
}): DesktopPreferences {
  return {
    appearance: input.appearance,
    defaultSection: DEFAULT_DESKTOP_PREFERENCES.defaultSection,
    showMenuBarIcon: input.showMenuBarIcon,
    restoreWindowState: input.restoreWindowState,
    reopenSetupAssistant: true,
  };
}

export function selectedRuntimePath(
  settings: DesktopSettings,
  runtimeStatus: AppBootstrap["runtime_status"],
) {
  if (settings.runtime_kind === "custom") {
    return settings.runtime_path ?? NOT_SET_LABEL;
  }

  const inventoryKey = RUNTIME_INVENTORY_PATH_KEYS[settings.runtime_kind];
  return runtimeStatus.inventory?.[inventoryKey] ?? NOT_FOUND_LABEL;
}

export function selectedAiswHomePath(settings: DesktopSettings) {
  return settings.aisw_home ?? "~/.aisw";
}

function resolveSettingsSectionIndex(
  currentIndex: number,
  direction: SettingsSectionDirection,
) {
  switch (direction) {
    case "first":
      return 0;
    case "last":
      return SETTINGS_SECTIONS.length - 1;
    case "next":
      return Math.min(currentIndex + 1, SETTINGS_SECTIONS.length - 1);
    case "previous":
      return Math.max(currentIndex - 1, 0);
  }
}
