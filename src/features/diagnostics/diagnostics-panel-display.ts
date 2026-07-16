import type { AppBootstrap, AppSnapshot, DesktopSettings, ToolStatus } from "../../lib/schemas";
import { contextDisplayLabel, toolProfileDisplayLabel } from "../../lib/profile-display";
import { isSupportedTool } from "../../lib/tool-registry";
import { countLabel, titleCase } from "../../lib/utils";
import { BLOCKED_LABEL, NEEDS_ATTENTION_SENTENCE_LABEL } from "../../lib/status-copy";
import { toolSupportsEditableStateModes } from "../../lib/tool-registry";
import type { LastCommandResult } from "../shared/lastCommandResult";
import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import {
  DEFAULT_PROFILE_IMPORT_MODE,
  preferredProfileImportMode,
  type ExplicitProfileCredentialBackend,
  type ProfileImportMode,
} from "../shared/profile-capabilities";
import { DEFAULT_EDITABLE_STATE_MODE } from "../shared/state-modes";
import type { IssueCardData } from "./diagnostic-parsers";
import { diagnosticFindingTitle } from "../../lib/diagnostic-display";
import { parseWorkspaceStatus } from "../workspaces/workspace-parsers";
import {
  resolveWorkspaceActivationTarget,
  type WorkspaceActivationTarget,
} from "../workspaces/workspace-activation";

export type DiagnosticQuickFixInput = {
  title: string;
  detail: string;
  label: string;
  status: "warn" | "fail";
  profileTarget?: { tool: string; profile: string | null };
};

export type DiagnosticInspectorQuickFix = Pick<
  DiagnosticQuickFixInput,
  "title" | "label"
> & {
  importTarget?: { tool: string; stateMode: string | null };
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
  status: "warn" | "fail";
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

export type DiagnosticInspectorAction = {
  key: string;
  kind:
    | "quick_fix"
    | "quick_fix_secondary"
    | "import_current"
    | "open_profile_details";
  label: string;
  quickFixKey?: string;
  importTarget?: { tool: string; stateMode: string | null };
  importFallbackMode?: string;
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
  settingsSection?: "shell" | "keyring";
  setupMode?: ProfileImportMode;
  credentialBackend?: ExplicitProfileCredentialBackend | null;
  toolTarget?: string;
  importTarget?: { tool: string; stateMode: string | null };
  importFallbackMode?: ProfileImportMode;
  workspaceActivationTarget?: WorkspaceActivationTarget | null;
  matchedWorkspaceTarget?: string;
  secondaryAction?: {
    kind: "refresh_diagnostics";
    label: string;
  };
  primary?: boolean;
};

type DiagnosticRepairAction = {
  title: string;
  detail: string;
  fix?: string;
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
  verifyButtonLabel: "Verify",
  verifyAgainAriaLabel: "Verify Again",
  reviewSafeFixesAriaLabel: "Review Safe Fixes",
  applySafeFixesAriaLabel: "Apply Safe Fixes",
  reviewSafeFixesButtonLabel: "Review Safe Fixes…",
  applyingRepairsLabel: "Applying Repairs…",
  diagnosticsActionsAriaLabel: "Diagnostics actions",
  diagnosticsActionsTriggerAriaLabel: "Diagnostics more actions",
  exportReportLabel: "Export Report",
  exportingReportLabel: "Exporting Report…",
  findingsAriaLabel: "Diagnostics findings",
  inspectorOverflowTriggerAriaLabel: "More finding actions",
  inspectorOverflowMenuAriaLabel: "Finding actions",
  healthyTitle: "Everything looks good",
  healthyPrimaryDetail:
    "All configured tools match their active AISW profiles and local storage checks passed.",
  healthyCompactDetail:
    "Active profiles, local storage, and repair checks are currently passing.",
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
  repairPlanDialogAriaLabel: "Review Safe Fixes",
  repairPlanKicker: "Repair plan",
  repairPlanTitle: "Review Safe Fixes",
  repairPlanCloseLabel: "Close",
  repairPlanEmptyTitle: "No safe repairs queued",
  repairPlanEmptyDetail:
    "Diagnostics did not find any safe automatic repairs to apply right now.",
  repairPlanSelectionKicker: "Repairs",
  repairPlanSelectionDetail:
    "Profile re-apply, restore, and removal actions still require their own explicit flow.",
  repairPlanCancelLabel: "Cancel",
  copyReportPathLabel: "Copy report path",
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
    status: card.status === "fail" ? "fail" : "warn",
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
  if (currentFindingKey && findings.some((finding) => finding.key === currentFindingKey)) {
    return currentFindingKey;
  }

  return findings[0]?.key ?? null;
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
        scope: "tool",
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
        scope: "global",
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
  scope: "tool" | "global";
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
      return "Permission issue";
    case "OAuthTimeout":
      return "OAuth timeout";
    case "ConfigLockTimeout":
      return "Config lock timeout";
    case "NonInteractiveMode":
      return "Non-interactive mode failure";
    case "InvalidStateMode":
      return input.tool === "gemini" ? "Gemini shared-mode failure" : "Unsupported state mode";
    default:
      if (input.scope === "global" && input.id === "backup") {
        return "Backup restore needs attention";
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
  const findingTitle = finding.title.trim().toLowerCase();
  const fixTitle = fix.title.trim().toLowerCase();

  if (findingTitle === fixTitle) {
    return true;
  }

  if (finding.profileTarget?.tool && fix.profileTarget?.tool === finding.profileTarget.tool) {
    if (findingTitle.includes("live mismatch") && fixTitle.includes("live mismatch")) {
      return true;
    }
    if (findingTitle.includes("profile missing") && fixTitle.includes(finding.profileTarget.tool)) {
      return true;
    }
  }

  if (findingTitle.includes("permission") && fixTitle.includes("permission")) {
    return true;
  }
  if (findingTitle.includes("keyring") && (fixTitle.includes("keyring") || fixTitle.includes("file-backed storage"))) {
    return true;
  }
  if (findingTitle.includes("oauth") && fixTitle.includes("oauth")) {
    return true;
  }
  if (findingTitle.includes("shell") && fixTitle.includes("terminal integration")) {
    return true;
  }
  if (findingTitle.includes("project") && fixTitle.includes("project")) {
    return true;
  }
  if (findingTitle.includes("missing") && fixTitle.includes("missing")) {
    return true;
  }

  return false;
}

export function groupDiagnosticFindings(findings: DiagnosticFinding[]) {
  const groups = [
    { id: "blocked", label: "Blocked", items: [] as DiagnosticFinding[] },
    { id: "needs-attention", label: "Needs Attention", items: [] as DiagnosticFinding[] },
    { id: "suggestions", label: "Suggestions", items: [] as DiagnosticFinding[] },
  ];

  findings.forEach((finding) => {
    const title = finding.title.toLowerCase();
    if (finding.status === "fail") {
      groups[0].items.push(finding);
      return;
    }
    if (title.includes("missing") || title.includes("shell") || title.includes("setup")) {
      groups[2].items.push(finding);
      return;
    }
    groups[1].items.push(finding);
  });

  return groups;
}

export function impactTextForFinding(finding: DiagnosticFinding) {
  const title = finding.title.toLowerCase();
  if (title.includes("live mismatch")) {
    return "Switching is no longer guaranteed to match the saved profile, so you may start coding with the wrong account identity.";
  }
  if (title.includes("keyring")) {
    return "Stored credentials may not be readable or writable until local credential storage is repaired.";
  }
  if (title.includes("permission")) {
    return "AI Switch may fail to update local state, backups, or profile changes until local file permissions are corrected.";
  }
  if (title.includes("shell")) {
    return "Shell commands can drift from the desktop state until terminal integration is installed or refreshed.";
  }
  if (title.includes("missing")) {
    return "This tool cannot be switched or verified from the desktop app until its CLI is installed.";
  }
  if (title.includes("project")) {
    return "Project rules are no longer protecting the active workspace from using the wrong saved set.";
  }
  return "This state needs review before you rely on the current desktop switching state.";
}

export function buildDiagnosticsSummary(totalIssues: number, repairCount: number) {
  const remainingIssues = Math.max(totalIssues - repairCount, 0);
  return {
    title: totalIssues
      ? `${countLabel(totalIssues, "issue")} ${pluralNeeds(totalIssues)} attention`
      : "Everything looks good",
    detail: totalIssues
      ? `${countLabel(repairCount, "repair")} can be applied safely. ${countLabel(
          remainingIssues,
          "issue",
        )} ${pluralRequires(remainingIssues)} a decision.`
      : "All configured tools match their active AISW profiles and local storage checks passed.",
  };
}

export function formatRelativeVerifiedTime(timestamp: number, nowMs = Date.now()) {
  if (!timestamp) {
    return "Unavailable";
  }

  const diffMs = Math.max(nowMs - timestamp, 0);
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 10) {
    return "just now";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds} sec ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hr ago`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${countLabel(diffDays, "day")} ago`;
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

export function buildDiagnosticsStatusMessage(input: {
  bundleCopyMessage: string;
  exportedBundle?: DiagnosticBundleResult | null;
  exportErrorMessage?: string;
  appliedFixCount?: number;
}) {
  if (input.bundleCopyMessage) {
    return input.bundleCopyMessage;
  }

  if (input.exportedBundle) {
    return `Support report ready: ${input.exportedBundle.filename}. ${input.exportedBundle.path}`;
  }

  if (input.exportErrorMessage) {
    return input.exportErrorMessage;
  }

  if (typeof input.appliedFixCount === "number") {
    return `Applied ${countLabel(input.appliedFixCount, "safe fix", "safe fixes")}.`;
  }

  return "";
}

export function diagnosticBundlePathCopyMessage(path: string, clipboardAvailable: boolean) {
  if (!clipboardAvailable) {
    return `Clipboard access is unavailable. Copy the bundle path manually: ${path}`;
  }

  return `Copied bundle path ${path}.`;
}

export function diagnosticInspectorStatusLabel(status: DiagnosticFinding["status"]) {
  return status === "fail" ? BLOCKED_LABEL : NEEDS_ATTENTION_SENTENCE_LABEL;
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
  return `${count} ${count === 1 ? "repair can" : "repairs can"} be applied without changing account identity.`;
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
  const secondaryInspectorAction =
    buildPrimarySecondaryAction(input.primaryFindingFix)
    ?? buildQuickFixAction(input.secondaryFindingFixes[0])
    ?? buildOpenProfileDetailsAction(input.selectedFinding)
    ?? importCurrentAction;
  const overflowActions: DiagnosticInspectorAction[] = [
    ...(importCurrentAction && secondaryInspectorAction?.key !== importCurrentAction.key
      ? [importCurrentAction]
      : []),
    ...(buildPrimarySecondaryAction(input.primaryFindingFix)
      && secondaryInspectorAction?.key
        !== buildPrimarySecondaryAction(input.primaryFindingFix)?.key
      ? [buildPrimarySecondaryAction(input.primaryFindingFix)!]
      : []),
    ...input.secondaryFindingFixes
      .slice(secondaryInspectorAction?.kind === "quick_fix" ? 1 : 0)
      .map((fix) => buildQuickFixAction(fix))
      .filter((action): action is DiagnosticInspectorAction => Boolean(action)),
    ...(buildOpenProfileDetailsAction(input.selectedFinding)
      && secondaryInspectorAction?.key
        !== buildOpenProfileDetailsAction(input.selectedFinding)?.key
      ? [buildOpenProfileDetailsAction(input.selectedFinding)!]
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
  doctor: Record<string, unknown> | undefined;
  repair: Record<string, unknown> | undefined;
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
    fixes.push({
      kind: "open_settings",
      title: "Terminal integration not active",
      detail: shellHookIssue.detail,
      label: "Open terminal setup",
      status: shellHookIssue.status,
      settingsSection: "shell",
    });
  }

  const keyringIssue = keyringDoctorIssue(doctor);
  if (keyringIssue) {
    fixes.push({
      kind: "open_profile_setup",
      title: "Use file-backed storage",
      detail: "Open account setup with file-backed credential storage preselected for the next import or add flow.",
      label: "Use file-backed storage",
      status: keyringIssue.status,
      setupMode: DEFAULT_PROFILE_IMPORT_MODE,
      credentialBackend: "file",
    });
    fixes.push({
      kind: "open_settings",
      title: "Keyring setup instructions",
      detail: "Review the supported local keyring services for macOS, Windows, and Linux.",
      label: "Show keyring setup",
      status: keyringIssue.status,
      settingsSection: "keyring",
    });
  }

  if (!snapshot) {
    return fixes;
  }

  snapshot.statuses.forEach((status) => {
    if (!status.binary_found) {
      fixes.push({
        kind: "open_installation_guide",
        title: `${status.tool} is missing`,
        detail: `Open the install guide for ${status.tool} and then refresh diagnostics.`,
        label: "Open installation guide",
        status: "warn",
        toolTarget: status.tool,
        secondaryAction: {
          kind: "refresh_diagnostics",
          label: "Refresh diagnostics",
        },
      });
    }

    if (status.active_profile && status.active_profile_applied === false) {
      const profileLabel = toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile);
      fixes.push({
        kind: "reapply_profile",
        title: `${status.tool} live mismatch`,
        detail: `Re-apply ${profileLabel} so the live credentials match the saved profile again.`,
        label: `Re-apply ${profileLabel}`,
        status: "fail",
        profileTarget: {
          tool: status.tool,
          profile: status.active_profile,
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
      });
    }
  });

  const workspace = parseWorkspaceStatus(snapshot.workspace_status ?? undefined);
  const hasWorkspaceMismatch =
    workspace.status === "mismatch" &&
    workspace.expectedContext !== "none" &&
    workspace.expectedContext !== workspace.currentContext;

  if (hasWorkspaceMismatch) {
    const expectedContextLabel = contextDisplayLabel(settings, workspace.expectedContext);
    const currentContextLabel = contextDisplayLabel(settings, workspace.currentContext);
    const target = resolveWorkspaceActivationTarget(workspace.expectedContext, settings, snapshot);
    fixes.push({
      kind: "resolve_workspace",
      title: "Project set mismatch",
      detail: target
        ? `This folder wants ${expectedContextLabel}, but ${currentContextLabel} is currently active.`
        : `This folder wants ${expectedContextLabel}, but no matching detected set or ready saved set is currently available.`,
      label: target ? "Use expected set now" : "Open Sets",
      status: "warn",
      primary: true,
      workspaceActivationTarget: target,
      matchedWorkspaceTarget: workspace.target,
    });
  }

  return fixes;
}

function buildRepairFixMap(repair: Record<string, unknown> | undefined) {
  const result = asObject(repair?.result);
  return asArray(result?.actions)
    .map((action) => asObject(action))
    .filter((action): action is Record<string, unknown> => Boolean(action))
    .reduce((map, action) => {
      const fix = asStringValue(action.fix);
      if (fix) {
        map.set(fix.toLowerCase(), fix);
      }
      return map;
    }, new Map<string, string>());
}

function pluralNeeds(count: number) {
  return count === 1 ? "needs" : "need";
}

function pluralRequires(count: number) {
  return count === 1 ? "requires" : "require";
}

function repairableDoctorIssues(
  doctor: Record<string, unknown> | undefined,
  repairFixMap: Map<string, string>,
): Array<{
  title: string;
  detail: string;
  label: string;
  fix: string;
  status: "warn" | "fail";
  primary?: boolean;
}> {
  return asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check))
    .flatMap((check) => {
      const name = asStringValue(check.name)?.toLowerCase() ?? "";
      const detail = asStringValue(check.detail) ?? "AI Switch reported an issue.";
      const status = (asStringValue(check.status) as "warn" | "fail" | undefined) ?? "warn";

      if (name.includes("keyring")) {
        return [doctorRepairFixCard(
          "Keyring unavailable",
          detail,
          "Apply keyring repair",
          status,
          repairFixMap.get("keyring") ?? "keyring",
        )];
      }
      if (name.includes("permission")) {
        return [doctorRepairFixCard(
          "Permission issue",
          detail,
          "Repair permissions",
          status,
          repairFixMap.get("permissions") ?? "permissions",
        )];
      }
      if (name.includes("oauth")) {
        return [doctorRepairFixCard(
          "OAuth failure",
          detail,
          "Retry OAuth repair",
          status,
          repairFixMap.get("oauth") ?? "oauth",
        )];
      }
      return [];
    });
}

function doctorRepairFixCard(
  title: string,
  detail: string,
  label: string,
  status: "warn" | "fail",
  fix: string,
) {
  return {
    title,
    detail,
    label,
    status,
    fix,
    primary: true,
  };
}

function shellHookDoctorIssue(doctor: Record<string, unknown> | undefined) {
  const checks = asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check));

  for (const check of checks) {
    const name = asStringValue(check.name)?.toLowerCase() ?? "";
    const detail = normalizeTerminalIntegrationText(
      asStringValue(check.detail) ?? "Terminal integration guidance needs attention.",
    );
    const status = (asStringValue(check.status) as "warn" | "fail" | undefined) ?? "warn";
    const detailText = detail.toLowerCase();
    if (
      (name.includes("shell") && name.includes("hook")) ||
      detailText.includes("shell hook") || detailText.includes("terminal integration")
    ) {
      return { detail, status };
    }
  }

  return null;
}

function keyringDoctorIssue(doctor: Record<string, unknown> | undefined) {
  const checks = asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check));

  for (const check of checks) {
    const name = asStringValue(check.name)?.toLowerCase() ?? "";
    const detail = asStringValue(check.detail) ?? "Keyring access needs attention.";
    const status = (asStringValue(check.status) as "warn" | "fail" | undefined) ?? "warn";
    const detailText = detail.toLowerCase();
    if (name.includes("keyring") || detailText.includes("keyring")) {
      return { detail, status };
    }
  }

  return null;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function resolveStateMode(status: ToolStatus) {
  if (!toolSupportsEditableStateModes(status.tool)) {
    return null;
  }
  return status.state_mode ?? DEFAULT_EDITABLE_STATE_MODE;
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
    label: "Open Profile Details",
    profileTarget: finding.profileTarget,
  };
}
