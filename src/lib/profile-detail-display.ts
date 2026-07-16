import { authMethodLabel } from "./auth-method-display";
import { DATE_UNAVAILABLE_LABEL } from "./date-format";
import { NOT_AVAILABLE_LABEL, VERIFICATION_REQUIRED_LABEL } from "./display-copy";
import {
  AVAILABLE_AFTER_ACTIVATION_LABEL,
  NOT_VERIFIED_LABEL,
} from "./status-copy";
import type { ToolStatus } from "./schemas";
import { formatTokenWarning, formatToolWarning } from "./tool-warning-display";
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
  return formatTokenWarning(status.token_warning);
}

export function profileWarningLabel(
  warning: NonNullable<ToolStatus["warnings"]>[number],
) {
  return formatToolWarning(warning);
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
