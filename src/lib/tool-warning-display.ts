import type { ToolStatus } from "./schemas";

export const TOKEN_WARNING_FALLBACK_DETAIL = "Token state needs attention.";
export const RUNTIME_WARNING_FALLBACK_DETAIL = "Warning reported by the runtime.";
export const APP_WARNING_FALLBACK_DETAIL = "Warning reported by AI Switch.";

type TokenWarning = Pick<ToolStatus, "token_warning">["token_warning"];
type ToolWarning = ToolStatus["warnings"][number];

export function formatTokenWarning(
  warning: TokenWarning,
  options?: { prefix?: string },
) {
  if (!warning) {
    return TOKEN_WARNING_FALLBACK_DETAIL;
  }

  const detail =
    warning.summary ?? warning.message ?? warning.code ?? TOKEN_WARNING_FALLBACK_DETAIL;
  const suffix = warning.expires_at
    ? ` Expires at ${warning.expires_at}.`
    : typeof warning.expires_in_days === "number"
      ? ` Expires in ${warning.expires_in_days} days.`
      : "";
  const content = `${detail}${suffix}`;

  return options?.prefix ? `${options.prefix}${content}` : content;
}

export function formatToolWarning(
  warning: ToolWarning,
  options?: { prefix?: string; fallbackDetail?: string },
) {
  const detail = warning.message ?? warning.code ?? options?.fallbackDetail ?? APP_WARNING_FALLBACK_DETAIL;
  const content = warning.remediation ? `${detail} Remediation: ${warning.remediation}` : detail;

  return options?.prefix ? `${options.prefix}${content}` : content;
}
