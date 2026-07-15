import {
  DEFAULT_DESKTOP_PREFERENCES,
  type DesktopPreferences,
} from "../../lib/desktop-preferences";
import type { AppBootstrap, DesktopSettings, ShellHookGuidance } from "../../lib/schemas";
import { DEFAULT_ACTION_FAILURE_MESSAGE, NOT_FOUND_LABEL, NOT_SET_LABEL } from "../../lib/display-copy";
import { DesktopCommandError } from "../../lib/tauri";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";

export const LAUNCH_AT_LOGIN_ENABLED_MESSAGE = "Launch at login enabled.";
export const LAUNCH_AT_LOGIN_DISABLED_MESSAGE = "Launch at login disabled.";
export const WINDOW_LAYOUT_RESET_MESSAGE = "Cleared the saved window size and position.";
export const SETTINGS_SECTIONS = [
  "general",
  "runtime",
  "shell",
  "keyring",
  "updates",
  "advanced",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export const DEFAULT_SETTINGS_SECTION: SettingsSection = SETTINGS_SECTIONS[0];
export type SettingsSectionDirection = "next" | "previous" | "first" | "last";
export type SettingsDraft = {
  runtimeKind: DesktopSettings["runtime_kind"];
  runtimePath: string;
  aiswHome: string;
  updateChannel: string;
};
export type DesktopPreferencesDraft = Pick<
  DesktopPreferences,
  "appearance" | "defaultSection" | "showMenuBarIcon" | "restoreWindowState"
>;

const SETTINGS_SECTION_LABELS: Record<SettingsSection, string> = {
  general: "General",
  runtime: "Engine",
  shell: "Terminal Integration",
  keyring: "Security",
  updates: "Updates",
  advanced: "Advanced",
};

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
      status:
        check.status === "pass" || check.status === "warn" || check.status === "fail"
          ? check.status
          : "warn",
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

  const targetIndex =
    direction === "first"
      ? 0
      : direction === "last"
        ? SETTINGS_SECTIONS.length - 1
        : direction === "next"
          ? Math.min(currentIndex + 1, SETTINGS_SECTIONS.length - 1)
          : Math.max(currentIndex - 1, 0);

  return SETTINGS_SECTIONS[targetIndex] ?? currentSection;
}

export function settingsSectionDirectionForKey(key: string): SettingsSectionDirection | null {
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return "next";
    case "ArrowUp":
    case "ArrowLeft":
      return "previous";
    case "Home":
      return "first";
    case "End":
      return "last";
    default:
      return null;
  }
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

export function createSettingsDraft(settings: DesktopSettings): SettingsDraft {
  return {
    runtimeKind: settings.runtime_kind,
    runtimePath: settings.runtime_path ?? "",
    aiswHome: settings.aisw_home ?? "",
    updateChannel: settings.update_channel,
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

export function nextRuntimeSourceSelection(
  nextRuntimeKind: DesktopSettings["runtime_kind"],
  currentRuntimePath: string,
) {
  return {
    runtimeKind: nextRuntimeKind,
    runtimePath: nextRuntimeKind === "custom" ? currentRuntimePath : "",
  } satisfies Pick<SettingsDraft, "runtimeKind" | "runtimePath">;
}

export function buildSettingsRequest(input: {
  settings: DesktopSettings;
  runtimeKind: DesktopSettings["runtime_kind"];
  runtimePath: string;
  aiswHome: string;
  updateChannel: string;
  next?: {
    runtimeKind?: DesktopSettings["runtime_kind"];
    runtimePath?: string;
    aiswHome?: string;
    updateChannel?: string;
  };
}): DesktopSettings {
  const nextRuntimeKind = input.next?.runtimeKind ?? input.runtimeKind;
  const nextRuntimePath = input.next?.runtimePath ?? input.runtimePath;
  const nextAiswHome = input.next?.aiswHome ?? input.aiswHome;
  const nextUpdateChannel = input.next?.updateChannel ?? input.updateChannel;

  return {
    runtime_kind: nextRuntimeKind,
    runtime_path: effectiveRuntimePath(nextRuntimeKind, nextRuntimePath) || null,
    aisw_home: nextAiswHome || null,
    update_channel: nextUpdateChannel,
    profile_labels: input.settings.profile_labels ?? {},
    profile_sets: input.settings.profile_sets,
  };
}

export function buildDesktopPreferencesUpdate(input: {
  desktopPreferences?: DesktopPreferences;
  appearance: DesktopPreferences["appearance"];
  defaultSection: DesktopPreferences["defaultSection"];
  showMenuBarIcon: boolean;
  restoreWindowState: boolean;
  next: Partial<
    Pick<
      DesktopPreferences,
      "appearance" | "defaultSection" | "showMenuBarIcon" | "restoreWindowState"
    >
  >;
}): DesktopPreferences {
  return {
    appearance: input.next.appearance ?? input.appearance,
    defaultSection: input.next.defaultSection ?? input.defaultSection,
    showMenuBarIcon: input.next.showMenuBarIcon ?? input.showMenuBarIcon,
    restoreWindowState:
      input.next.restoreWindowState ?? input.restoreWindowState,
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
  if (settings.runtime_kind === "system") {
    return runtimeStatus.inventory?.system_path ?? NOT_FOUND_LABEL;
  }
  return runtimeStatus.inventory?.bundled_path ?? NOT_FOUND_LABEL;
}
