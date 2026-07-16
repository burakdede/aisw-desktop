import { authMethodLabel } from "./auth-method-display";
import { DATE_UNAVAILABLE_LABEL } from "./date-format";
import { NOT_AVAILABLE_LABEL, VERIFICATION_REQUIRED_LABEL } from "./display-copy";
import {
  AVAILABLE_AFTER_ACTIVATION_LABEL,
  NOT_VERIFIED_LABEL,
} from "./status-copy";
import type { ToolStatus } from "./schemas";
import { stateModeLabel } from "../features/shared/state-modes";

export const HIDE_STORAGE_DETAILS_LABEL = "Hide Storage Details";
export const STORAGE_DETAILS_LABEL = "Storage Details";
export { AVAILABLE_AFTER_ACTIVATION_LABEL, NOT_VERIFIED_LABEL } from "./status-copy";

export function profileStateModeLabel(mode: string | null | undefined) {
  if (!mode) {
    return NOT_AVAILABLE_LABEL;
  }
  return stateModeLabel(mode);
}

export function profileStorageBooleanLabel(value: boolean | null | undefined) {
  if (value === undefined || value === null) {
    return VERIFICATION_REQUIRED_LABEL;
  }
  return value ? "Yes" : "No";
}

export function profileAuthMethodLabel(auth: string) {
  return authMethodLabel(auth);
}

export function profileTokenWarningLabel(status: Pick<ToolStatus, "token_warning">) {
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
  return `${detail}${suffix}`;
}

export function profileWarningLabel(
  warning: NonNullable<ToolStatus["warnings"]>[number],
) {
  const detail = warning.message ?? warning.code ?? "Warning reported by AI Switch.";
  return warning.remediation ? `${detail} Remediation: ${warning.remediation}` : detail;
}

export function profileLastCheckedLabel(
  value: string | null | undefined,
  active: boolean,
) {
  if (value) {
    return value;
  }
  return active ? NOT_VERIFIED_LABEL : DATE_UNAVAILABLE_LABEL;
}

export function profileAddedLabel(value: string | null | undefined) {
  return value ?? DATE_UNAVAILABLE_LABEL;
}

export function profileStorageDetailsToggleLabel(open: boolean) {
  return open ? HIDE_STORAGE_DETAILS_LABEL : STORAGE_DETAILS_LABEL;
}
