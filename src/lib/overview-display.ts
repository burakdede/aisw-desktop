import { normalizeRuntimeLanguage } from "../features/shared/runtime-language";
import { fixedStateModeDescription, stateModeDescription } from "../features/shared/state-modes";
import type { ToolStatus } from "./schemas";
import type { OverviewHealthState } from "./status-display";
import { countLabel, pluralChoice, titleCase } from "./utils";

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

export function overviewStateModeCopy(options: string[], selected: string, tool: string) {
  if (!options.length) {
    return fixedStateModeDescription(tool);
  }
  const effective = options.includes(selected) ? selected : options[0] ?? selected;
  return stateModeDescription(effective);
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
  return authMethod ? titleCase(authMethod.replace(/_/g, " ")) : "Not configured";
}
