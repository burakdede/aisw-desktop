import { DesktopCommandError, type TrayCommandResultEvent } from "./lib/tauri";
import type { AppBootstrap, AppSnapshot, DesktopSettings } from "./lib/schemas";
import type { ProfileImportMode } from "./features/shared/profile-capabilities";
import type { SettingsSection } from "./features/settings/settings-panel-display";
import type {
  CommandResultScope,
  LastCommandResult,
} from "./features/shared/lastCommandResult";
import { normalizeRuntimeLanguage } from "./features/shared/runtime-language";
import {
  profileDisplayLabel,
  profileSetDisplayLabel,
  profileSetIsActive,
  sharedProfileEntries,
  toolProfileDisplayLabel,
} from "./lib/profile-display";
import { resolveGlobalStateMode, resolveStateModeRequest } from "./features/shared/state-modes";
import { titleCase } from "./lib/utils";
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

export type ReapplyActiveProfileAction =
  | {
      scope: { type: "global"; id: "profile-set" };
      resultLabel: "Re-apply active profile";
      message: string;
      action: { kind: "set"; name: string; label: string };
    }
  | {
      scope: { type: "global"; id: "switch-all" };
      resultLabel: "Re-apply active profile";
      message: string;
      action: {
        kind: "shared-profile";
        profile: string;
        label: string;
        stateMode: ReturnType<typeof resolveGlobalStateMode>;
      };
    }
  | {
      scope: { type: "tool"; tool: string };
      resultLabel: "Re-apply active profile";
      message: string;
      action: {
        kind: "tool-profile";
        tool: string;
        profile: string;
        label: string;
        stateMode: ReturnType<typeof resolveStateModeRequest>;
      };
    };

export const REAPPLY_ACTIVE_PROFILE_LABEL = "Re-apply active profile";

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

export function buildReapplyActiveProfileError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "AI Switch could not complete that action.";
  const remediation =
    error instanceof DesktopCommandError ? error.remediation : undefined;

  return {
    notificationBody: remediation ? `${message} ${remediation}` : message,
    result: {
      label: REAPPLY_ACTIVE_PROFILE_LABEL,
      status: "error" as const,
      message,
      kind: error instanceof DesktopCommandError ? error.kind : undefined,
      remediation,
    } satisfies Pick<LastCommandResult, "kind" | "label" | "message" | "remediation" | "status">,
  };
}

export function buildTrayCommandFeedback(input: unknown) {
  const event = asTrayCommandResultEvent(input);
  const message = normalizeRuntimeLanguage(event.message);
  const remediation = normalizeRuntimeLanguage(event.remediation);
  const label =
    event.scope === "global" && event.id === "context"
      ? "Use set"
      : normalizeRuntimeLanguage(event.label);
  const scope: CommandResultScope =
    event.scope === "tool"
      ? { type: "tool", tool: event.tool }
      : { type: "global", id: event.id };

  return {
    notification: {
      title: label,
      body:
        event.status === "success"
          ? message
          : [message, remediation].filter(Boolean).join(" "),
    },
    result: {
      label,
      status: event.status,
      message,
      kind: "kind" in event && typeof event.kind === "string" ? event.kind : undefined,
      remediation,
    } satisfies Pick<LastCommandResult, "kind" | "label" | "message" | "remediation" | "status">,
    scope,
  };
}

export function resolveActiveReapplyAction(input: {
  snapshot: AppSnapshot | null;
  settings: DesktopSettings | null;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  runtimeBlocked: boolean;
}): ReapplyActiveProfileAction {
  if (!input.snapshot || !input.settings || input.runtimeBlocked) {
    throw new Error("No active desktop snapshot is available yet.");
  }

  const { snapshot, settings, toolCapabilities } = input;
  const activeSet = [...(settings.profile_sets ?? [])]
    .sort((left, right) => left.name.localeCompare(right.name))
    .find((set) => profileSetIsActive(snapshot, set));

  if (activeSet) {
    const label = profileSetDisplayLabel(activeSet);
    return {
      scope: { type: "global", id: "profile-set" },
      resultLabel: REAPPLY_ACTIVE_PROFILE_LABEL,
      message: `Re-applied current set ${label}.`,
      action: {
        kind: "set",
        name: activeSet.name,
        label,
      },
    };
  }

  const activeProfiles = snapshot.statuses
    .map((status) => status.active_profile?.trim())
    .filter((profile): profile is string => Boolean(profile));
  const uniqueProfiles = [...new Set(activeProfiles)].sort((left, right) =>
    left.localeCompare(right),
  );

  if (
    uniqueProfiles.length === 1 &&
    sharedProfileEntries(settings, snapshot).some((entry) => entry.name === uniqueProfiles[0])
  ) {
    const profile = uniqueProfiles[0];
    const label = profileDisplayLabel(settings, snapshot, profile);
    return {
      scope: { type: "global", id: "switch-all" },
      resultLabel: REAPPLY_ACTIVE_PROFILE_LABEL,
      message: `Re-applied shared profile ${label}.`,
      action: {
        kind: "shared-profile",
        profile,
        label,
        stateMode: resolveGlobalStateMode(snapshot),
      },
    };
  }

  const activeStatuses = snapshot.statuses.filter(
    (status): status is (typeof snapshot.statuses)[number] & { active_profile: string } =>
      Boolean(status.active_profile?.trim()),
  );

  if (activeStatuses.length === 1) {
    const status = activeStatuses[0];
    const profile = status.active_profile.trim();
    const label = toolProfileDisplayLabel(settings, snapshot, status.tool, profile);
    return {
      scope: { type: "tool", tool: status.tool },
      resultLabel: REAPPLY_ACTIVE_PROFILE_LABEL,
      message: `Re-applied ${titleCase(status.tool)} profile ${label}.`,
      action: {
        kind: "tool-profile",
        tool: status.tool,
        profile,
        label,
        stateMode: resolveStateModeRequest(status.tool, toolCapabilities, status.state_mode),
      },
    };
  }

  throw new Error("AI Switch could not determine a single active profile to re-apply.");
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

function asTrayCommandResultEvent(value: unknown): TrayCommandResultEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid tray command result payload.");
  }

  const candidate = value as Partial<TrayCommandResultEvent>;
  if (
    typeof candidate.label !== "string" ||
    typeof candidate.message !== "string" ||
    (candidate.status !== "success" && candidate.status !== "error") ||
    (candidate.scope !== "tool" && candidate.scope !== "global")
  ) {
    throw new Error("Invalid tray command result payload.");
  }

  if (candidate.scope === "tool" && typeof candidate.tool === "string") {
    return candidate as TrayCommandResultEvent;
  }

  if (candidate.scope === "global" && typeof candidate.id === "string") {
    return candidate as TrayCommandResultEvent;
  }

  throw new Error("Invalid tray command result payload.");
}
