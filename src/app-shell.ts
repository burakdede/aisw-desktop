import { DesktopCommandError } from "./lib/tauri";
import type { AppBootstrap } from "./lib/schemas";
import type { ProfileImportMode } from "./features/shared/profile-capabilities";
import type { SettingsSection } from "./features/settings/settings-panel-display";
export {
  runtimeSelectionLabel,
  runtimeSourceLabel,
} from "./lib/runtime-display";
import { runtimeReadinessLabel, runtimeSourceLabel } from "./lib/runtime-display";

export const APP_NAV = [
  { id: "overview", label: "Overview", group: "Main" },
  { id: "profiles", label: "Profiles", group: "Main" },
  { id: "sets", label: "Sets", group: "Main" },
  { id: "diagnostics", label: "Diagnostics", group: "Health" },
  { id: "backups", label: "Backups", group: "Health" },
  { id: "activity", label: "Activity", group: "Health" },
  { id: "settings", label: "Settings", group: "App" },
] as const;

export type AppNavId = (typeof APP_NAV)[number]["id"];

export type ProfilesRouteState = {
  tool?: string;
  expandedProfile?: string | null;
  mode?: ProfileImportMode;
  credentialBackend?: "file" | "system-keyring" | null;
  openToken?: number;
};

export type SettingsRouteState = {
  section?: SettingsSection;
};

export type AppSectionId = AppNavId | "waiting";

export type ToolbarAction = {
  kind: "quick-switch" | "verify" | "add-profile";
  label: string;
  shortcut?: string;
  tone: "primary" | "ghost";
  disabled?: boolean;
};

export type SidebarStatusRow = {
  label: string;
  value: string;
};

const NAV_SHORTCUTS: Record<string, AppNavId> = {
  "1": "overview",
  "2": "profiles",
  "3": "sets",
  "4": "diagnostics",
  "5": "backups",
  "6": "activity",
};

export function settingsForRecovery(settings: AppBootstrap["settings"] | undefined) {
  return (
    settings ?? {
      runtime_kind: "bundled" as const,
      runtime_path: null,
      aisw_home: null,
      update_channel: "stable",
      profile_labels: {},
      profile_sets: [],
    }
  );
}

export function navShortcutLabel(id: AppNavId | string) {
  switch (id) {
    case "overview":
      return "⌘1";
    case "profiles":
      return "⌘2";
    case "sets":
      return "⌘3";
    case "diagnostics":
      return "⌘4";
    case "backups":
      return "⌘5";
    case "activity":
      return "⌘6";
    case "settings":
      return "⌘,";
    default:
      return undefined;
  }
}

export function appNavFromShortcut(key: string) {
  return NAV_SHORTCUTS[key];
}

export function buildAppNavItems(runtimeBlocked: boolean) {
  return APP_NAV.map(({ id, label, group }) => ({
    id,
    label,
    group,
    disabled: runtimeBlocked && id !== "settings",
    shortcut: navShortcutLabel(id),
  }));
}

export function createProfilesRouteState(
  input: ProfilesRouteState = {},
): ProfilesRouteState {
  return { ...input };
}

export function createAddProfileRouteState(current: ProfilesRouteState) {
  return {
    tool: "claude",
    expandedProfile: null,
    openToken: (current.openToken ?? 0) + 1,
  } satisfies ProfilesRouteState;
}

export function createImportCurrentLoginRouteState() {
  return {
    tool: "claude",
    expandedProfile: null,
    mode: "from_live",
  } satisfies ProfilesRouteState;
}

export function createSettingsRouteState(
  section?: SettingsSection,
): SettingsRouteState {
  return { section };
}

export function deriveAppShellState(input: {
  activeNav: AppNavId;
  runtimeBlocked: boolean;
  runtimeRecoveryOpen: boolean;
  setupRequired: boolean;
}) {
  const runtimeRecoveryFocused = input.runtimeBlocked && !input.runtimeRecoveryOpen;
  const activeSection = input.runtimeBlocked
    ? runtimeRecoveryFocused
      ? "overview"
      : "settings"
    : input.activeNav;
  const setupFocused = input.setupRequired && activeSection === "overview";
  const showSetupWindow = setupFocused || runtimeRecoveryFocused;

  return {
    activeSection,
    runtimeRecoveryFocused,
    setupFocused,
    showSetupWindow,
  };
}

export function buildToolbarActions(input: {
  activeSection: AppSectionId;
  runtimeBlocked: boolean;
  showSetupWindow: boolean;
}) {
  if (
    input.showSetupWindow ||
    input.activeSection === "backups" ||
    input.activeSection === "activity" ||
    input.activeSection === "settings" ||
    input.activeSection === "profiles"
  ) {
    return [];
  }

  if (input.activeSection === "overview") {
    return [
      {
        kind: "quick-switch",
        label: "Quick Switch",
        shortcut: "⌘K",
        tone: "primary",
        disabled: input.runtimeBlocked,
      },
      {
        kind: "verify",
        label: "Verify",
        tone: "ghost",
      },
    ] satisfies ToolbarAction[];
  }

  return [
    {
      kind: "quick-switch",
      label: "Quick Switch",
      shortcut: "⌘K",
      tone: "ghost",
      disabled: input.runtimeBlocked,
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
      disabled: input.runtimeBlocked,
    },
  ] satisfies ToolbarAction[];
}

export function buildSidebarStatusRows(input: {
  currentActiveSet: string | null;
  runtimeCompatible: boolean;
  runtimeKind: AppBootstrap["settings"]["runtime_kind"];
}) {
  return [
    {
      label: "Active set",
      value: input.currentActiveSet ?? "None",
    },
    {
      label: "Switching",
      value: runtimeReadinessLabel(input.runtimeCompatible, "sentence"),
    },
    {
      label: "Engine source",
      value: runtimeSourceLabel(input.runtimeKind),
    },
  ] satisfies SidebarStatusRow[];
}

export function describeBootstrapError(error: unknown) {
  if (error instanceof DesktopCommandError) {
    return {
      message: error.message,
      remediation: error.remediation,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      remediation: undefined,
    };
  }

  return {
    message: "AI Switch could not load its local desktop state.",
    remediation: undefined,
  };
}

export function describeRuntimeBlocker(runtimeStatus: {
  resolved_path?: string | null;
  version?: unknown;
  capabilities?: unknown;
  issues: string[];
}) {
  const hasResolvedRuntime = Boolean(runtimeStatus.resolved_path);
  const missingDesktopContract =
    runtimeStatus.version == null ||
    runtimeStatus.capabilities == null ||
    runtimeStatus.issues.some(
      (issue) =>
        issue.includes("version info is unavailable") ||
        issue.includes("capabilities info is unavailable"),
    );

  if (hasResolvedRuntime && missingDesktopContract) {
    return {
      summary:
        "The current engine works outside the app, but it does not expose the desktop features AI Switch requires.",
      nextStep:
        "Use the included desktop engine, or choose a newer desktop-compatible engine in Engine Settings.",
    };
  }

  if (hasResolvedRuntime) {
    return {
      summary: "The current engine was found, but it is not compatible with this app.",
      nextStep:
        "Use the included desktop engine, or choose a compatible engine in Engine Settings.",
    };
  }

  return {
    summary: "AI Switch could not use the current desktop engine source.",
    nextStep:
      "Use the included desktop engine, or choose a working engine source in Engine Settings.",
  };
}

export function sectionTitle(section: string, setupFocused = false) {
  if (setupFocused) {
    return "Get started";
  }

  switch (section) {
    case "overview":
      return "Overview";
    case "profiles":
      return "Profiles";
    case "sets":
      return "Sets";
    case "diagnostics":
      return "Diagnostics";
    case "backups":
      return "Backups";
    case "activity":
      return "Activity";
    case "settings":
      return "Settings";
    default:
      return "AI Switch";
  }
}

export function sectionDetail(section: string, setupFocused = false) {
  if (setupFocused) {
    return "";
  }

  switch (section) {
    default:
      return "";
  }
}
