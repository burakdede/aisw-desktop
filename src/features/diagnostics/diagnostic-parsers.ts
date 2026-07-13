import { normalizeTerminalIntegrationText } from "../shared/terminal-integration-language";

type StatusTone = "pass" | "warn" | "fail" | "unknown";

export interface SummaryCardData {
  title: string;
  status: StatusTone;
  lines: string[];
}

export interface IssueCardData {
  title: string;
  status: StatusTone;
  issues: string[];
  remediation: string[];
}

export interface RepairActionData {
  title: string;
  detail: string;
  status: string;
  fix: string;
  count: number;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  return asArray(value).map((item) => asString(item)).filter(Boolean);
}

function asString(value: unknown, fallback = "unknown") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function normalizeUserFacingIssueText(value: string) {
  return normalizeTerminalIntegrationText(value);
}

export function parseDoctorSummary(payload: Record<string, unknown> | undefined): SummaryCardData {
  const checks = asArray(payload?.checks);
  const pass = checks.filter((check) => asObject(check)?.status === "pass").length;
  const warn = checks.filter((check) => asObject(check)?.status === "warn").length;
  const fail = checks.filter((check) => asObject(check)?.status === "fail").length;
  return {
    title: "Health scan",
    status: fail > 0 ? "fail" : warn > 0 ? "warn" : checks.length ? "pass" : "unknown",
    lines: [
      `${checks.length} checks`,
      `${pass} pass`,
      `${warn} warn`,
      `${fail} fail`,
    ],
  };
}

export function parseVerifySummary(payload: Record<string, unknown> | undefined): SummaryCardData {
  const summary = asObject(payload?.summary);
  return {
    title: "Live match",
    status: (summary?.status as StatusTone) ?? "unknown",
    lines: [
      `${asNumber(summary?.passed)} passed`,
      `${asNumber(summary?.warnings)} warnings`,
      `${asNumber(summary?.failed)} failed`,
    ],
  };
}

export function parseRepairSummary(payload: Record<string, unknown> | undefined): SummaryCardData {
  const result = asObject(payload?.result);
  const summary = asObject(result?.summary);
  return {
    title: "Repair plan",
    status: (summary?.status as StatusTone) ?? "unknown",
    lines: [
      `${asNumber(summary?.actions_planned)} actions planned`,
      `${asNumber(summary?.actions_applied)} applied`,
      `${asNumber(summary?.issues_remaining)} issues remaining`,
    ],
  };
}

export function parseDoctorIssues(payload: Record<string, unknown> | undefined): IssueCardData[] {
  return asArray(payload?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check))
    .filter((check) => asString(check.status) !== "pass")
    .map((check) => ({
      title: asString(check.name),
      status: asString(check.status) as StatusTone,
      issues: [normalizeUserFacingIssueText(asString(check.detail))],
      remediation: asStringArray(check.remediation).map(normalizeUserFacingIssueText),
    }));
}

export function parseVerifyIssues(payload: Record<string, unknown> | undefined): IssueCardData[] {
  return asArray(payload?.tools)
    .map((tool) => asObject(tool))
    .filter((tool): tool is Record<string, unknown> => Boolean(tool))
    .filter((tool) => asString(tool.status) !== "pass")
    .map((tool) => ({
      title: asString(tool.tool),
      status: asString(tool.status) as StatusTone,
      issues: asArray(tool.issues).map((issue) => normalizeUserFacingIssueText(asString(issue))),
      remediation: asArray(tool.remediation).map((item) => normalizeUserFacingIssueText(asString(item))),
    }));
}

export function parseRepairActions(payload: Record<string, unknown> | undefined): RepairActionData[] {
  const result = asObject(payload?.result);
  const grouped = new Map<
    string,
    {
      kind: string;
      fix: string;
      path: string;
      detail: string;
      status: string;
      count: number;
    }
  >();

  asArray(result?.actions)
    .map((action) => asObject(action))
    .filter((action): action is Record<string, unknown> => Boolean(action))
    .forEach((action) => {
      const kind = asString(action.kind, "");
      const fix = asString(action.fix, "");
      const path = asString(action.path, "");
      const tool = asString(action.tool, "");
      const profile = asString(action.profile, "");
      const target = [tool, profile].filter(Boolean).join("/");
      const detail = asString(action.detail, "");
      const status = asString(action.status);
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
        status,
        count: 1,
      });
    });

  return [...grouped.values()].map((action) => formatRepairAction(action));
}

function formatRepairAction(action: {
  kind: string;
  fix: string;
  path: string;
  detail: string;
  status: string;
  count: number;
}): RepairActionData {
  switch (action.fix.toLowerCase()) {
    case "permissions":
      return {
        title: "Repair permissions",
        detail:
          action.count > 1
            ? `${action.count} AISW-managed items need permission repair.`
            : "Repair incorrect permissions for AISW-managed files.",
        status: action.status,
        fix: action.fix,
        count: action.count,
      };
    case "keyring":
      return {
        title: "Unlock keyring integration",
        detail: "Reconnect AI Switch to the local system keyring service.",
        status: action.status,
        fix: action.fix,
        count: action.count,
      };
    case "oauth":
      return {
        title: "Retry OAuth recovery",
        detail: "Retry the OAuth recovery flow for the affected tool.",
        status: action.status,
        fix: action.fix,
        count: action.count,
      };
    case "home":
      return {
        title: "Create missing AISW data directory",
        detail: action.path || "Create the missing AISW data directory.",
        status: action.status,
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
        status: action.status,
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
