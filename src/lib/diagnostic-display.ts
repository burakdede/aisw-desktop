import type { IssueCardData, SummaryCardData } from "../features/diagnostics/diagnostic-parsers";
import type { AppSnapshot, ToolStatus } from "./schemas";
import { isSupportedTool } from "./tool-registry";
import { toolDisplayName } from "./tool-display";

export type DiagnosticCheckRow = {
  label: string;
  detail: string;
  status: "pass" | "warn" | "fail";
};

export function diagnosticFindingTitle(
  card: IssueCardData,
  snapshot: AppSnapshot | undefined,
) {
  const tool = resolveDiagnosticTool(card.title);
  if (tool) {
    const status = snapshot?.statuses.find((entry) => entry.tool === tool);
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

  const normalized = card.title.trim().toLowerCase();
  if (normalized.includes("permission")) {
    return "Permissions incorrect";
  }
  if (normalized.includes("keyring")) {
    return "Keyring unavailable";
  }
  if (normalized.includes("oauth")) {
    return "OAuth failure";
  }
  if (normalized.includes("shell")) {
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

function resolveDiagnosticTool(title: string) {
  const normalized = title.trim().toLowerCase();
  const candidate = normalized.startsWith("tool/") ? normalized.slice("tool/".length) : normalized;
  return isSupportedTool(candidate) ? candidate : null;
}

function normalizeDiagnosticStatus(status: string) {
  return status === "fail" ? "fail" : status === "warn" ? "warn" : "pass";
}
