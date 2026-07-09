import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "../../../components/SectionCard";
import { AppSnapshot, ToolStatus } from "../../../lib/schemas";
import { runDoctor, runRepair, runVerify } from "../../../lib/client";
import { openExternalGuide, installGuideUrlForTool } from "../../../lib/tool-guidance";
import { useDesktop } from "../../shared/useDesktop";
import { useDesktopActions } from "../../shared/useDesktopActions";
import {
  parseDoctorIssues,
  parseDoctorSummary,
  parseRepairActions,
  parseRepairSummary,
  parseVerifyIssues,
  parseVerifySummary,
  type IssueCardData,
  type SummaryCardData,
} from "../diagnostic-parsers";
import { parseWorkspaceStatus } from "../../workspaces/workspace-parsers";

export function DiagnosticsPanel() {
  const { snapshot } = useDesktop();
  const queryClient = useQueryClient();
  const { useProfileMutation, useContextMutation, mutationLock } = useDesktopActions();
  const doctor = useQuery({ queryKey: ["doctor"], queryFn: runDoctor });
  const verify = useQuery({ queryKey: ["verify"], queryFn: runVerify });
  const repair = useQuery({
    queryKey: ["repair", "dry-run"],
    queryFn: () => runRepair({ apply: false, fixes: [] }),
  });
  const applyRepair = useMutation({
    mutationFn: () => runRepair({ apply: true, fixes: [] }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["repair", "dry-run"] });
      await queryClient.invalidateQueries({ queryKey: ["doctor"] });
      await queryClient.invalidateQueries({ queryKey: ["verify"] });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });

  const summaryCards: SummaryCardData[] = [
    parseDoctorSummary(doctor.data),
    parseVerifySummary(verify.data),
    parseRepairSummary(repair.data),
  ];
  const issueCards: IssueCardData[] = [
    ...parseDoctorIssues(doctor.data),
    ...parseVerifyIssues(verify.data),
  ];
  const repairActions = parseRepairActions(repair.data);
  const quickFixes = buildQuickFixes(snapshot.data, useProfileMutation.mutate, useContextMutation.mutate);

  return (
    <SectionCard
      title="Diagnostics"
      kicker="Doctor · Verify · Repair"
      actions={
        <div className="button-row">
          <button
            className="ghost-button"
            onClick={() => {
              void doctor.refetch();
              void verify.refetch();
              void repair.refetch();
            }}
          >
            Refresh diagnostics
          </button>
          <button
            className="primary-button"
            onClick={() => applyRepair.mutate()}
            disabled={applyRepair.isPending || !repairActions.length}
          >
            {applyRepair.isPending ? "Applying repairs…" : "Apply safe repairs"}
          </button>
        </div>
      }
    >
      <div className="panel-grid panel-grid-3">
        {summaryCards.map((card) => (
          <article key={card.title} className={`diagnostic-card diagnostic-${card.status}`}>
            <h3>{card.title}</h3>
            <p className="diagnostic-status">{card.status}</p>
            {card.lines.map((line) => (
              <p key={line} className="inline-note">
                {line}
              </p>
            ))}
          </article>
        ))}
      </div>

      {applyRepair.data ? (
        <article className="diagnostic-card diagnostic-pass diagnostics-body">
          <h3>Last applied repair</h3>
          <p className="diagnostic-status">
            {String(
              ((applyRepair.data.result as { summary?: { status?: string } } | undefined)
                ?.summary?.status ?? "unknown"),
            )}
          </p>
          <p className="inline-note">
            {String(
              ((applyRepair.data.result as {
                summary?: { actions_applied?: number };
              } | undefined)?.summary?.actions_applied ?? 0),
            )}{" "}
            actions applied
          </p>
          <p className="inline-note">
            {String(
              ((applyRepair.data.result as {
                summary?: { issues_remaining?: number };
              } | undefined)?.summary?.issues_remaining ?? 0),
            )}{" "}
            issues remaining
          </p>
        </article>
      ) : null}

      <div className="panel-grid panel-grid-2 diagnostics-body">
        <div className="stack-list">
          <h3>Issues and remediation</h3>
          {issueCards.map((card) => (
            <article key={`${card.title}-${card.status}`} className={`diagnostic-card diagnostic-${card.status}`}>
              <h4>{card.title}</h4>
              {card.issues.map((issue) => (
                <p key={issue} className="inline-note">
                  {issue}
                </p>
              ))}
              {card.remediation.length ? (
                <div className="diagnostic-remediation">
                  {card.remediation.map((item) => (
                    <code key={item}>{item}</code>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {!issueCards.length ? (
            <p className="inline-note">No failing or warning diagnostics are currently reported.</p>
          ) : null}
        </div>

        <div className="stack-list">
          <h3>Direct fixes</h3>
          {quickFixes.map((fix) => (
            <article key={fix.title} className={`diagnostic-card diagnostic-${fix.status}`}>
              <h4>{fix.title}</h4>
              <p className="inline-note">{fix.detail}</p>
              <div className="button-row">
                <button
                  className={fix.primary ? "primary-button" : "ghost-button"}
                  type="button"
                  disabled={mutationLock.isBusy}
                  onClick={fix.action}
                >
                  {fix.label}
                </button>
              </div>
            </article>
          ))}
          {!quickFixes.length ? (
            <p className="inline-note">No direct fix actions are available from the current diagnostics state.</p>
          ) : null}
        </div>

        <div className="stack-list">
          <h3>Planned repair actions</h3>
          {repairActions.map((action) => (
            <article key={`${action.title}-${action.detail}`} className="diagnostic-card">
              <h4>{action.title}</h4>
              <p className="inline-note">{action.detail}</p>
              <p className="diagnostic-status">{action.status}</p>
            </article>
          ))}
          {!repairActions.length ? (
            <p className="inline-note">No safe automatic repairs are currently planned.</p>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

type QuickFixCard = {
  title: string;
  detail: string;
  label: string;
  status: "warn" | "fail";
  primary?: boolean;
  action: () => void;
};

function buildQuickFixes(
  snapshot: AppSnapshot | undefined,
  useProfile: (request: { tool: string; profile: string; stateMode: string | null }) => void,
  useContext: (request: { context: string; stateMode: string | null }) => void,
): QuickFixCard[] {
  if (!snapshot) {
    return [];
  }

  const fixes: QuickFixCard[] = [];

  snapshot.statuses.forEach((status) => {
    if (!status.binary_found) {
      fixes.push({
        title: `${status.tool} is missing`,
        detail: `Open the install guide for ${status.tool} and then refresh diagnostics.`,
        label: "Open installation guide",
        status: "warn",
        action: () => openExternalGuide(installGuideUrlForTool(status.tool)),
      });
    }

    if (status.active_profile && status.active_profile_applied === false) {
      fixes.push({
        title: `${status.tool} live mismatch`,
        detail: `Re-apply ${status.active_profile} so the live credentials match AISW again.`,
        label: `Re-apply ${status.active_profile}`,
        status: "fail",
        primary: true,
        action: () =>
          useProfile({
            tool: status.tool,
            profile: status.active_profile!,
            stateMode: resolveStateMode(status),
          }),
      });
    }
  });

  const workspace = parseWorkspaceStatus(snapshot.workspace_status ?? undefined);
  const hasWorkspaceMismatch =
    workspace.status === "mismatch" &&
    workspace.expectedContext !== "none" &&
    workspace.expectedContext !== workspace.currentContext;

  if (hasWorkspaceMismatch) {
    fixes.push({
      title: "Workspace context mismatch",
      detail: `This folder wants ${workspace.expectedContext}, but ${workspace.currentContext} is currently active.`,
      label: "Use expected context now",
      status: "warn",
      primary: true,
      action: () =>
        useContext({
          context: workspace.expectedContext,
          stateMode: "isolated",
        }),
    });
  }

  return fixes;
}

function resolveStateMode(status: ToolStatus) {
  if (status.tool === "gemini") {
    return null;
  }
  return status.state_mode ?? "isolated";
}
