import {
  DEFAULT_SECTIONS,
  DESKTOP_APPEARANCES,
  DEFAULT_DESKTOP_PREFERENCES,
  type DesktopPreferences,
} from "../../lib/desktop-preferences";
import { type DefaultAppSection } from "../../lib/app-navigation";
import {
  DESKTOP_UPDATE_CHANNELS,
  normalizeDesktopUpdateChannel,
  type DesktopUpdateChannel,
} from "../../lib/desktop-settings";
import { normalizeResolvedCheckStatus } from "../../lib/check-status";
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_SECTION_IDS,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "../../lib/settings-sections";
import type { AppBootstrap, DesktopSettings, ShellHookGuidance } from "../../lib/schemas";
import { DEFAULT_ACTION_FAILURE_MESSAGE, NOT_FOUND_LABEL, NOT_SET_LABEL } from "../../lib/display-copy";
import { DesktopCommandError } from "../../lib/tauri";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";

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

const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  [SETTINGS_SECTION_IDS.general]: "General",
  [SETTINGS_SECTION_IDS.runtime]: "Engine",
  [SETTINGS_SECTION_IDS.shell]: "Terminal Integration",
  [SETTINGS_SECTION_IDS.keyring]: "Security",
  [SETTINGS_SECTION_IDS.updates]: "Updates",
  [SETTINGS_SECTION_IDS.advanced]: "Advanced",
};
const DEFAULT_SECTION_LABELS: Record<DefaultAppSection, string> = {
  overview: "Overview",
  profiles: "Profiles",
  sets: "Sets",
  diagnostics: "Diagnostics",
  backups: "Backups",
  activity: "Activity",
};
const APPEARANCE_LABELS: Record<(typeof DESKTOP_APPEARANCES)[number], string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};
const RUNTIME_SOURCE_LABELS: Record<DesktopSettings["runtime_kind"], string> = {
  bundled: "Bundled",
  system: "System engine",
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

function findShellGuidanceVariants(
  shellGuidance: ShellHookGuidance | undefined,
) {
  const variants = shellGuidance?.variants;
  return Array.isArray(variants) && variants.length ? variants : undefined;
}

export function formatSettingsMutationError(error: unknown) {
  if (error instanceof DesktopCommandError) {
    return {
      message: normalizeRuntimeLanguage(error.message),
      remediation: normalizeRuntimeLanguage(error.remediation),
    };
  }
  if (error instanceof Error) {
    return {
      message: normalizeRuntimeLanguage(error.message),
      remediation: undefined,
    };
  }
  return {
    message: DEFAULT_ACTION_FAILURE_MESSAGE,
    remediation: undefined,
  };
}

export function findShellHookCheck(report: Record<string, unknown> | undefined) {
  const checks = Array.isArray(report?.checks) ? report.checks : [];
  for (const entry of checks) {
    const check = entry as { name?: string; status?: string; detail?: string };
    if (!check.name?.toLowerCase().includes("shell")) {
      continue;
    }
    return {
      status: normalizeResolvedCheckStatus(check.status, "warn"),
      detail: normalizeTerminalIntegrationText(check.detail ?? ""),
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
  return effectiveRuntimePath(runtimeKind, runtimePath) || null;
}

export function sectionLabel(section: SettingsSection) {
  return SETTINGS_SECTION_LABELS[section];
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

export function settingsSectionDirectionForKey(key: string): SettingsSectionDirection | null {
  return SETTINGS_SECTION_KEY_DIRECTIONS[
    key as keyof typeof SETTINGS_SECTION_KEY_DIRECTIONS
  ] ?? null;
}

export function resolveSelectedShellVariant(
  shellGuidance: ShellHookGuidance | undefined,
  selectedShell: string,
) {
  const variants = findShellGuidanceVariants(shellGuidance);
  if (!variants) {
    return undefined;
  }
  return variants.find((variant) => variant.shell === selectedShell) ?? variants[0];
}

export function resolveSelectedShell(
  shellGuidance: ShellHookGuidance | undefined,
  currentShell: string,
) {
  if (currentShell) {
    return currentShell;
  }

  const variants = findShellGuidanceVariants(shellGuidance);
  if (!variants) {
    return "";
  }

  const preferred = shellGuidance?.detected_shell ?? "";
  return variants.find((variant) => variant.shell === preferred)?.shell ?? variants[0].shell;
}

export function clipboardUnavailableMessage(label: string) {
  return `Clipboard access is unavailable. Copy the ${label} step manually.`;
}

export function clipboardSuccessMessage(label: string) {
  return `Copied ${label} step.`;
}

export function exportedDiagnosticMessage(filename: string) {
  return `Saved ${filename}.`;
}

export function openedAppDataFolderMessage(path: string) {
  return `Opened ${path}.`;
}

export function launchAtLoginErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "AI Switch could not update launch at login.";
}

export function appDataFolderErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "AI Switch could not open the app data folder.";
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

export function releaseChannelDescription(channel: string) {
  return `Check for a signed desktop release on the selected ${channel} channel.`;
}

export function createSettingsDraft(settings: DesktopSettings): SettingsDraft {
  return {
    runtimeKind: settings.runtime_kind,
    runtimePath: settings.runtime_path ?? "",
    aiswHome: settings.aisw_home ?? "",
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

  return {
    runtime_kind: nextDraft.runtimeKind,
    runtime_path: persistedRuntimePath(nextDraft.runtimeKind, nextDraft.runtimePath),
    aisw_home: nextDraft.aiswHome || null,
    update_channel: nextDraft.updateChannel,
    profile_labels: input.settings.profile_labels ?? {},
    profile_sets: input.settings.profile_sets,
  };
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
