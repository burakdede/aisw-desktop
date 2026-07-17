import { normalizeOneOf } from "./parse-guards";

const CHECK_STATUS_DEFINITIONS = [
  {
    id: "pass",
    symbol: "✓",
    attention: false,
  },
  {
    id: "warn",
    symbol: "!",
    attention: true,
  },
  {
    id: "fail",
    symbol: "✕",
    attention: true,
  },
  {
    id: "unknown",
    symbol: "?",
    attention: false,
  },
] as const;

export type CheckStatus = (typeof CHECK_STATUS_DEFINITIONS)[number]["id"];
export const CHECK_STATUSES: readonly CheckStatus[] = CHECK_STATUS_DEFINITIONS.map(
  (status) => status.id,
);
export type ResolvedCheckStatus = Exclude<CheckStatus, "unknown">;
export type AttentionCheckStatus = Extract<CheckStatus, "warn" | "fail">;
export const ATTENTION_CHECK_STATUSES = CHECK_STATUS_DEFINITIONS.filter(
  (status) => status.attention,
).map((status) => status.id as AttentionCheckStatus);

export const CHECK_STATUS_SYMBOLS: Record<CheckStatus, string> = Object.fromEntries(
  CHECK_STATUS_DEFINITIONS.map((status) => [status.id, status.symbol]),
) as Record<CheckStatus, string>;

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
  return ATTENTION_CHECK_STATUSES.includes(status as AttentionCheckStatus);
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
