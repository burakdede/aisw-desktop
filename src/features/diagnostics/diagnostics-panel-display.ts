import type {
  AppBootstrap,
  AppSnapshot,
  DesktopSettings,
  DoctorReport,
  RepairReport,
  ToolStatus,
} from "../../lib/schemas";
import { DESKTOP_ACTION_COPY } from "../../lib/desktop-action-copy";
import {
  clipboardCopiedMessage,
  clipboardUnavailableManualMessage,
  inspectItemLabel,
} from "../../lib/display-copy";
import {
  asArray,
  asObject,
  asOptionalString,
  type UnknownRecord,
} from "../../lib/parse-guards";
import { contextDisplayLabel, toolProfileDisplayLabel } from "../../lib/profile-display";
import { isSupportedTool } from "../../lib/tool-registry";
import {
  countLabel,
  pluralChoice,
  resolveSelectionValue,
  titleCase,
} from "../../lib/utils";
import {
  BLOCKED_LABEL,
  NEEDS_ATTENTION_LABEL,
  NEEDS_ATTENTION_SENTENCE_LABEL,
} from "../../lib/status-copy";
import type { AttentionCheckStatus } from "../../lib/check-status";
import {
  doctorCheckHasKeyword,
  doctorCheckNameHasAll,
  parseDoctorChecks,
} from "./diagnostic-doctor-checks";
import {
  buildDiagnosticsStatusMessage,
  buildDiagnosticsSummary,
  formatRelativeVerifiedTime,
} from "./diagnostic-status-display";
import {
  DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE,
  DIAGNOSTICS_HEALTHY_COMPACT_DETAIL,
  DIAGNOSTICS_HEALTHY_PRIMARY_DETAIL,
  DIAGNOSTICS_HEALTHY_TITLE,
  DIAGNOSTICS_NO_SAFE_REPAIRS_QUEUED_TITLE,
  DIAGNOSTICS_REFRESH_DIAGNOSTICS_LABEL,
  DIAGNOSTICS_REPAIR_PLAN_LABEL,
  DIAGNOSTICS_REVIEW_SAFE_FIXES_ELLIPSIS_LABEL,
  DIAGNOSTICS_REVIEW_SAFE_FIXES_LABEL,
} from "./diagnostics-copy";
export {
  buildDiagnosticsStatusMessage,
  buildDiagnosticsSummary,
  formatRelativeVerifiedTime,
} from "./diagnostic-status-display";
import {
  diagnosticTitleHas,
  diagnosticTitleHasAny,
  normalizeDiagnosticTitle,
} from "./diagnostic-title-match";
import { toolSupportsEditableStateModes } from "../../lib/tool-registry";
import type { LastCommandResult } from "../shared/lastCommandResult";
import { COMMAND_RESULT_GLOBAL_IDS } from "../shared/command-result-scope";
import {
  COMMAND_RESULT_SCOPE_TYPES,
  type CommandResultScopeType,
} from "../shared/command-result-scope";
import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import {
  DEFAULT_PROFILE_IMPORT_MODE,
  preferredProfileImportMode,
  type ExplicitProfileCredentialBackend,
  type ProfileImportMode,
} from "../shared/profile-capabilities";
import {
  EDITABLE_STATE_MODES,
  DEFAULT_EDITABLE_STATE_MODE,
  type StateModeRequest,
  type ToolStateModeTarget,
} from "../shared/state-modes";
import type { IssueCardData } from "./diagnostic-parsers";
import { diagnosticFindingTitle } from "../../lib/diagnostic-display";
import { parseWorkspaceStatus } from "../workspaces/workspace-parsers";
import {
  resolveWorkspaceActivationTarget,
  type WorkspaceActivationTarget,
} from "../workspaces/workspace-activation";
import type { SettingsSection } from "../../lib/settings-sections";
import {
  OPEN_SETS_LABEL,
  USE_EXPECTED_SET_NOW_LABEL,
} from "../../lib/sets-display";

export type DiagnosticQuickFixInput = {
  title: string;
  detail: string;
  label: string;
  status: AttentionCheckStatus;
  profileTarget?: { tool: string; profile: string | null };
};

export type DiagnosticInspectorQuickFix = Pick<
  DiagnosticQuickFixInput,
  "title" | "label"
> & {
  importTarget?: ToolStateModeTarget;
  importFallbackMode?: ProfileImportMode;
  secondaryAction?: {
    label: string;
  };
};

export type DiagnosticFinding = {
  key: string;
  title: string;
  preview: string;
  lines: string[];
  remediation: string[];
  status: AttentionCheckStatus;
  scopeLabel: string;
  countLabel: string;
  profileTarget?: { tool: string; profile: string | null };
};

export type RecentFailureCard = {
  key: string;
  title: string;
  message: string;
  kind?: string;
  remediation?: string;
  at: number;
  profileTarget?: { tool: string; profile: string | null };
};

type DiagnosticFindingGroup = {
  id: keyof typeof DIAGNOSTIC_FINDING_GROUP_LABELS;
  label: (typeof DIAGNOSTIC_FINDING_GROUP_LABELS)[keyof typeof DIAGNOSTIC_FINDING_GROUP_LABELS];
  items: DiagnosticFinding[];
};

export type DiagnosticInspectorAction = {
  key: string;
  kind:
    | "quick_fix"
    | "quick_fix_secondary"
    | "import_current"
    | "open_profile_details";
  label: string;
  quickFixKey?: string;
  importTarget?: ToolStateModeTarget;
  importFallbackMode?: ProfileImportMode;
  profileTarget?: { tool: string; profile: string | null };
};

export type DiagnosticQuickFixModel = DiagnosticQuickFixInput & {
  kind:
    | "repair_doctor_issue"
    | "open_settings"
    | "open_profile_setup"
    | "open_installation_guide"
    | "reapply_profile"
    | "resolve_workspace";
  repairFix?: string;
  settingsSection?: SettingsSection;
  setupMode?: ProfileImportMode;
  credentialBackend?: ExplicitProfileCredentialBackend | null;
  toolTarget?: string;
  importTarget?: ToolStateModeTarget;
  importFallbackMode?: ProfileImportMode;
  workspaceActivationTarget?: WorkspaceActivationTarget | null;
  matchedWorkspaceTarget?: string;
  secondaryAction?: {
    kind: "refresh_diagnostics";
    label: string;
  };
  primary?: boolean;
};

type DiagnosticStatusPresentation = {
  label: string;
  symbol: "▲" | "⨯";
};

type DiagnosticRepairAction = {
  title: string;
  detail: string;
  fix?: string;
};

type ParsedDoctorCheck = ReturnType<typeof parseDoctorChecks>[number];

type DoctorRepairDefinition = {
  keyword: string;
  title: string;
  label: string;
  repairKey: string;
  primary?: boolean;
};

type DiagnosticBundleResult = {
  filename: string;
  path: string;
};

type LastCommandResultsInput = {
  tool: Record<string, LastCommandResult | undefined>;
  global: Record<string, LastCommandResult | undefined>;
};

export const DIAGNOSTICS_PANEL_COPY = {
  verifyButtonLabel: DESKTOP_ACTION_COPY.verifyLabel,
  inspectorBackLabel: "Back",
  verifyAgainAriaLabel: "Verify Again",
  reviewSafeFixesAriaLabel: DIAGNOSTICS_REVIEW_SAFE_FIXES_LABEL,
  applySafeFixesAriaLabel: "Apply Safe Fixes",
  reviewSafeFixesButtonLabel: DIAGNOSTICS_REVIEW_SAFE_FIXES_ELLIPSIS_LABEL,
  applyingRepairsLabel: "Applying Repairs…",
  diagnosticsActionsAriaLabel: "Diagnostics actions",
  diagnosticsActionsTriggerAriaLabel: "Diagnostics more actions",
  exportReportLabel: "Export Report",
  exportingReportLabel: "Exporting Report…",
  findingsAriaLabel: "Diagnostics findings",
  inspectorOverflowTriggerAriaLabel: "More finding actions",
  inspectorOverflowMenuAriaLabel: "Finding actions",
  healthyTitle: DIAGNOSTICS_HEALTHY_TITLE,
  healthyPrimaryDetail: DIAGNOSTICS_HEALTHY_PRIMARY_DETAIL,
  healthyCompactDetail: DIAGNOSTICS_HEALTHY_COMPACT_DETAIL,
  verifiedPrefix: "Verified",
  inspectorWhatHappenedKicker: "What happened",
  inspectorImpactKicker: "Impact",
  inspectorRecommendedActionKicker: "Recommended action",
  inspectorRecommendedActionFallback:
    "Review the evidence below and decide how you want to correct this state.",
  evidenceSummary: "Evidence",
  technicalDetailsSummary: "Technical Details",
  technicalDetailsIntro: "Suggested commands for validation and recovery.",
  technicalDetailsFallbackCommand: "# Review the explicit action above",
  repairPlanDialogAriaLabel: DIAGNOSTICS_REVIEW_SAFE_FIXES_LABEL,
  repairPlanKicker: DIAGNOSTICS_REPAIR_PLAN_LABEL,
  repairPlanTitle: DIAGNOSTICS_REVIEW_SAFE_FIXES_LABEL,
  repairPlanCloseLabel: "Close",
  repairPlanEmptyTitle: DIAGNOSTICS_NO_SAFE_REPAIRS_QUEUED_TITLE,
  repairPlanEmptyDetail:
    "Diagnostics did not find any safe automatic repairs to apply right now.",
  repairPlanSelectionKicker: "Repairs",
  repairPlanSelectionDetail:
    "Profile re-apply, restore, and removal actions still require their own explicit flow.",
  repairPlanCancelLabel: "Cancel",
  copyReportPathLabel: "Copy report path",
  passedChecksSuffix: "checks passed",
  exportReportFailedMessage: DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE,
} as const;

const RECENT_FAILURE_TITLES = {
  permissionDenied: "Permission issue",
  oauthTimeout: "OAuth timeout",
  configLockTimeout: "Config lock timeout",
  nonInteractiveMode: "Non-interactive mode failure",
  geminiInvalidStateMode: "Gemini shared-mode failure",
  invalidStateMode: "Unsupported state mode",
  backupNeedsAttention: "Backup restore needs attention",
} as const;

const DIAGNOSTIC_STATUS_PRESENTATION: Record<
  AttentionCheckStatus,
  DiagnosticStatusPresentation
> = {
  fail: {
    label: BLOCKED_LABEL,
    symbol: "⨯",
  },
  warn: {
    label: NEEDS_ATTENTION_SENTENCE_LABEL,
    symbol: "▲",
  },
};

const DIAGNOSTIC_QUICK_FIX_COPY = {
  defaultDoctorDetail: "AI Switch reported an issue.",
  shellHookDefaultDetail: "Terminal integration guidance needs attention.",
  keyringDefaultDetail: "Keyring access needs attention.",
  terminalIntegrationTitle: "Terminal integration not active",
  fileBackedStorageTitle: "Use file-backed storage",
  fileBackedStorageDetail:
    "Open account setup with file-backed credential storage preselected for the next import or add flow.",
  fileBackedStorageLabel: "Use file-backed storage",
  keyringSetupTitle: "Keyring setup instructions",
  keyringSetupDetail:
    "Review the supported local keyring services for macOS, Windows, and Linux.",
  keyringSetupLabel: "Show keyring setup",
  installationGuideLabel: "Open installation guide",
  projectSetMismatchTitle: "Project set mismatch",
} as const;

const DOCTOR_REPAIR_DEFINITIONS = [
  {
    keyword: "keyring",
    title: "Keyring unavailable",
    label: "Apply keyring repair",
    repairKey: "keyring",
  },
  {
    keyword: "permission",
    title: "Permission issue",
    label: "Repair permissions",
    repairKey: "permissions",
  },
  {
    keyword: "oauth",
    title: "OAuth failure",
    label: "Retry OAuth repair",
    repairKey: "oauth",
  },
] as const satisfies readonly DoctorRepairDefinition[];

const SHELL_HOOK_KEYWORDS = [
  "shell hook",
  "terminal integration",
] as const;

const DIAGNOSTIC_IMPACT_RULES = [
  {
    key: "liveMismatch",
    detail:
      "Switching is no longer guaranteed to match the saved profile, so you may start coding with the wrong account identity.",
  },
  {
    key: "keyring",
    detail:
      "Stored credentials may not be readable or writable until local credential storage is repaired.",
  },
  {
    key: "permission",
    detail:
      "AI Switch may fail to update local state, backups, or profile changes until local file permissions are corrected.",
  },
  {
    key: "shell",
    detail:
      "Shell commands can drift from the desktop state until terminal integration is installed or refreshed.",
  },
  {
    key: "missing",
    detail:
      "This tool cannot be switched or verified from the desktop app until its CLI is installed.",
  },
  {
    key: "project",
    detail:
      "Project rules are no longer protecting the active workspace from using the wrong saved set.",
  },
] as const;

const DEFAULT_DIAGNOSTIC_IMPACT_DETAIL =
  "This state needs review before you rely on the current desktop switching state.";

const DIAGNOSTIC_FINDING_GROUP_LABELS = {
  blocked: BLOCKED_LABEL,
  "needs-attention": NEEDS_ATTENTION_LABEL,
  suggestions: "Suggestions",
} as const;

export function buildDiagnosticFindings(
  issueCards: IssueCardData[],
  recentFailures: RecentFailureCard[],
  quickFixes: DiagnosticQuickFixInput[],
  snapshot: AppSnapshot | undefined,
) {
  const findings: DiagnosticFinding[] = issueCards.map((card) => ({
    key: `issue-${card.title}-${card.status}`,
    title: diagnosticFindingTitle(card, snapshot),
    preview: normalizeRuntimeLanguage(card.issues[0] ?? "Review diagnostic details."),
    lines: card.issues,
    remediation: card.remediation,
    status: card.status,
    scopeLabel: "Check",
    countLabel: countLabel(card.issues.length, "detail"),
    profileTarget: snapshot ? resolveIssueProfileTarget(card.title, snapshot) ?? undefined : undefined,
  }));

  recentFailures.forEach((failure) => {
    findings.push({
      key: `failure-${failure.key}`,
      title: failure.title,
      preview: normalizeRuntimeLanguage(failure.message),
      lines: [failure.message],
      remediation: failure.remediation ? [failure.remediation] : [],
      status: "fail",
      scopeLabel: "Recent failure",
      countLabel: "History",
      profileTarget: failure.profileTarget,
    });
  });

  quickFixes.forEach((fix) => {
    const duplicate = findings.some((finding) => matchesQuickFixToFinding(fix, finding));
    if (duplicate) {
      return;
    }

    findings.push({
      key: `quick-fix-${diagnosticQuickFixKey(fix)}`,
      title: fix.title,
      preview: normalizeRuntimeLanguage(fix.detail),
      lines: [normalizeRuntimeLanguage(fix.detail)],
      remediation: [fix.label],
      status: fix.status,
      scopeLabel: "Suggested fix",
      countLabel: "Action",
      profileTarget: fix.profileTarget,
    });
  });

  return findings;
}

export function resolveSelectedFindingKey(
  currentFindingKey: string | null,
  findings: DiagnosticFinding[],
) {
  return resolveSelectionValue(currentFindingKey, findings, (finding) => finding.key);
}

export function buildRecentFailureCards(
  lastCommandResults: LastCommandResultsInput,
  snapshot: AppSnapshot | undefined,
) {
  const failures: RecentFailureCard[] = [];

  for (const [tool, result] of Object.entries(lastCommandResults.tool)) {
    if (!result || result.status !== "error") {
      continue;
    }
    const activeProfile =
      snapshot?.statuses.find((entry) => entry.tool === tool)?.active_profile ??
      snapshot?.profiles[tool]?.active ??
      null;
    failures.push({
      key: `tool:${tool}`,
      title: recentFailureTitle({
        kind: result.kind,
        scope: COMMAND_RESULT_SCOPE_TYPES.tool,
        tool,
        label: result.label,
      }),
      message: result.message,
      kind: result.kind,
      remediation: result.remediation,
      at: result.at,
      profileTarget: { tool, profile: activeProfile },
    });
  }

  for (const [id, result] of Object.entries(lastCommandResults.global)) {
    if (!result || result.status !== "error") {
      continue;
    }
    failures.push({
      key: `global:${id}`,
      title: recentFailureTitle({
        kind: result.kind,
        scope: COMMAND_RESULT_SCOPE_TYPES.global,
        id,
        label: result.label,
      }),
      message: result.message,
      kind: result.kind,
      remediation: result.remediation,
      at: result.at,
    });
  }

  return failures.sort((left, right) => right.at - left.at);
}

export function recentFailureTitle(input: {
  kind?: string;
  scope: CommandResultScopeType;
  tool?: string;
  id?: string;
  label: string;
}) {
  switch (input.kind) {
    case "ToolMissing":
      return `${titleCase(input.tool ?? "Tool")} CLI missing`;
    case "ProfileMissing":
      return `${titleCase(input.tool ?? "Profile")} profile missing`;
    case "KeyringUnavailable":
      return `${titleCase(input.tool ?? "Credential")} keyring unavailable`;
    case "PermissionDenied":
      return RECENT_FAILURE_TITLES.permissionDenied;
    case "OAuthTimeout":
      return RECENT_FAILURE_TITLES.oauthTimeout;
    case "ConfigLockTimeout":
      return RECENT_FAILURE_TITLES.configLockTimeout;
    case "NonInteractiveMode":
      return RECENT_FAILURE_TITLES.nonInteractiveMode;
    case "InvalidStateMode":
      return input.tool === "gemini"
        ? RECENT_FAILURE_TITLES.geminiInvalidStateMode
        : RECENT_FAILURE_TITLES.invalidStateMode;
    default:
      if (
        input.scope === COMMAND_RESULT_SCOPE_TYPES.global &&
        input.id === COMMAND_RESULT_GLOBAL_IDS.backup
      ) {
        return RECENT_FAILURE_TITLES.backupNeedsAttention;
      }
      return input.tool ? `${titleCase(input.tool)} · ${input.label}` : input.label;
  }
}

export function matchesQuickFixToFinding(
  fix: DiagnosticQuickFixInput,
  finding: DiagnosticFinding | null,
) {
  if (!finding) {
    return false;
  }
  const findingTitle = normalizeDiagnosticTitle(finding.title);
  const fixTitle = normalizeDiagnosticTitle(fix.title);

  if (findingTitle === fixTitle) {
    return true;
  }

  if (finding.profileTarget?.tool && fix.profileTarget?.tool === finding.profileTarget.tool) {
    if (diagnosticTitleHas(findingTitle, "liveMismatch") && diagnosticTitleHas(fixTitle, "liveMismatch")) {
      return true;
    }
    if (diagnosticTitleHas(findingTitle, "profileMissing") && fixTitle.includes(finding.profileTarget.tool)) {
      return true;
    }
  }

  if (diagnosticTitleHas(findingTitle, "permission") && diagnosticTitleHas(fixTitle, "permission")) {
    return true;
  }
  if (
    diagnosticTitleHas(findingTitle, "keyring") &&
    (diagnosticTitleHas(fixTitle, "keyring") || fixTitle.includes("file-backed storage"))
  ) {
    return true;
  }
  if (diagnosticTitleHas(findingTitle, "oauth") && diagnosticTitleHas(fixTitle, "oauth")) {
    return true;
  }
  if (diagnosticTitleHas(findingTitle, "shell") && fixTitle.includes("terminal integration")) {
    return true;
  }
  if (diagnosticTitleHas(findingTitle, "project") && diagnosticTitleHas(fixTitle, "project")) {
    return true;
  }
  if (diagnosticTitleHas(findingTitle, "missing") && diagnosticTitleHas(fixTitle, "missing")) {
    return true;
  }

  return false;
}

export function groupDiagnosticFindings(findings: DiagnosticFinding[]) {
  const groups: DiagnosticFindingGroup[] = [
    {
      id: "blocked",
      label: DIAGNOSTIC_FINDING_GROUP_LABELS.blocked,
      items: [],
    },
    {
      id: "needs-attention",
      label: DIAGNOSTIC_FINDING_GROUP_LABELS["needs-attention"],
      items: [],
    },
    {
      id: "suggestions",
      label: DIAGNOSTIC_FINDING_GROUP_LABELS.suggestions,
      items: [],
    },
  ];

  findings.forEach((finding) => {
    if (finding.status === "fail") {
      groups[0].items.push(finding);
      return;
    }
    if (diagnosticTitleHasAny(finding.title, ["missing", "shell", "setup"])) {
      groups[2].items.push(finding);
      return;
    }
    groups[1].items.push(finding);
  });

  return groups;
}

export function impactTextForFinding(finding: DiagnosticFinding) {
  for (const rule of DIAGNOSTIC_IMPACT_RULES) {
    if (diagnosticTitleHas(finding.title, rule.key)) {
      return rule.detail;
    }
  }
  return DEFAULT_DIAGNOSTIC_IMPACT_DETAIL;
}

export function diagnosticQuickFixKey(fix: Pick<DiagnosticQuickFixInput, "title" | "label">) {
  return `${fix.title}:${fix.label}`;
}

export function diagnosticRepairActionKey(action: Pick<DiagnosticRepairAction, "title" | "detail">) {
  return `${action.title}:${action.detail}`;
}

export function diagnosticRepairFixFromAction(action: DiagnosticRepairAction) {
  if (action.fix && action.fix.length) {
    return action.fix;
  }

  return action.title.trim().toLowerCase().replace(/\s+/g, "_");
}

export function buildSelectedRepairFixes(
  selectedActionKeys: string[],
  repairActions: DiagnosticRepairAction[],
) {
  return selectedActionKeys
    .map((id) =>
      repairActions.find((action) => diagnosticRepairActionKey(action) === id),
    )
    .filter((action): action is DiagnosticRepairAction => Boolean(action))
    .map((action) => diagnosticRepairFixFromAction(action));
}

export function diagnosticBundlePathCopyMessage(path: string, clipboardAvailable: boolean) {
  if (!clipboardAvailable) {
    return clipboardUnavailableManualMessage("the bundle path", path);
  }

  return clipboardCopiedMessage("bundle path", path);
}

export function diagnosticInspectorStatusLabel(status: DiagnosticFinding["status"]) {
  return diagnosticStatusPresentation(status).label;
}

export function diagnosticStatusPresentation(
  status: DiagnosticFinding["status"],
): DiagnosticStatusPresentation {
  return DIAGNOSTIC_STATUS_PRESENTATION[status];
}

export function diagnosticFindingAriaLabel(
  finding: Pick<DiagnosticFinding, "title">,
) {
  return inspectItemLabel(finding.title);
}

export function diagnosticsPassedChecksSummary(count: number) {
  return `${count} ${DIAGNOSTICS_PANEL_COPY.passedChecksSuffix}`;
}

export function diagnosticTechnicalCommandBlock(primaryLabel?: string | null) {
  const trailingCommand = primaryLabel
    ? `# ${primaryLabel}`
    : DIAGNOSTICS_PANEL_COPY.technicalDetailsFallbackCommand;
  return `aisw doctor --json
aisw verify --json
${trailingCommand}`;
}

export function diagnosticsRepairPlanSummary(count: number) {
  return `${count} ${pluralChoice(count, "repair can", "repairs can")} be applied without changing account identity.`;
}

export function diagnosticsRepairSelectionLabel(count: number) {
  return `${count} selected`;
}

export function diagnosticsApplyRepairsLabel(count: number, isPending: boolean) {
  return isPending
    ? DIAGNOSTICS_PANEL_COPY.applyingRepairsLabel
    : `Apply ${countLabel(count, "Fix", "Fixes")}`;
}

export function buildDiagnosticInspectorActions(input: {
  selectedFinding: Pick<DiagnosticFinding, "key" | "profileTarget"> | null;
  primaryFindingFix: DiagnosticInspectorQuickFix | null;
  secondaryFindingFixes: DiagnosticInspectorQuickFix[];
  importCurrentLabel: string | null;
}) {
  const importCurrentAction = buildImportCurrentAction(
    input.primaryFindingFix,
    input.importCurrentLabel,
  );
  const primarySecondaryAction = buildPrimarySecondaryAction(input.primaryFindingFix);
  const primaryQuickFixAction = buildQuickFixAction(input.secondaryFindingFixes[0]);
  const openProfileDetailsAction = buildOpenProfileDetailsAction(input.selectedFinding);
  const secondaryInspectorAction =
    primarySecondaryAction
    ?? primaryQuickFixAction
    ?? openProfileDetailsAction
    ?? importCurrentAction;
  const overflowActions: DiagnosticInspectorAction[] = [
    ...(importCurrentAction && secondaryInspectorAction?.key !== importCurrentAction.key
      ? [importCurrentAction]
      : []),
    ...(primarySecondaryAction
      && secondaryInspectorAction?.key !== primarySecondaryAction.key
      ? [primarySecondaryAction]
      : []),
    ...input.secondaryFindingFixes
      .slice(secondaryInspectorAction?.kind === "quick_fix" ? 1 : 0)
      .map((fix) => buildQuickFixAction(fix))
      .filter((action): action is DiagnosticInspectorAction => Boolean(action)),
    ...(openProfileDetailsAction
      && secondaryInspectorAction?.key !== openProfileDetailsAction.key
      ? [openProfileDetailsAction]
      : []),
  ];

  return {
    importCurrentAction,
    secondaryInspectorAction,
    overflowActions,
  };
}

export function buildDiagnosticQuickFixModels(input: {
  snapshot: AppSnapshot | undefined;
  doctor: DoctorReport | undefined;
  repair: RepairReport | undefined;
  settings: DesktopSettings;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
}) {
  const { snapshot, doctor, repair, settings, toolCapabilities } = input;
  const fixes: DiagnosticQuickFixModel[] = [];
  const repairFixMap = buildRepairFixMap(repair);

  for (const issue of repairableDoctorIssues(doctor, repairFixMap)) {
    fixes.push({
      kind: "repair_doctor_issue",
      title: issue.title,
      detail: issue.detail,
      label: issue.label,
      status: issue.status,
      repairFix: issue.fix,
      primary: issue.primary,
    });
  }

  const shellHookIssue = shellHookDoctorIssue(doctor);
  if (shellHookIssue) {
    fixes.push(buildShellHookQuickFix(shellHookIssue));
  }

  const keyringIssue = keyringDoctorIssue(doctor);
  if (keyringIssue) {
    fixes.push(...buildKeyringQuickFixes(keyringIssue));
  }

  if (!snapshot) {
    return fixes;
  }

  snapshot.statuses.forEach((status) => {
    if (!status.binary_found) {
      fixes.push(buildMissingToolQuickFix(status.tool));
    }

    if (status.active_profile && status.active_profile_applied === false) {
      fixes.push(
        buildLiveMismatchQuickFix(status, settings, snapshot, toolCapabilities),
      );
    }
  });

  const workspace = parseWorkspaceStatus(snapshot.workspace_status ?? undefined);
  const hasWorkspaceMismatch =
    workspace.status === "mismatch" &&
    workspace.expectedContext !== "none" &&
    workspace.expectedContext !== workspace.currentContext;

  if (hasWorkspaceMismatch) {
    fixes.push(buildWorkspaceMismatchQuickFix(workspace, settings, snapshot));
  }

  return fixes;
}

function buildRepairFixMap(repair: RepairReport | undefined) {
  const result = asObject(repair?.result);
  return asArray(result?.actions)
    .map((action) => asObject(action))
    .filter((action): action is UnknownRecord => Boolean(action))
    .reduce((map, action) => {
      const fix = asOptionalString(action.fix);
      if (fix) {
        map.set(fix.toLowerCase(), fix);
      }
      return map;
    }, new Map<string, string>());
}

function buildShellHookQuickFix(issue: {
  detail: string;
  status: AttentionCheckStatus;
}): DiagnosticQuickFixModel {
  return {
    kind: "open_settings",
    title: DIAGNOSTIC_QUICK_FIX_COPY.terminalIntegrationTitle,
    detail: issue.detail,
    label: DESKTOP_ACTION_COPY.openTerminalSetupLabel,
    status: issue.status,
    settingsSection: "shell",
  };
}

function buildKeyringQuickFixes(issue: {
  status: AttentionCheckStatus;
}): DiagnosticQuickFixModel[] {
  return [
    {
      kind: "open_profile_setup",
      title: DIAGNOSTIC_QUICK_FIX_COPY.fileBackedStorageTitle,
      detail: DIAGNOSTIC_QUICK_FIX_COPY.fileBackedStorageDetail,
      label: DIAGNOSTIC_QUICK_FIX_COPY.fileBackedStorageLabel,
      status: issue.status,
      setupMode: DEFAULT_PROFILE_IMPORT_MODE,
      credentialBackend: "file",
    },
    {
      kind: "open_settings",
      title: DIAGNOSTIC_QUICK_FIX_COPY.keyringSetupTitle,
      detail: DIAGNOSTIC_QUICK_FIX_COPY.keyringSetupDetail,
      label: DIAGNOSTIC_QUICK_FIX_COPY.keyringSetupLabel,
      status: issue.status,
      settingsSection: "keyring",
    },
  ];
}

function buildMissingToolQuickFix(tool: string): DiagnosticQuickFixModel {
  return {
    kind: "open_installation_guide",
    title: `${tool} is missing`,
    detail: `Open the install guide for ${tool} and then refresh diagnostics.`,
    label: DIAGNOSTIC_QUICK_FIX_COPY.installationGuideLabel,
    status: "warn",
    toolTarget: tool,
    secondaryAction: {
      kind: "refresh_diagnostics",
      label: DIAGNOSTICS_REFRESH_DIAGNOSTICS_LABEL,
    },
  };
}

function buildLiveMismatchQuickFix(
  status: ToolStatus,
  settings: DesktopSettings,
  snapshot: AppSnapshot,
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"],
): DiagnosticQuickFixModel {
  const profileLabel = toolProfileDisplayLabel(
    settings,
    snapshot,
    status.tool,
    status.active_profile!,
  );

  return {
    kind: "reapply_profile",
    title: `${status.tool} live mismatch`,
    detail: `Re-apply ${profileLabel} so the live credentials match the saved profile again.`,
    label: `Re-apply ${profileLabel}`,
    status: "fail",
    profileTarget: {
      tool: status.tool,
      profile: status.active_profile!,
    },
    importTarget: {
      tool: status.tool,
      stateMode: resolveStateMode(status),
    },
    importFallbackMode: preferredProfileImportMode(
      status.tool,
      toolCapabilities,
      DEFAULT_PROFILE_IMPORT_MODE,
    ),
    primary: true,
  };
}

function buildWorkspaceMismatchQuickFix(
  workspace: ReturnType<typeof parseWorkspaceStatus>,
  settings: DesktopSettings,
  snapshot: AppSnapshot,
): DiagnosticQuickFixModel {
  const expectedContextLabel = contextDisplayLabel(settings, workspace.expectedContext);
  const currentContextLabel = contextDisplayLabel(settings, workspace.currentContext);
  const target = resolveWorkspaceActivationTarget(
    workspace.expectedContext,
    settings,
    snapshot,
  );

  return {
    kind: "resolve_workspace",
    title: DIAGNOSTIC_QUICK_FIX_COPY.projectSetMismatchTitle,
    detail: target
      ? `This folder wants ${expectedContextLabel}, but ${currentContextLabel} is currently active.`
      : `This folder wants ${expectedContextLabel}, but no matching detected set or ready saved set is currently available.`,
    label: target ? USE_EXPECTED_SET_NOW_LABEL : OPEN_SETS_LABEL,
    status: "warn",
    primary: true,
    workspaceActivationTarget: target,
    matchedWorkspaceTarget: workspace.target,
  };
}

function repairableDoctorIssues(
  doctor: DoctorReport | undefined,
  repairFixMap: Map<string, string>,
): Array<{
  title: string;
  detail: string;
  label: string;
  fix: string;
  status: AttentionCheckStatus;
  primary?: boolean;
}> {
  return parseDoctorChecks(doctor, {
    defaultDetail: DIAGNOSTIC_QUICK_FIX_COPY.defaultDoctorDetail,
  }).flatMap((check) => {
    const repairAction = resolveDoctorRepairAction(check, repairFixMap);
    return repairAction ? [repairAction] : [];
  });
}

function doctorRepairFixCard(
  definition: DoctorRepairDefinition,
  detail: string,
  status: AttentionCheckStatus,
  repairFixMap: Map<string, string>,
) {
  return {
    title: definition.title,
    detail,
    label: definition.label,
    status,
    fix: repairFixMap.get(definition.repairKey) ?? definition.repairKey,
    primary: definition.primary ?? true,
  };
}

function shellHookDoctorIssue(doctor: DoctorReport | undefined) {
  return findDoctorIssue(doctor, {
    defaultDetail: DIAGNOSTIC_QUICK_FIX_COPY.shellHookDefaultDetail,
    detailTransform: normalizeTerminalIntegrationText,
  }, (check) =>
    doctorCheckNameHasAll(check, ["shell", "hook"]) ||
    SHELL_HOOK_KEYWORDS.some((keyword) => doctorCheckHasKeyword(check, keyword)),
  );
}

function keyringDoctorIssue(doctor: DoctorReport | undefined) {
  return findDoctorIssue(
    doctor,
    { defaultDetail: DIAGNOSTIC_QUICK_FIX_COPY.keyringDefaultDetail },
    (check) => doctorCheckHasKeyword(check, "keyring"),
  );
}

function resolveStateMode(status: ToolStatus): StateModeRequest {
  if (!toolSupportsEditableStateModes(status.tool)) {
    return null;
  }
  return status.state_mode &&
    EDITABLE_STATE_MODES.includes(status.state_mode as (typeof EDITABLE_STATE_MODES)[number])
    ? (status.state_mode as (typeof EDITABLE_STATE_MODES)[number])
    : DEFAULT_EDITABLE_STATE_MODE;
}

function resolveIssueProfileTarget(title: string, snapshot: AppSnapshot) {
  const tool = resolveDiagnosticTool(title);
  if (!tool) {
    return null;
  }

  const status = snapshot.statuses.find((entry) => entry.tool === tool);
  const activeProfile = status?.active_profile ?? snapshot.profiles[tool]?.active ?? null;
  return {
    tool,
    profile: activeProfile,
  };
}

function resolveDiagnosticTool(title: string) {
  const normalized = title.trim().toLowerCase();
  const candidate = normalized.startsWith("tool/") ? normalized.slice("tool/".length) : normalized;
  return isSupportedTool(candidate) ? candidate : null;
}

function resolveDoctorRepairAction(
  check: ParsedDoctorCheck,
  repairFixMap: Map<string, string>,
) {
  const definition = DOCTOR_REPAIR_DEFINITIONS.find((entry) =>
    doctorCheckHasKeyword(check, entry.keyword),
  );

  if (!definition) {
    return null;
  }

  return doctorRepairFixCard(definition, check.detail, check.status, repairFixMap);
}

function findDoctorIssue(
  doctor: DoctorReport | undefined,
  options: Parameters<typeof parseDoctorChecks>[1],
  matcher: (check: ParsedDoctorCheck) => boolean,
) {
  const checks = parseDoctorChecks(doctor, options);
  const match = checks.find(matcher);
  return match ? { detail: match.detail, status: match.status } : null;
}

function buildQuickFixAction(
  fix: DiagnosticInspectorQuickFix | null | undefined,
): DiagnosticInspectorAction | null {
  if (!fix) {
    return null;
  }
  return {
    key: `fix-${diagnosticQuickFixKey(fix)}`,
    kind: "quick_fix",
    label: fix.label,
    quickFixKey: diagnosticQuickFixKey(fix),
  };
}

function buildPrimarySecondaryAction(
  fix: DiagnosticInspectorQuickFix | null,
): DiagnosticInspectorAction | null {
  if (!fix?.secondaryAction) {
    return null;
  }
  return {
    key: `secondary-${diagnosticQuickFixKey(fix)}`,
    kind: "quick_fix_secondary",
    label: fix.secondaryAction.label,
    quickFixKey: diagnosticQuickFixKey(fix),
  };
}

function buildImportCurrentAction(
  fix: DiagnosticInspectorQuickFix | null,
  label: string | null,
): DiagnosticInspectorAction | null {
  if (!fix?.importTarget || !label) {
    return null;
  }
  return {
    key: `import-${diagnosticQuickFixKey(fix)}`,
    kind: "import_current",
    label,
    importTarget: fix.importTarget,
    importFallbackMode: fix.importFallbackMode,
  };
}

function buildOpenProfileDetailsAction(
  finding: Pick<DiagnosticFinding, "key" | "profileTarget"> | null,
): DiagnosticInspectorAction | null {
  if (!finding?.profileTarget) {
    return null;
  }
  return {
    key: `profile-${finding.key}`,
    kind: "open_profile_details",
    label: DESKTOP_ACTION_COPY.openProfileDetailsLabel,
    profileTarget: finding.profileTarget,
  };
}
