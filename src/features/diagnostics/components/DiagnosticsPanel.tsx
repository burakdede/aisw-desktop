import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "../../../components/SectionCard";
import { runDoctor, runRepair, runVerify } from "../../../lib/client";
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

export function DiagnosticsPanel() {
  const queryClient = useQueryClient();
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
