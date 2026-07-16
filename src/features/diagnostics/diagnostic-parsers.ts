import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";
import type {
  DoctorReport,
  RepairReport,
  VerifyReport,
} from "../../lib/schemas";
import {
  countCheckStatuses,
  normalizeAttentionCheckStatus,
  normalizeCheckStatus,
  summarizeCheckStatus,
  type AttentionCheckStatus,
  type CheckStatus,
} from "../../lib/check-status";
import {
  asArray,
  asNumber,
  asObject,
  asString,
  type UnknownRecord,
} from "../../lib/parse-guards";
import { DIAGNOSTICS_REPAIR_PLAN_LABEL } from "./diagnostics-copy";

export interface SummaryCardData {
  title: string;
  status: CheckStatus;
  lines: string[];
}

export interface IssueCardData {
  title: string;
  status: AttentionCheckStatus;
  issues: string[];
  remediation: string[];
}

export interface RepairActionData {
  title: string;
  detail: string;
  fix: string;
  count: number;
}

type GroupedRepairAction = {
  kind: string;
  fix: string;
  path: string;
  detail: string;
  count: number;
};

function asStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  return asArray(value).map((item) => asString(item)).filter(Boolean);
}

function normalizeUserFacingIssueText(value: string) {
  return normalizeTerminalIntegrationText(value);
}

export function parseDoctorSummary(payload: DoctorReport | undefined): SummaryCardData {
  const counts = countCheckStatuses(
    asArray(payload?.checks).map((check) => asObject(check)?.status),
  );
  return {
    title: "Health scan",
    status: summarizeCheckStatus(counts),
    lines: [
      `${counts.total} checks`,
      `${counts.pass} pass`,
      `${counts.warn} warn`,
      `${counts.fail} fail`,
    ],
  };
}

export function parseVerifySummary(payload: VerifyReport | undefined): SummaryCardData {
  const summary = asObject(payload?.summary);
  return {
    title: "Live match",
    status: normalizeCheckStatus(summary?.status),
    lines: [
      `${asNumber(summary?.passed)} passed`,
      `${asNumber(summary?.warnings)} warnings`,
      `${asNumber(summary?.failed)} failed`,
    ],
  };
}

export function parseRepairSummary(payload: RepairReport | undefined): SummaryCardData {
  const result = asObject(payload?.result);
  const summary = asObject(result?.summary);
  return {
    title: DIAGNOSTICS_REPAIR_PLAN_LABEL,
    status: normalizeCheckStatus(summary?.status),
    lines: [
      `${asNumber(summary?.actions_planned)} actions planned`,
      `${asNumber(summary?.actions_applied)} applied`,
      `${asNumber(summary?.issues_remaining)} issues remaining`,
    ],
  };
}

export function parseDoctorIssues(payload: DoctorReport | undefined): IssueCardData[] {
  return asArray(payload?.checks)
    .map((check) => asObject(check))
    .filter((check): check is UnknownRecord => Boolean(check))
    .filter((check) => normalizeCheckStatus(check.status) !== "pass")
    .map((check) => ({
      title: asString(check.name),
      status: normalizeAttentionCheckStatus(check.status, "warn"),
      issues: [normalizeUserFacingIssueText(asString(check.detail))],
      remediation: asStringArray(check.remediation).map(normalizeUserFacingIssueText),
    }));
}

export function parseVerifyIssues(payload: VerifyReport | undefined): IssueCardData[] {
  return asArray(payload?.tools)
    .map((tool) => asObject(tool))
    .filter((tool): tool is UnknownRecord => Boolean(tool))
    .filter((tool) => normalizeCheckStatus(tool.status) !== "pass")
    .map((tool) => ({
      title: asString(tool.tool),
      status: normalizeAttentionCheckStatus(tool.status, "warn"),
      issues: asArray(tool.issues).map((issue) => normalizeUserFacingIssueText(asString(issue))),
      remediation: asArray(tool.remediation).map((item) => normalizeUserFacingIssueText(asString(item))),
    }));
}

export function parseRepairActions(payload: RepairReport | undefined): RepairActionData[] {
  const result = asObject(payload?.result);
  const grouped = new Map<string, GroupedRepairAction>();

  asArray(result?.actions)
    .map((action) => asObject(action))
    .filter((action): action is UnknownRecord => Boolean(action))
    .forEach((action) => {
      const kind = asString(action.kind, "");
      const fix = asString(action.fix, "");
      const path = asString(action.path, "");
      const tool = asString(action.tool, "");
      const profile = asString(action.profile, "");
      const target = [tool, profile].filter(Boolean).join("/");
      const detail = asString(action.detail, "");
      const key = [kind, fix, target || path].join("|").toLowerCase();
      const current = grouped.get(key);

      if (current) {
        current.count += 1;
        return;
      }

      grouped.set(key, {
        kind,
        fix,
        path,
        detail,
        count: 1,
      });
    });

  return [...grouped.values()].map((action) => formatRepairAction(action));
}

function formatRepairAction(action: GroupedRepairAction): RepairActionData {
  switch (action.fix.toLowerCase()) {
    case "permissions":
      return {
        title: "Repair permissions",
        detail:
          action.count > 1
            ? `${action.count} AISW-managed items need permission repair.`
            : "Repair incorrect permissions for AISW-managed files.",
        fix: action.fix,
        count: action.count,
      };
    case "keyring":
      return {
        title: "Unlock keyring integration",
        detail: "Reconnect AI Switch to the local system keyring service.",
        fix: action.fix,
        count: action.count,
      };
    case "oauth":
      return {
        title: "Retry OAuth recovery",
        detail: "Retry the OAuth recovery flow for the affected tool.",
        fix: action.fix,
        count: action.count,
      };
    case "home":
      return {
        title: "Create missing AISW data directory",
        detail: action.path || "Create the missing AISW data directory.",
        fix: action.fix,
        count: action.count,
      };
    default:
      return {
        title: humanizeRepairActionTitle(action.kind, action.fix),
        detail:
          action.count > 1
            ? `${action.count} matching repair steps were combined into one safe action.`
            : action.path && action.detail
              ? `${action.path} — ${action.detail}`
              : action.detail || action.path || "Safe repair available.",
        fix: action.fix,
        count: action.count,
      };
  }
}

function humanizeRepairActionTitle(kind: string, fix: string) {
  const parts = [fix, kind]
    .filter(Boolean)
    .map((value) =>
      value
        .replace(/[_-]+/g, " ")
        .trim(),
    )
    .filter(Boolean);
  const label = parts[0] || "repair";
  return label
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
