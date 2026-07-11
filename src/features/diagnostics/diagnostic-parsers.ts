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
  return value
    .replace(
      "Shell hook is not active in the current shell session.",
      "Terminal integration is not active in the current shell session.",
    )
    .replace(
      "Install the shell hook and reload the shell.",
      "Install terminal integration and reload the shell.",
    );
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
  return asArray(result?.actions)
    .map((action) => asObject(action))
    .filter((action): action is Record<string, unknown> => Boolean(action))
    .map((action) => ({
      title: `${asString(action.kind)} · ${asString(action.fix)}`,
      detail: `${asString(action.path)} — ${asString(action.detail)}`,
      status: asString(action.status),
    }));
}
