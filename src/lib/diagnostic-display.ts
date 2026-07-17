import type { IssueCardData, SummaryCardData } from "../features/diagnostics/diagnostic-parsers";
import {
  diagnosticTitleHas,
  diagnosticTitleTool,
} from "../features/diagnostics/diagnostic-title-match";
import type { AppSnapshot, ToolStatus } from "./schemas";
import { findSnapshotToolStatus } from "./profile-display";
import { toolDisplayName } from "./tool-display";
import {
  normalizeResolvedCheckStatus,
  type ResolvedCheckStatus,
} from "./check-status";

export type DiagnosticCheckRow = {
  label: string;
  detail: string;
  status: ResolvedCheckStatus;
};

export function diagnosticFindingTitle(
  card: IssueCardData,
  snapshot: AppSnapshot | undefined,
) {
  const tool = diagnosticTitleTool(card.title);
  if (tool) {
    const status = snapshot ? findSnapshotToolStatus(snapshot, tool) : null;
    if (status && status.binary_found === false) {
      return `${tool} is missing`;
    }
    if (
      status?.active_profile_applied === false ||
      card.remediation.some((item) => item.toLowerCase().includes("re-apply"))
    ) {
      return `${tool} live mismatch`;
    }
  }

  if (diagnosticTitleHas(card.title, "permission")) {
    return "Permissions incorrect";
  }
  if (diagnosticTitleHas(card.title, "keyring")) {
    return "Keyring unavailable";
  }
  if (diagnosticTitleHas(card.title, "oauth")) {
    return "OAuth failure";
  }
  if (diagnosticTitleHas(card.title, "shell")) {
    return "Shell hook not installed";
  }

  return card.title;
}

export function diagnosticCheckRows(
  summaryCards: SummaryCardData[],
  snapshot: AppSnapshot | undefined,
): DiagnosticCheckRow[] {
  const rows: DiagnosticCheckRow[] = summaryCards.map((card) => ({
    label: card.title,
    detail: card.lines.join(" · "),
    status: normalizeDiagnosticStatus(card.status),
  }));

  snapshot?.statuses.forEach((status) => {
    if (!status.binary_found) {
      rows.push({
        label: `${toolDisplayName(status.tool)} availability`,
        detail: `${toolDisplayName(status.tool)} is not installed on this computer yet.`,
        status: "warn",
      });
      return;
    }

    if (status.active_profile_applied === false) {
      rows.push({
        label: `${toolDisplayName(status.tool)} live match`,
        detail: `${toolDisplayName(status.tool)} no longer matches the active saved profile.`,
        status: "warn",
      });
      return;
    }

    rows.push({
      label: `${toolDisplayName(status.tool)} status`,
      detail: status.active_profile
        ? `${diagnosticToolStatusLabel(status)} is ready.`
        : `${toolDisplayName(status.tool)} is installed, but no saved profile is configured yet.`,
      status: status.active_profile ? "pass" : "warn",
    });
  });

  return rows;
}

export function diagnosticToolStatusLabel(status: ToolStatus) {
  return `${toolDisplayName(status.tool)}${
    status.active_profile ? ` is using ${status.active_profile}` : ""
  }`;
}

function normalizeDiagnosticStatus(status: string) {
  return normalizeResolvedCheckStatus(status);
}
