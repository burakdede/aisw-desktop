import { countLabel } from "../../lib/utils";
import { UNAVAILABLE_LABEL } from "../../lib/status-copy";
import {
  DIAGNOSTICS_EXPORT_REPORT_FAILED_MESSAGE,
  DIAGNOSTICS_HEALTHY_PRIMARY_DETAIL,
  DIAGNOSTICS_HEALTHY_TITLE,
} from "./diagnostics-copy";

type DiagnosticBundleResult = {
  filename: string;
  path: string;
};

const VERIFIED_NOW_THRESHOLD_SECONDS = 10;
const VERIFIED_MINUTE_SECONDS = 60;
const VERIFIED_HOUR_MINUTES = 60;
const VERIFIED_DAY_HOURS = 24;

function pluralNeeds(count: number) {
  return count === 1 ? "needs" : "need";
}

function pluralRequires(count: number) {
  return count === 1 ? "requires" : "require";
}

export function buildDiagnosticsSummary(totalIssues: number, repairCount: number) {
  const remainingIssues = Math.max(totalIssues - repairCount, 0);
  return {
    title: totalIssues
      ? `${countLabel(totalIssues, "issue")} ${pluralNeeds(totalIssues)} attention`
      : DIAGNOSTICS_HEALTHY_TITLE,
    detail: totalIssues
      ? `${countLabel(repairCount, "repair")} can be applied safely. ${countLabel(
          remainingIssues,
          "issue",
        )} ${pluralRequires(remainingIssues)} a decision.`
      : DIAGNOSTICS_HEALTHY_PRIMARY_DETAIL,
  };
}

export function formatRelativeVerifiedTime(timestamp: number, nowMs = Date.now()) {
  if (!timestamp) {
    return UNAVAILABLE_LABEL;
  }

  const diffMs = Math.max(nowMs - timestamp, 0);
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < VERIFIED_NOW_THRESHOLD_SECONDS) {
    return "just now";
  }
  if (diffSeconds < VERIFIED_MINUTE_SECONDS) {
    return `${diffSeconds} sec ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / VERIFIED_MINUTE_SECONDS);
  if (diffMinutes < VERIFIED_HOUR_MINUTES) {
    return `${diffMinutes} min ago`;
  }

  const diffHours = Math.floor(diffMinutes / VERIFIED_HOUR_MINUTES);
  if (diffHours < VERIFIED_DAY_HOURS) {
    return `${diffHours} hr ago`;
  }

  const diffDays = Math.floor(diffHours / VERIFIED_DAY_HOURS);
  return `${countLabel(diffDays, "day")} ago`;
}

export function buildDiagnosticsStatusMessage(input: {
  bundleCopyMessage: string;
  exportedBundle?: DiagnosticBundleResult | null;
  exportErrorMessage?: string;
  appliedFixCount?: number;
}) {
  if (input.bundleCopyMessage) {
    return input.bundleCopyMessage;
  }

  if (input.exportedBundle) {
    return `Support report ready: ${input.exportedBundle.filename}. ${input.exportedBundle.path}`;
  }

  if (input.exportErrorMessage) {
    return input.exportErrorMessage;
  }

  if (typeof input.appliedFixCount === "number") {
    return `Applied ${countLabel(input.appliedFixCount, "safe fix", "safe fixes")}.`;
  }

  return "";
}
