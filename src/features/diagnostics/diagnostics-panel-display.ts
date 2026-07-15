import type { AppSnapshot } from "../../lib/schemas";
import { isSupportedTool } from "../../lib/tool-registry";
import { countLabel, titleCase } from "../../lib/utils";
import type { LastCommandResult } from "../shared/lastCommandResult";
import { normalizeRuntimeLanguage } from "../shared/runtime-language";
import type { IssueCardData } from "./diagnostic-parsers";
import { diagnosticFindingTitle } from "../../lib/diagnostic-display";

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
  importFallbackMode?: string;
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

type LastCommandResultsInput = {
  tool: Record<string, LastCommandResult | undefined>;
  global: Record<string, LastCommandResult | undefined>;
};

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
