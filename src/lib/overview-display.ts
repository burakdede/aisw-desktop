import { AUTH_METHOD_NOT_CONFIGURED_LABEL, authMethodLabel } from "./auth-method-display";
import { DESKTOP_ACTION_COPY } from "./desktop-action-copy";
import { BACK_LABEL, inspectItemLabel, noSelectionHeading } from "./display-copy";
import type {
  CommandResultStatus,
  CommandResultSummary,
} from "../features/shared/command-result-shape";
import { normalizeRuntimeLanguage } from "../features/shared/runtime-language";
import {
  fixedStateModeDescription,
  resolvePreferredEditableStateMode,
  stateModeDescription,
  stateModeLabel,
  type EditableStateMode,
  type StateModeRequest,
} from "../features/shared/state-modes";
import {
  buildOverviewToolHealthPresentation,
  toolInspectorEmptyLabel,
  resolveOverviewHealthState,
  type OverviewHealthState,
} from "./status-display";
import { toolProfileDisplayLabel } from "./profile-display";
import { formatMessageWithRemediation } from "./remediation-text";
import {
  CHOOSE_SET_LABEL,
  CURRENT_SET_LABEL,
  OPEN_SETS_LABEL,
  noRecentSetWorkspaceChangesMessage,
  projectResultSummary,
  setResultSummary,
  workspaceSetActionLabel,
} from "./sets-display";
import type { AppSnapshot, DesktopSettings, ToolStatus } from "./schemas";
import {
  formatTokenWarning,
  formatToolWarning,
  RUNTIME_WARNING_FALLBACK_DETAIL,
} from "./tool-warning-display";
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

export type OverviewInspectorNotice = {
  detail?: string;
  symbol: "▲" | "●";
  tone: "warn" | "ok";
  summary: string;
};

export type OverviewLastResult = {
  label: string;
  status: CommandResultStatus;
  message: string;
  remediation?: string;
};

type OverviewHealthStateCounts = Record<OverviewHealthState, number>;

export type OverviewStateSummary = {
  counts: OverviewHealthStateCounts;
  headline: string;
  metaLabel: string;
  overallState: OverviewHealthState;
};

export const OVERVIEW_CURRENT_SET_LABEL = CURRENT_SET_LABEL;
export const OVERVIEW_EMPTY_SELECTION_COPY =
  "Choose a tool to inspect its active profile and switching state.";
export const OVERVIEW_NO_TOOL_SELECTED_HEADING = noSelectionHeading("tool");
export const OVERVIEW_MORE_ACTIONS_LABEL = "More profile actions";
export const OVERVIEW_PANEL_COPY = {
  currentSetFallback: "None",
  selectedToolFallback: "Tool",
  toolsHeading: "Tools",
  toolsAriaLabel: "Tools",
  noToolsHeading: "No tools detected",
  noToolsBody: "Install or configure a supported tool before switching can begin.",
  footerActionLabel: "View Activity",
  backLabel: BACK_LABEL,
  liveMismatchFallbackProfileLabel: "the saved profile",
  missingBinaryActionLabel: "Installation Help",
  missingBinaryRefreshLabel: DESKTOP_ACTION_COPY.refreshLabel,
  noProfileHeading: "No profile configured",
  noProfileBody: "Add a saved profile before switching this tool from Overview.",
  addProfileLabel: DESKTOP_ACTION_COPY.addProfileEllipsisLabel,
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

const OVERVIEW_STATE_META_LABELS = {
  blocked: "Fix blocked tools first",
  needsAttention: "Review mismatches before coding",
  notVerified: "Verification pending",
  ready: "Ready to switch",
  notConfigured: "No profiles configured",
} as const;

const OVERVIEW_STATE_HEADLINE_COPY = {
  blockedSuffix: "blocked",
  noToolsConfigured: "No tools configured yet",
  notVerifiedTail: "verification",
  readySuffix: "ready",
  reviewReadiness: "Review tool readiness",
} as const;

export function overviewToolCountLabel(total: number) {
  return `${total} total`;
}

export function overviewToolInspectorLabel(tool: string) {
  return inspectItemLabel(toolShortName(tool));
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
  stateModes: EditableStateMode[],
) {
  return resolvePreferredEditableStateMode(stateModes, currentMode) ?? currentMode;
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
  return buildOverviewStateSummary(states).overallState;
}

export function overviewHeadline(states: OverviewHealthState[]) {
  return buildOverviewStateSummary(states).headline;
}

export function overviewMetaLabel(states: OverviewHealthState[]) {
  return buildOverviewStateSummary(states).metaLabel;
}

export function overviewWorkspaceActionLabel(canResolveDirectly: boolean) {
  return workspaceSetActionLabel(canResolveDirectly);
}

export function overviewSetButtonLabel(hasCurrentSet: boolean) {
  return hasCurrentSet ? OPEN_SETS_LABEL : CHOOSE_SET_LABEL;
}

export function overviewInspectorEmptyHeading(
  compactLayout: boolean,
  selectedToolName: string,
) {
  return compactLayout ? selectedToolName : OVERVIEW_NO_TOOL_SELECTED_HEADING;
}

export function overviewStateModeCopy(
  options: EditableStateMode[],
  selected: string,
  tool: string,
) {
  if (!options.length) {
    return fixedStateModeDescription(tool);
  }
  const effective = resolvePreferredEditableStateMode(options, selected) ?? selected;
  return stateModeDescription(effective);
}

export function overviewSelectedStateMode(
  options: EditableStateMode[],
  selected: string,
): StateModeRequest {
  return resolvePreferredEditableStateMode(options, selected);
}

export function overviewRecentSummary(input: {
  bulkResult?: CommandResultSummary;
  workspaceResult?: CommandResultSummary;
  contextResult?: CommandResultSummary;
}) {
  if (input.bulkResult) {
    return setResultSummary(input.bulkResult);
  }
  if (input.workspaceResult) {
    return projectResultSummary(input.workspaceResult);
  }
  if (input.contextResult) {
    return setResultSummary(input.contextResult, true);
  }
  return noRecentSetWorkspaceChangesMessage();
}

export function overviewLastResultMessage(lastResult: {
  message: string;
  remediation?: string;
}) {
  return formatMessageWithRemediation(
    `Last result: ${lastResult.message}`,
    lastResult.remediation,
  );
}

export function overviewTokenWarning(status: ToolStatus) {
  return formatTokenWarning(status.token_warning, { prefix: "Token warning: " });
}

export function overviewDiagnosticWarning(warning: ToolStatus["warnings"][number]) {
  return formatToolWarning(warning, {
    prefix: "Warning: ",
    fallbackDetail: RUNTIME_WARNING_FALLBACK_DETAIL,
  });
}

export function buildOverviewInspectorNotices(input: {
  activeProfileLabel: string | null;
  hasProfiles: boolean;
  lastResult?: OverviewLastResult;
  status: ToolStatus;
  toolName: string;
}): OverviewInspectorNotice[] {
  const notices: OverviewInspectorNotice[] = [];

  if (input.status.active_profile_applied === false) {
    const mismatchNotice = overviewLiveMismatchNotice(input.toolName, input.activeProfileLabel);
    notices.push({
      tone: "warn",
      symbol: "▲",
      summary: mismatchNotice.summary,
      detail: mismatchNotice.detail,
    });
  }

  if (!input.hasProfiles) {
    return notices;
  }

  if (input.status.token_warning) {
    notices.push({
      tone: "warn",
      symbol: "▲",
      summary: overviewTokenWarning(input.status),
    });
  }

  if (input.status.warnings.length) {
    notices.push({
      tone: "warn",
      symbol: "▲",
      summary: overviewDiagnosticWarning(input.status.warnings[0]),
    });
  }

  if (input.lastResult) {
    notices.push({
      tone: input.lastResult.status === "error" ? "warn" : "ok",
      symbol: input.lastResult.status === "error" ? "▲" : "●",
      summary: overviewLastResultMessage(input.lastResult),
    });
  }

  return notices;
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

export function buildOverviewStateSummary(
  states: OverviewHealthState[],
): OverviewStateSummary {
  const counts = countOverviewHealthStates(states);

  return {
    counts,
    headline: buildOverviewHeadline(counts, states.length),
    metaLabel: buildOverviewMetaLabel(counts),
    overallState: resolveOverallStateFromCounts(counts, states.length),
  };
}

function countOverviewHealthStates(states: OverviewHealthState[]): OverviewHealthStateCounts {
  const counts: OverviewHealthStateCounts = {
    ready: 0,
    needs_attention: 0,
    blocked: 0,
    not_configured: 0,
    not_verified: 0,
  };

  for (const state of states) {
    counts[state] += 1;
  }

  return counts;
}

function resolveOverallStateFromCounts(
  counts: OverviewHealthStateCounts,
  total: number,
): OverviewHealthState {
  if (counts.blocked) {
    return "blocked";
  }
  if (counts.needs_attention) {
    return "needs_attention";
  }
  if (!total || counts.ready === 0) {
    return "not_configured";
  }
  if (counts.ready === total) {
    return "ready";
  }
  if (counts.not_configured === total) {
    return "not_configured";
  }
  return "not_verified";
}

function buildOverviewHeadline(
  counts: OverviewHealthStateCounts,
  total: number,
) {
  if (counts.blocked) {
    return `${countLabel(counts.blocked, "tool")} ${OVERVIEW_STATE_HEADLINE_COPY.blockedSuffix}`;
  }
  if (counts.needs_attention) {
    return `${countLabel(counts.needs_attention, "tool")} ${pluralChoice(counts.needs_attention, "needs", "need")} attention`;
  }
  if (counts.not_configured === total) {
    return OVERVIEW_STATE_HEADLINE_COPY.noToolsConfigured;
  }
  if (counts.not_verified) {
    return `${countLabel(counts.not_verified, "tool")} ${pluralChoice(counts.not_verified, "still needs", "still need")} ${OVERVIEW_STATE_HEADLINE_COPY.notVerifiedTail}`;
  }
  if (counts.ready) {
    return `${countLabel(counts.ready, "tool")} ${OVERVIEW_STATE_HEADLINE_COPY.readySuffix}`;
  }
  return OVERVIEW_STATE_HEADLINE_COPY.reviewReadiness;
}

function buildOverviewMetaLabel(counts: OverviewHealthStateCounts) {
  if (counts.blocked) {
    return OVERVIEW_STATE_META_LABELS.blocked;
  }
  if (counts.needs_attention) {
    return OVERVIEW_STATE_META_LABELS.needsAttention;
  }
  if (counts.not_verified) {
    return OVERVIEW_STATE_META_LABELS.notVerified;
  }
  if (counts.ready) {
    return OVERVIEW_STATE_META_LABELS.ready;
  }
  return OVERVIEW_STATE_META_LABELS.notConfigured;
}

export function buildOverviewInspectorPresentation(input: {
  profiles: AppSnapshot["profiles"][string]["profiles"];
  selectedProfile: string;
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  stateModes: EditableStateMode[];
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
  const healthPresentation = buildOverviewToolHealthPresentation(status);
  const state = healthPresentation.state;
  const statusLabel = healthPresentation.label;
  const healthText = healthPresentation.text;
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
          label: DESKTOP_ACTION_COPY.importCurrentEllipsisLabel,
        }
      : {
          kind: "open_account_setup",
          label: DESKTOP_ACTION_COPY.openAccountSetupLabel,
        }
      : status.active_profile
        ? {
            kind: "open_profile",
            label: DESKTOP_ACTION_COPY.openProfileLabel,
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
          label: DESKTOP_ACTION_COPY.openProfileLabel,
        }
      : null,
    supportsLiveImport
      ? {
          kind: "import_current",
          label: DESKTOP_ACTION_COPY.importCurrentEllipsisLabel,
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
          label: DESKTOP_ACTION_COPY.refreshLabel,
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
