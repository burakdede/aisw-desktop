import { normalizeOneOf } from "./parse-guards";

export const CHECK_STATUSES = ["pass", "warn", "fail", "unknown"] as const;
export type CheckStatus = (typeof CHECK_STATUSES)[number];
export type ResolvedCheckStatus = Exclude<CheckStatus, "unknown">;
export const ATTENTION_CHECK_STATUSES = ["warn", "fail"] as const;
export type AttentionCheckStatus = (typeof ATTENTION_CHECK_STATUSES)[number];

export const CHECK_STATUS_SYMBOLS: Record<CheckStatus, string> = {
  pass: "✓",
  warn: "!",
  fail: "✕",
  unknown: "?",
};

export function normalizeCheckStatus(
  value: unknown,
  fallback: CheckStatus = "unknown",
): CheckStatus {
  return normalizeOneOf(CHECK_STATUSES, value, fallback);
}

export function normalizeResolvedCheckStatus(
  value: unknown,
  fallback: ResolvedCheckStatus = "pass",
): ResolvedCheckStatus {
  const status = normalizeCheckStatus(value, fallback);
  return status === "warn" || status === "fail" ? status : "pass";
}

export function isAttentionCheckStatus(status: CheckStatus): status is AttentionCheckStatus {
  return status === "warn" || status === "fail";
}

export function normalizeAttentionCheckStatus(
  value: unknown,
  fallback: AttentionCheckStatus = "warn",
): AttentionCheckStatus {
  return normalizeCheckStatus(value, fallback) === "fail" ? "fail" : "warn";
}

export function countCheckStatuses(statuses: Iterable<unknown>) {
  let total = 0;
  let pass = 0;
  let warn = 0;
  let fail = 0;
  let unknown = 0;

  for (const status of statuses) {
    total += 1;
    switch (normalizeCheckStatus(status)) {
      case "pass":
        pass += 1;
        break;
      case "warn":
        warn += 1;
        break;
      case "fail":
        fail += 1;
        break;
      case "unknown":
        unknown += 1;
        break;
    }
  }

  return {
    total,
    pass,
    warn,
    fail,
    unknown,
  };
}

export function summarizeCheckStatus(input: {
  total: number;
  pass: number;
  warn: number;
  fail: number;
}): CheckStatus {
  if (input.fail > 0) {
    return "fail";
  }
  if (input.warn > 0) {
    return "warn";
  }
  if (input.total > 0 && input.pass > 0) {
    return "pass";
  }
  return "unknown";
}

export function checkStatusSymbol(status: CheckStatus) {
  return CHECK_STATUS_SYMBOLS[status];
}
