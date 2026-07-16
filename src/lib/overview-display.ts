import { AUTH_METHOD_NOT_CONFIGURED_LABEL, authMethodLabel } from "./auth-method-display";
import { normalizeRuntimeLanguage } from "../features/shared/runtime-language";
import { fixedStateModeDescription, stateModeDescription, stateModeLabel } from "../features/shared/state-modes";
import { toolInspectorEmptyLabel, overviewHealthLabel, overviewHealthText, resolveOverviewHealthState, type OverviewHealthState } from "./status-display";
import { toolProfileDisplayLabel } from "./profile-display";
import type { AppSnapshot, DesktopSettings, ToolStatus } from "./schemas";
import { toolShortName } from "./tool-registry";
import { countLabel, pluralChoice, titleCase } from "./utils";

export type OverviewInspectorActionKind =
  | "switch"
  | "reapply"
  | "import_current"
  | "open_account_setup"
  | "open_profile"
  | "resolve_workspace"
  | "refresh";

export type OverviewInspectorAction = {
  kind: OverviewInspectorActionKind;
  label: string;
  ariaLabel?: string;
};

export type OverviewInspectorPresentation = {
  activeProfileLabel: string | null;
  currentSelectionLabel: string;
  hasProfiles: boolean;
  healthText: string;
  menuActions: OverviewInspectorAction[];
  primaryAction: OverviewInspectorAction | null;
  secondaryAction: OverviewInspectorAction | null;
  selectedProfileLabel: string | null;
  showActionArea: boolean;
  showActionsMenu: boolean;
  state: OverviewHealthState;
  statusLabel: string;
  summaryLabel: string;
};

export const OVERVIEW_CURRENT_SET_LABEL = "Current set:";
export const OVERVIEW_EMPTY_SELECTION_COPY =
  "Choose a tool to inspect its active profile and switching state.";
export const OVERVIEW_NO_TOOL_SELECTED_HEADING = "No tool selected";
export const OVERVIEW_MORE_ACTIONS_LABEL = "More profile actions";
export const OVERVIEW_PANEL_COPY = {
  currentSetFallback: "None",
  selectedToolFallback: "Tool",
  toolsHeading: "Tools",
  toolsAriaLabel: "Tools",
  noToolsHeading: "No tools detected",
  noToolsBody: "Install or configure a supported tool before switching can begin.",
  footerActionLabel: "View Activity",
  backLabel: "Back",
  liveMismatchFallbackProfileLabel: "the saved profile",
  missingBinaryActionLabel: "Installation Help",
  missingBinaryRefreshLabel: "Refresh",
  noProfileHeading: "No profile configured",
  noProfileBody: "Add a saved profile before switching this tool from Overview.",
  addProfileLabel: "Add Profile…",
  activeProfileFieldLabel: "Active profile",
  stateModeFieldLabel: "State mode",
  stateModeAriaLabel: "State mode",
  stateModeFixedValue: "Isolated",
  actionsMenuAriaLabel: "Overview actions",
  facts: {
    activeProfile: "Active profile",
    liveState: "Live state",
    authentication: "Authentication",
    backend: "Backend",
    lastVerified: "Last verified",
  },
  noneLabel: "None",
} as const;

export function overviewToolCountLabel(total: number) {
  return `${total} total`;
}

export function overviewToolInspectorLabel(tool: string) {
  return `Inspect ${toolShortName(tool)}`;
}

export function overviewSelectProfileLabel(tool: string) {
  return `Switch ${tool} profile`;
}

export function overviewStateModeLabel(mode: string) {
  return stateModeLabel(mode);
}

export function overviewLiveMismatchNotice(
  toolName: string,
  activeProfileLabel: string | null,
) {
  return {
    summary: `Live credentials do not match ${
      activeProfileLabel ?? OVERVIEW_PANEL_COPY.liveMismatchFallbackProfileLabel
    }.`,
    detail: `${toolName} appears to have been signed into outside AI Switch.`,
  };
}

export function overviewMissingBinaryMessage(toolName: string) {
  return `${toolName} is not installed on this Mac.`;
}

export function resolveOverviewSelectedTool(
  currentTool: string,
  statuses: ToolStatus[],
) {
  if (!statuses.length) {
    return "";
  }
  if (currentTool && statuses.some((status) => status.tool === currentTool)) {
    return currentTool;
  }
  return statuses[0]?.tool ?? "";
}

export function resolveOverviewStateMode(
  currentMode: string,
  stateModes: string[],
) {
  if (!stateModes.length) {
    return currentMode;
  }
  if (stateModes.includes(currentMode)) {
    return currentMode;
  }
  return stateModes[0] ?? currentMode;
}

export function resolveOverviewSelectedProfile(
  currentProfile: string,
  profiles: AppSnapshot["profiles"][string]["profiles"],
  activeProfile: string | null | undefined,
) {
  const availableProfiles = profiles.map((profile) => profile.name);
  if (currentProfile && availableProfiles.includes(currentProfile)) {
    return currentProfile;
  }
  return activeProfile ?? availableProfiles[0] ?? "";
}

export function overviewToolListProfileLabel(
  status: ToolStatus,
  settings: DesktopSettings,
  snapshot: AppSnapshot,
) {
  return status.active_profile
    ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
    : toolInspectorEmptyLabel(status);
}

export function resolveOverallOverviewState(
  states: OverviewHealthState[],
): OverviewHealthState {
  const readyCount = states.filter((state) => state === "ready").length;
  const attentionCount = states.filter((state) => state === "needs_attention").length;
  const blockedCount = states.filter((state) => state === "blocked").length;
  const notConfiguredCount = states.filter((state) => state === "not_configured").length;

  if (blockedCount) {
    return "blocked";
  }
  if (attentionCount) {
    return "needs_attention";
  }
  if (!states.length || readyCount === 0) {
    return "not_configured";
  }
  if (readyCount === states.length) {
    return "ready";
  }
  if (notConfiguredCount === states.length) {
    return "not_configured";
  }
  return "not_verified";
}

export function overviewHeadline(states: OverviewHealthState[]) {
  const readyCount = states.filter((state) => state === "ready").length;
  const attentionCount = states.filter((state) => state === "needs_attention").length;
  const blockedCount = states.filter((state) => state === "blocked").length;
  const notConfiguredCount = states.filter((state) => state === "not_configured").length;
  const notVerifiedCount = states.filter((state) => state === "not_verified").length;

  if (blockedCount) {
    return `${countLabel(blockedCount, "tool")} blocked`;
  }
  if (attentionCount) {
    return `${countLabel(attentionCount, "tool")} ${pluralChoice(attentionCount, "needs", "need")} attention`;
  }
  if (notConfiguredCount === states.length) {
    return "No tools configured yet";
  }
  if (notVerifiedCount) {
    return `${countLabel(notVerifiedCount, "tool")} ${pluralChoice(notVerifiedCount, "still needs", "still need")} verification`;
  }
  if (readyCount) {
    return `${countLabel(readyCount, "tool")} ready`;
  }
  return "Review tool readiness";
}

export function overviewMetaLabel(states: OverviewHealthState[]) {
  if (states.includes("blocked")) {
    return "Fix blocked tools first";
  }
  if (states.includes("needs_attention")) {
    return "Review mismatches before coding";
  }
  if (states.includes("not_verified")) {
    return "Verification pending";
  }
  if (states.includes("ready")) {
    return "Ready to switch";
  }
  return "No profiles configured";
}

export function overviewWorkspaceActionLabel(canResolveDirectly: boolean) {
  return canResolveDirectly ? "Use Expected Set" : "Open Sets";
}

export function overviewSetButtonLabel(hasCurrentSet: boolean) {
  return hasCurrentSet ? "Open Sets" : "Choose Set…";
}

export function overviewInspectorEmptyHeading(
  compactLayout: boolean,
  selectedToolName: string,
) {
  return compactLayout ? selectedToolName : OVERVIEW_NO_TOOL_SELECTED_HEADING;
}

export function overviewStateModeCopy(options: string[], selected: string, tool: string) {
  if (!options.length) {
    return fixedStateModeDescription(tool);
  }
  const effective = options.includes(selected) ? selected : options[0] ?? selected;
  return stateModeDescription(effective);
}

export function overviewSelectedStateMode(
  options: string[],
  selected: string,
) {
  return options.length ? selected : null;
}

export function overviewRecentSummary(input: {
  bulkResult?: {
    status: "success" | "error";
    message: string;
    remediation?: string;
  };
  workspaceResult?: {
    status: "success" | "error";
    message: string;
    remediation?: string;
  };
  contextResult?: {
    status: "success" | "error";
    message: string;
    remediation?: string;
  };
}) {
  if (input.bulkResult) {
    return `Last set result: ${input.bulkResult.message}${
      input.bulkResult.remediation ? ` Remediation: ${input.bulkResult.remediation}` : ""
    }`;
  }
  if (input.workspaceResult) {
    return `Last project result: ${input.workspaceResult.message}${
      input.workspaceResult.remediation ? ` Remediation: ${input.workspaceResult.remediation}` : ""
    }`;
  }
  if (input.contextResult) {
    return `Last set result: ${normalizeRuntimeLanguage(input.contextResult.message)}${
      input.contextResult.remediation
        ? ` Remediation: ${normalizeRuntimeLanguage(input.contextResult.remediation)}`
        : ""
    }`;
  }
  return "No recent set or workspace changes are recorded in this session.";
}

export function overviewLastResultMessage(lastResult: {
  message: string;
  remediation?: string;
}) {
  return `Last result: ${lastResult.message}${
    lastResult.remediation ? ` Remediation: ${lastResult.remediation}` : ""
  }`;
}

export function overviewTokenWarning(status: ToolStatus) {
  const warning = status.token_warning;
  if (!warning) {
    return "Token state needs attention.";
  }

  const detail = warning.summary ?? warning.message ?? warning.code ?? "Token state needs attention.";
  const suffix = warning.expires_at
    ? ` Expires at ${warning.expires_at}.`
    : typeof warning.expires_in_days === "number"
      ? ` Expires in ${warning.expires_in_days} days.`
      : "";
  return `Token warning: ${detail}${suffix}`;
}

export function overviewDiagnosticWarning(warning: ToolStatus["warnings"][number]) {
  const detail = warning.message ?? warning.code ?? "Warning reported by the runtime.";
  return warning.remediation
    ? `Warning: ${detail} Remediation: ${warning.remediation}`
    : `Warning: ${detail}`;
}

export function overviewAuthMethodLabel(authMethod: string | null | undefined) {
  return authMethodLabel(authMethod, AUTH_METHOD_NOT_CONFIGURED_LABEL);
}

export function overviewInspectorActionDisabled(
  actionKind: OverviewInspectorActionKind,
  mutationLocked: boolean,
  refreshLocked: boolean,
) {
  if (actionKind === "open_profile") {
    return false;
  }
  if (actionKind === "refresh") {
    return refreshLocked;
  }
  return mutationLocked;
}

export function buildOverviewInspectorPresentation(input: {
  profiles: AppSnapshot["profiles"][string]["profiles"];
  selectedProfile: string;
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  stateModes: string[];
  status: ToolStatus;
  supportsLiveImport: boolean;
  workspaceMismatchCanResolveDirectly: boolean;
  workspaceMismatchPresent: boolean;
}): OverviewInspectorPresentation {
  const {
    profiles,
    selectedProfile,
    settings,
    snapshot,
    stateModes,
    status,
    supportsLiveImport,
    workspaceMismatchCanResolveDirectly,
    workspaceMismatchPresent,
  } = input;
  const activeProfileLabel = status.active_profile
    ? toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile)
    : null;
  const selectedProfileLabel = selectedProfile
    ? toolProfileDisplayLabel(settings, snapshot, status.tool, selectedProfile)
    : null;
  const hasProfiles = profiles.length > 0;
  const state = resolveOverviewHealthState(status);
  const statusLabel = overviewHealthLabel(state);
  const healthText = overviewHealthText(status, state);
  const hasAlternateSelection = Boolean(selectedProfile && selectedProfile !== status.active_profile);
  const canSwitch = Boolean(hasAlternateSelection && selectedProfile);
  const canReapplyActiveProfile = Boolean(status.active_profile && status.active_profile_applied === false);
  const currentSelectionLabel = selectedProfileLabel ?? activeProfileLabel ?? "profile";

  const primaryAction: OverviewInspectorAction | null = !hasProfiles
    ? null
    : canReapplyActiveProfile
      ? {
          kind: "reapply",
          label: `Re-apply ${currentSelectionLabel}`,
          ariaLabel: `Re-apply ${currentSelectionLabel}`,
        }
      : canSwitch
        ? {
            kind: "switch",
            label: "Switch",
            ariaLabel: `Switch to ${currentSelectionLabel}`,
          }
        : null;
  const secondaryAction: OverviewInspectorAction | null = !hasProfiles
    ? null
    : canReapplyActiveProfile
      ? supportsLiveImport
        ? {
            kind: "import_current",
            label: "Import Current…",
          }
        : {
            kind: "open_account_setup",
            label: "Open Account Setup",
          }
      : status.active_profile
        ? {
            kind: "open_profile",
            label: "Open Profile",
          }
        : workspaceMismatchPresent
          ? {
              kind: "resolve_workspace",
              label: overviewWorkspaceActionLabel(workspaceMismatchCanResolveDirectly),
            }
          : null;

  const menuActions = [
    canReapplyActiveProfile
      ? {
          kind: "reapply",
          label: `Re-apply ${activeProfileLabel ?? status.active_profile}`,
        }
      : null,
    status.active_profile
      ? {
          kind: "open_profile",
          label: "Open Profile",
        }
      : null,
    supportsLiveImport
      ? {
          kind: "import_current",
          label: "Import Current…",
        }
      : null,
    workspaceMismatchPresent
      ? {
          kind: "resolve_workspace",
          label: overviewWorkspaceActionLabel(workspaceMismatchCanResolveDirectly),
        }
      : null,
    !status.binary_found
      ? {
          kind: "refresh",
          label: "Refresh",
        }
      : null,
  ].filter((action): action is OverviewInspectorAction => Boolean(action));

  return {
    activeProfileLabel,
    currentSelectionLabel,
    hasProfiles,
    healthText,
    menuActions,
    primaryAction,
    secondaryAction,
    selectedProfileLabel,
    showActionArea: hasProfiles || !status.binary_found,
    showActionsMenu: menuActions.length > 0,
    state,
    statusLabel,
    summaryLabel: activeProfileLabel ? `Active profile: ${activeProfileLabel}` : toolInspectorEmptyLabel(status),
  };
}
