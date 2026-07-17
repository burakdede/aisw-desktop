import { savedItemMessage } from "../../lib/display-copy";
import { resolveErrorMessage } from "../../lib/error-details";

export const DIAGNOSTICS_HEALTHY_TITLE = "Everything looks good";
export const DIAGNOSTICS_HEALTHY_PRIMARY_DETAIL =
  "All configured tools match their active AISW profiles and local storage checks passed.";
export const DIAGNOSTICS_HEALTHY_COMPACT_DETAIL =
  "Active profiles, local storage, and repair checks are currently passing.";
export const DIAGNOSTICS_EXPORT_REPORT_TITLE = "Diagnostic report exported";
export const DIAGNOSTICS_EXPORT_REPORT_FAILED_TITLE = "Diagnostic report export failed";
export const DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE = "Diagnostic report export failed.";
export const DIAGNOSTICS_REPAIR_PLAN_LABEL = "Repair plan";
export const DIAGNOSTICS_REVIEW_SAFE_FIXES_LABEL = "Review Safe Fixes";
export const DIAGNOSTICS_REVIEW_SAFE_FIXES_ELLIPSIS_LABEL =
  `${DIAGNOSTICS_REVIEW_SAFE_FIXES_LABEL}…`;
export const DIAGNOSTICS_REFRESH_DIAGNOSTICS_LABEL = "Refresh diagnostics";
export const DIAGNOSTICS_NO_SAFE_REPAIRS_QUEUED_TITLE = "No safe repairs queued";

export function diagnosticExportedMessage(filename: string) {
  return savedItemMessage(filename);
}

export function diagnosticExportFailureMessage(error: unknown) {
  return resolveErrorMessage(error, DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE);
}

export function diagnosticExportSuccessNotification(filename: string) {
  return {
    title: DIAGNOSTICS_EXPORT_REPORT_TITLE,
    body: diagnosticExportedMessage(filename),
  };
}

export function diagnosticExportFailureNotification(error: unknown) {
  return {
    title: DIAGNOSTICS_EXPORT_REPORT_FAILED_TITLE,
    body: diagnosticExportFailureMessage(error),
  };
}
