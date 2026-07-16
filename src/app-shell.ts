import { DesktopCommandError } from "./lib/tauri";
import type { AppBootstrap, AppSnapshot, DesktopSettings } from "./lib/schemas";
import { resolveErrorDetails } from "./lib/error-details";
import { DEFAULT_ACTION_FAILURE_MESSAGE } from "./lib/display-copy";
import type {
  ExplicitProfileCredentialBackend,
  ProfileImportMode,
} from "./features/shared/profile-capabilities";
import type {
  CommandResultScope,
  LastCommandResult,
} from "./features/shared/lastCommandResult";
import {
  parseTrayCommandResultEvent,
  type ParsedTrayCommandResultEvent,
} from "./features/shared/command-result-shape";
import {
  COMMAND_RESULT_GLOBAL_IDS,
  COMMAND_RESULT_SCOPE_TYPES,
} from "./features/shared/command-result-scope";
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
import {
  APP_NAV_IDS,
  APP_NAV_LABELS,
  APP_NAV_SHORTCUT_KEYS,
  APP_NAV_SHORTCUT_LABELS,
  type AppNavId,
} from "./lib/app-navigation";
import { createDesktopSettings } from "./lib/desktop-settings";
import { DESKTOP_ACTION_COPY } from "./lib/desktop-action-copy";
import { type SettingsSection } from "./lib/settings-sections";
export {
  runtimeSelectionLabel,
  runtimeSourceLabel,
} from "./lib/runtime-display";
import {
  INCLUDED_DESKTOP_ENGINE_LABEL,
  runtimeReadinessLabel,
  runtimeSelectionLabel,
  runtimeSourceLabel,
} from "./lib/runtime-display";

export const APP_NAV = [
  { id: APP_NAV_IDS.overview, label: APP_NAV_LABELS[APP_NAV_IDS.overview], group: "Main" },
  { id: APP_NAV_IDS.profiles, label: APP_NAV_LABELS[APP_NAV_IDS.profiles], group: "Main" },
  { id: APP_NAV_IDS.sets, label: APP_NAV_LABELS[APP_NAV_IDS.sets], group: "Main" },
  { id: APP_NAV_IDS.diagnostics, label: APP_NAV_LABELS[APP_NAV_IDS.diagnostics], group: "Health" },
  { id: APP_NAV_IDS.backups, label: APP_NAV_LABELS[APP_NAV_IDS.backups], group: "Health" },
  { id: APP_NAV_IDS.activity, label: APP_NAV_LABELS[APP_NAV_IDS.activity], group: "Health" },
  { id: APP_NAV_IDS.settings, label: APP_NAV_LABELS[APP_NAV_IDS.settings], group: "App" },
] as const;

const DEFAULT_PROFILE_SETUP_TOOL = "claude";

const APP_SECTION_TITLES: Record<AppSectionId, string> = {
  [APP_NAV_IDS.overview]: APP_NAV_LABELS[APP_NAV_IDS.overview],
  [APP_NAV_IDS.profiles]: APP_NAV_LABELS[APP_NAV_IDS.profiles],
  [APP_NAV_IDS.sets]: APP_NAV_LABELS[APP_NAV_IDS.sets],
  [APP_NAV_IDS.diagnostics]: APP_NAV_LABELS[APP_NAV_IDS.diagnostics],
  [APP_NAV_IDS.backups]: APP_NAV_LABELS[APP_NAV_IDS.backups],
  [APP_NAV_IDS.activity]: APP_NAV_LABELS[APP_NAV_IDS.activity],
  [APP_NAV_IDS.settings]: APP_NAV_LABELS[APP_NAV_IDS.settings],
  waiting: "AI Switch",
};

export const APP_SHELL_COPY = {
  appSubtitle: "Manage Claude Code, Codex CLI, and Gemini CLI identities locally.",
  currentStateKicker: "Current state",
  runtimeRecovery: {
    frameTitle: "Finish Setup",
    frameDetail:
      "AI Switch can continue as soon as it switches back to the included desktop engine.",
    cardTitle: "Finish setup",
    cardKicker: "Desktop engine required",
    intro:
      "AI Switch Desktop uses the included switching engine. A separate command-line install on this Mac cannot power this app yet.",
    guidance:
      "Your saved profiles stay local. Switch back to the included desktop engine to continue, or open Engine Settings only if you intentionally manage another compatible engine.",
    usingNowLabel: "Using now",
    needsLabel: "Desktop app needs",
    nextStepLabel: "Next step",
    useIncludedLabel: "Use Included Engine",
    useIncludedPendingLabel: "Switching to Included Engine…",
    retryLabel: "Try Again",
    settingsLabel: "Engine Settings",
    detailsSummary: "Why setup paused",
    noIssuesLabel: "No additional compatibility details were reported.",
  },
  bootstrapSurface: {
    loading: {
      kicker: "AI Switch",
      title: "Preparing your local switchboard…",
      detail: "Loading saved profiles and the current tool state on this computer.",
      status: "Opening local state",
      summary: "This stays on-device and usually finishes in a moment.",
    },
    error: {
      kicker: "AI Switch",
      title: "AI Switch could not open this window.",
      detail: "Check app setup, local permissions, and compatibility details before continuing.",
      nextStepTitle: "Review setup",
    },
    statusLabel: "Status",
    nextStepLabel: "Next step",
    loadStateFallback: "AI Switch could not load its local desktop state.",
  },
  waitingSnapshot: {
    title: "Waiting for snapshot",
    kicker: "Bootstrap",
    detail: "The desktop engine is compatible, but no state snapshot is available yet.",
  },
  runtimeBlocker: {
    missingDesktopContractSummary:
      "The current engine works outside the app, but it does not expose the desktop features AI Switch requires.",
    missingDesktopContractNextStep:
      "Use the included desktop engine, or choose a newer desktop-compatible engine in Engine Settings.",
    incompatibleSummary: "The current engine was found, but it is not compatible with this app.",
    incompatibleNextStep:
      "Use the included desktop engine, or choose a compatible engine in Engine Settings.",
    unavailableSummary: "AI Switch could not use the current desktop engine source.",
    unavailableNextStep:
      "Use the included desktop engine, or choose a working engine source in Engine Settings.",
  },
  reapplyProfile: {
    unavailableSnapshot: "No active desktop snapshot is available yet.",
    unavailableSelection: "AI Switch could not determine a single active profile to re-apply.",
  },
} as const;

export type ProfilesRouteState = {
  tool?: string;
  expandedProfile?: string | null;
  mode?: ProfileImportMode;
  credentialBackend?: ExplicitProfileCredentialBackend | null;
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

export type DesktopShortcutAction = "quick-switch" | "settings" | AppNavId;

export type SidebarStatusRow = {
  label: string;
  value: string;
};

export type ReapplyActiveProfileAction =
  | {
      scope: { type: "global"; id: typeof COMMAND_RESULT_GLOBAL_IDS.profileSet };
      resultLabel: "Re-apply active profile";
      message: string;
      action: { kind: "set"; name: string; label: string };
    }
  | {
      scope: { type: "global"; id: typeof COMMAND_RESULT_GLOBAL_IDS.switchAll };
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

export function settingsForRecovery(settings: AppBootstrap["settings"] | undefined) {
  return createDesktopSettings(settings ?? {});
}

export function navShortcutLabel(id: AppNavId | string) {
  return APP_NAV_SHORTCUT_LABELS[id as AppNavId];
}

export function appNavFromShortcut(key: string) {
  return APP_NAV_SHORTCUT_KEYS[key];
}

export function resolveDesktopShortcutAction(input: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  editableTarget: boolean;
  runtimeBlocked: boolean;
}): DesktopShortcutAction | null {
  if (!(input.metaKey || input.ctrlKey) || input.altKey || input.editableTarget) {
    return null;
  }

  const key = input.key.toLowerCase();
  if (key === "k") {
    return "quick-switch";
  }
  if (key === "," || key === "<") {
    return "settings";
  }
  if (input.runtimeBlocked) {
    return null;
  }
  return appNavFromShortcut(key) ?? null;
}

export function buildAppNavItems(runtimeBlocked: boolean) {
  return APP_NAV.map(({ id, label, group }) => ({
    id,
    label,
    group,
    disabled: runtimeBlocked && id !== APP_NAV_IDS.settings,
    shortcut: navShortcutLabel(id),
  }));
}

export function createProfilesRouteState(
  input: ProfilesRouteState = {},
): ProfilesRouteState {
  return { ...input };
}

export function createAddProfileRouteState(current: ProfilesRouteState) {
  return createProfileSetupRouteState({
    openToken: (current.openToken ?? 0) + 1,
  });
}

export function createImportCurrentLoginRouteState() {
  return createProfileSetupRouteState({ mode: "from_live" });
}

export function createProfileSetupRouteState(
  input: {
    tool?: string;
    mode?: ProfileImportMode;
    credentialBackend?: ExplicitProfileCredentialBackend | null;
    openToken?: number;
  } = {},
): ProfilesRouteState {
  return {
    tool: input.tool ?? DEFAULT_PROFILE_SETUP_TOOL,
    expandedProfile: null,
    ...(input.mode ? { mode: input.mode } : {}),
    ...(input.credentialBackend !== undefined
      ? { credentialBackend: input.credentialBackend }
      : {}),
    ...(input.openToken !== undefined ? { openToken: input.openToken } : {}),
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
      ? APP_NAV_IDS.overview
      : APP_NAV_IDS.settings
    : input.activeNav;
  const setupFocused = input.setupRequired && activeSection === APP_NAV_IDS.overview;
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
    input.activeSection === APP_NAV_IDS.backups ||
    input.activeSection === APP_NAV_IDS.activity ||
    input.activeSection === APP_NAV_IDS.settings ||
    input.activeSection === APP_NAV_IDS.profiles
  ) {
    return [];
  }

  if (input.activeSection === APP_NAV_IDS.overview) {
    return [
      {
        kind: "quick-switch",
        label: DESKTOP_ACTION_COPY.quickSwitchLabel,
        shortcut: DESKTOP_ACTION_COPY.quickSwitchShortcut,
        tone: "primary",
        disabled: input.runtimeBlocked,
      },
      {
        kind: "verify",
        label: DESKTOP_ACTION_COPY.verifyLabel,
        tone: "ghost",
      },
    ] satisfies ToolbarAction[];
  }

  return [
    {
      kind: "quick-switch",
      label: DESKTOP_ACTION_COPY.quickSwitchLabel,
      shortcut: DESKTOP_ACTION_COPY.quickSwitchShortcut,
      tone: "ghost",
      disabled: input.runtimeBlocked,
    },
    {
      kind: "verify",
      label: DESKTOP_ACTION_COPY.verifyLabel,
      tone: "ghost",
    },
    {
      kind: "add-profile",
      label: DESKTOP_ACTION_COPY.addProfileLabel,
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

export function buildRuntimeRecoveryStatusRows(input: {
  runtimeKind: AppBootstrap["settings"]["runtime_kind"];
  nextStep: string;
}) {
  return [
    {
      label: APP_SHELL_COPY.runtimeRecovery.usingNowLabel,
      value: runtimeSelectionLabel(input.runtimeKind),
    },
    {
      label: APP_SHELL_COPY.runtimeRecovery.needsLabel,
      value: INCLUDED_DESKTOP_ENGINE_LABEL,
    },
    {
      label: APP_SHELL_COPY.runtimeRecovery.nextStepLabel,
      value: normalizeRuntimeLanguage(input.nextStep),
    },
  ] as const;
}

export function runtimeRecoveryPrimaryActionLabel(isPending: boolean) {
  return isPending
    ? APP_SHELL_COPY.runtimeRecovery.useIncludedPendingLabel
    : APP_SHELL_COPY.runtimeRecovery.useIncludedLabel;
}

export function buildBootstrapLoadingSurface() {
  return APP_SHELL_COPY.bootstrapSurface.loading;
}

export function buildBootstrapErrorSurface(error: unknown) {
  const bootstrapError = describeBootstrapError(error);
  return {
    ...APP_SHELL_COPY.bootstrapSurface.error,
    summary: bootstrapError.message,
    remediation: bootstrapError.remediation,
  };
}

export function describeBootstrapError(error: unknown) {
  return resolveErrorDetails(
    error,
    APP_SHELL_COPY.bootstrapSurface.loadStateFallback,
  );
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
      summary: APP_SHELL_COPY.runtimeBlocker.missingDesktopContractSummary,
      nextStep: APP_SHELL_COPY.runtimeBlocker.missingDesktopContractNextStep,
    };
  }

  if (hasResolvedRuntime) {
    return {
      summary: APP_SHELL_COPY.runtimeBlocker.incompatibleSummary,
      nextStep: APP_SHELL_COPY.runtimeBlocker.incompatibleNextStep,
    };
  }

  return {
    summary: APP_SHELL_COPY.runtimeBlocker.unavailableSummary,
    nextStep: APP_SHELL_COPY.runtimeBlocker.unavailableNextStep,
  };
}

export function buildReapplyActiveProfileError(error: unknown) {
  const details = resolveErrorDetails(
    error,
    DEFAULT_ACTION_FAILURE_MESSAGE,
  );

  return {
    notificationBody: details.remediation
      ? `${details.message} ${details.remediation}`
      : details.message,
    result: {
      label: REAPPLY_ACTIVE_PROFILE_LABEL,
      status: "error" as const,
      message: details.message,
      kind: details.kind,
      remediation: details.remediation,
    } satisfies Pick<LastCommandResult, "kind" | "label" | "message" | "remediation" | "status">,
  };
}

export function buildTrayCommandFeedback(input: unknown) {
  const event = asTrayCommandResultEvent(input);
  const message = normalizeRuntimeLanguage(event.message);
  const remediation = normalizeRuntimeLanguage(event.remediation);
  const label =
    event.scope === COMMAND_RESULT_SCOPE_TYPES.global && event.id === COMMAND_RESULT_GLOBAL_IDS.context
      ? "Use set"
      : normalizeRuntimeLanguage(event.label);
  let scope: CommandResultScope;
  if (event.scope === COMMAND_RESULT_SCOPE_TYPES.tool) {
    scope = { type: COMMAND_RESULT_SCOPE_TYPES.tool, tool: event.tool };
  } else {
    scope = { type: COMMAND_RESULT_SCOPE_TYPES.global, id: event.id };
  }

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
    throw new Error(APP_SHELL_COPY.reapplyProfile.unavailableSnapshot);
  }

  const { snapshot, settings, toolCapabilities } = input;
  const activeSet = [...(settings.profile_sets ?? [])]
    .sort((left, right) => left.name.localeCompare(right.name))
    .find((set) => profileSetIsActive(snapshot, set));

  if (activeSet) {
    const label = profileSetDisplayLabel(activeSet);
    return {
      scope: { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.profileSet },
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
      scope: { type: "global", id: COMMAND_RESULT_GLOBAL_IDS.switchAll },
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

  throw new Error(APP_SHELL_COPY.reapplyProfile.unavailableSelection);
}

export function sectionTitle(section: string, setupFocused = false) {
  if (setupFocused) {
    return "Get started";
  }

  return APP_SECTION_TITLES[section as AppSectionId] ?? APP_SECTION_TITLES.waiting;
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

function asTrayCommandResultEvent(value: unknown): ParsedTrayCommandResultEvent {
  const parsed = parseTrayCommandResultEvent(value);
  if (!parsed) {
    throw new Error("Invalid tray command result payload.");
  }
  return parsed;
}
