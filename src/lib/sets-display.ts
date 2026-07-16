import { normalizeRuntimeLanguage } from "../features/shared/runtime-language";
import {
  ACTIVE_LABEL,
  AVAILABLE_LABEL,
  CURRENT_LABEL,
  IMPORTED_LABEL,
  NEEDS_ATTENTION_LABEL,
  SAVED_LABEL,
} from "./status-copy";
import { formatMessageWithRemediation } from "./remediation-text";
import { countLabel } from "./utils";

type CommandResult = {
  status: "success" | "error";
  message: string;
  remediation?: string;
};

const SETS_DISPLAY_COPY = {
  importedContextPrefix: "Use CLI Context ",
  lastSetResultPrefix: "Last set result: ",
  lastProjectRuleResultPrefix: "Last project-rule result: ",
  duplicateSetWarningPrefix: "A set named ",
  duplicateSetWarningSuffix:
    " already exists. Rename the existing set or choose a different name.",
  emptySetSelectionWarning: "Select at least one tool profile before saving this set.",
  emptyRuleSetWarning:
    "No sets are available yet. Create one before saving a project rule.",
  ruleTargetPrompts: {
    path: "path prefix",
    git_remote: "git remote pattern",
  },
  ruleTargetWarningSuffix: " before saving or removing this rule.",
  workspaceActionUseExpectedSet: "Use Expected Set",
  workspaceActionOpenSets: "Open Sets",
  selectedRuleSubtitles: {
    matched: "This rule currently matches",
    saved: "Saved project rule",
  },
} as const;

function normalizeProjectRuleLanguage(text: string) {
  return normalizeRuntimeLanguage(text)
    .replace("workspace guardrails", "project-rule guardrails")
    .replace("Workspace guardrails", "Project-rule guardrails")
    .replace("workspace checks", "project-rule checks")
    .replace("Workspace checks", "Project-rule checks");
}

function normalizeSetPanelResultText(text: string, kind: "set" | "project-rule") {
  if (kind === "project-rule") {
    return normalizeProjectRuleLanguage(text);
  }
  return normalizeRuntimeLanguage(text);
}

export function profileSetStatus(active: boolean, ready: boolean) {
  if (active) {
    return { label: CURRENT_LABEL, tone: "ready", symbol: "●" };
  }
  if (ready) {
    return { label: AVAILABLE_LABEL, tone: "available", symbol: "●" };
  }
  return { label: NEEDS_ATTENTION_LABEL, tone: "warn", symbol: "▲" };
}

export function importedContextStatus(active: boolean) {
  return active
    ? { label: CURRENT_LABEL, tone: "ready", symbol: "●" }
    : { label: IMPORTED_LABEL, tone: "available", symbol: "○" };
}

export function importedContextActionLabel(active: boolean, contextLabel: string) {
  return active ? CURRENT_LABEL : `${SETS_DISPLAY_COPY.importedContextPrefix}${contextLabel}`;
}

export function setSelectionCountLabel(count: number) {
  return `${countLabel(count, "profile")} mapped`;
}

export function setCommandResultLabel(
  result: CommandResult | null | undefined,
  kind: "set" | "project-rule",
) {
  if (!result) {
    return null;
  }

  const message = normalizeSetPanelResultText(result.message, kind);
  const remediation = result.remediation
    ? normalizeSetPanelResultText(result.remediation, kind)
    : null;

  return formatMessageWithRemediation(`Last ${kind} result: ${message}`, remediation);
}

export function duplicateSetNameWarning(name: string) {
  return `${SETS_DISPLAY_COPY.duplicateSetWarningPrefix}${name}${SETS_DISPLAY_COPY.duplicateSetWarningSuffix}`;
}

export function emptySetSelectionWarning() {
  return SETS_DISPLAY_COPY.emptySetSelectionWarning;
}

export function emptyRuleSetWarning() {
  return SETS_DISPLAY_COPY.emptyRuleSetWarning;
}

export function explicitRuleTargetWarning(scope: string) {
  const prompt =
    scope === "path"
      ? SETS_DISPLAY_COPY.ruleTargetPrompts.path
      : SETS_DISPLAY_COPY.ruleTargetPrompts.git_remote;
  return `Enter a ${prompt}${SETS_DISPLAY_COPY.ruleTargetWarningSuffix}`;
}

export function ruleScopeLabel(scope: string) {
  switch (scope) {
    case "path":
      return "Folder";
    case "git_remote":
      return "Git remote";
    case "default":
      return "Default";
    case "none":
      return "No match";
    default:
      return scope.replace(/_/g, " ");
  }
}

export function ruleTargetLabel(scope: string, target: string) {
  if (scope === "default" || target === "default") {
    return "Default set";
  }
  if (!target || target === "none") {
    return "No target";
  }
  return target;
}

export function workspaceSetActionLabel(canResolveDirectly: boolean) {
  return canResolveDirectly
    ? SETS_DISPLAY_COPY.workspaceActionUseExpectedSet
    : SETS_DISPLAY_COPY.workspaceActionOpenSets;
}

export function savedRuleStatusLabel(active: boolean) {
  return active ? ACTIVE_LABEL : SAVED_LABEL;
}

export function selectedRuleSubtitle(matched: boolean) {
  return matched
    ? SETS_DISPLAY_COPY.selectedRuleSubtitles.matched
    : SETS_DISPLAY_COPY.selectedRuleSubtitles.saved;
}

export function selectedRulePriorityLabel(scope: string) {
  return scope === "default" ? "Fallback" : "Explicit";
}

export function selectedRuleMatchLabel(matched: boolean) {
  return matched ? "Current project" : "Not matched";
}
