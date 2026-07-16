import { normalizeRuntimeLanguage } from "../features/shared/runtime-language";
import {
  ACTIVE_LABEL,
  AVAILABLE_LABEL,
  CURRENT_LABEL,
  IMPORTED_LABEL,
  NEEDS_ATTENTION_LABEL,
  SAVED_LABEL,
} from "./status-copy";
import { countLabel } from "./utils";

type CommandResult = {
  status: "success" | "error";
  message: string;
  remediation?: string;
};

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
  return active ? CURRENT_LABEL : `Use CLI Context ${contextLabel}`;
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

  return `Last ${kind} result: ${message}${remediation ? ` Remediation: ${remediation}` : ""}`;
}

export function duplicateSetNameWarning(name: string) {
  return `A set named ${name} already exists. Rename the existing set or choose a different name.`;
}

export function emptySetSelectionWarning() {
  return "Select at least one tool profile before saving this set.";
}

export function emptyRuleSetWarning() {
  return "No sets are available yet. Create one before saving a project rule.";
}

export function explicitRuleTargetWarning(scope: string) {
  return `Enter a ${scope === "path" ? "path prefix" : "git remote pattern"} before saving or removing this rule.`;
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
  return canResolveDirectly ? "Use Expected Set" : "Open Sets";
}

export function savedRuleStatusLabel(active: boolean) {
  return active ? ACTIVE_LABEL : SAVED_LABEL;
}

export function selectedRuleSubtitle(matched: boolean) {
  return matched ? "This rule currently matches" : "Saved project rule";
}

export function selectedRulePriorityLabel(scope: string) {
  return scope === "default" ? "Fallback" : "Explicit";
}

export function selectedRuleMatchLabel(matched: boolean) {
  return matched ? "Current project" : "Not matched";
}
