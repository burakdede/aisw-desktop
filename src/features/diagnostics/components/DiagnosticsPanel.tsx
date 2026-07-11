import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SplitView } from "../../../components/SplitView";
import { SectionCard } from "../../../components/SectionCard";
import { AppBootstrap, AppSnapshot, DesktopSettings, ToolStatus } from "../../../lib/schemas";
import { exportDiagnosticBundle, runDoctor, runRepair, runVerify } from "../../../lib/client";
import { openExternalGuide, installGuideUrlForTool } from "../../../lib/tool-guidance";
import { useLastCommandResults } from "../../shared/lastCommandResult";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import { normalizeTerminalIntegrationText } from "../../shared/terminal-integration-language";
import {
  preferredProfileImportMode,
  supportsProfileImportMode,
  type ProfileImportMode,
} from "../../shared/profile-capabilities";
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
import { resolveWorkspaceActivationTarget } from "../../workspaces/workspace-activation";
import { contextDisplayLabel, toolProfileDisplayLabel } from "../../../lib/profile-display";
import { toolDisplayName } from "../../../lib/tool-display";
import { titleCase } from "../../../lib/utils";
import type { SettingsSection } from "../../settings/components/SettingsPanel";

const SUPPORTED_TOOLS = new Set(["claude", "codex", "gemini"]);

export function DiagnosticsPanel({
  settings,
  snapshot,
  toolCapabilities,
  onOpenProfiles,
  onOpenSettings,
  onOpenContexts,
  onOpenProfileSetup,
}: {
  settings: DesktopSettings;
  snapshot: AppSnapshot;
  toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
  onOpenProfiles: (tool: string, expandedProfile?: string | null) => void;
  onOpenSettings: (section?: SettingsSection) => void;
  onOpenContexts: () => void;
  onOpenProfileSetup: (options?: {
    tool?: string;
    mode?: ProfileImportMode;
    credentialBackend?: "file" | "system-keyring" | null;
  }) => void;
}) {
  const queryClient = useQueryClient();
  const {
    addProfileMutation,
    useProfileMutation,
    useContextMutation,
    activateProfileSetMutation,
    activateWorkspaceTargetMutation,
    mutationLock,
  } =
    useDesktopActions();
  const lastCommandResults = useLastCommandResults();
  const readEnabled = useMutationAwareQueryEnabled();
  const doctor = useQuery({ queryKey: ["doctor"], queryFn: runDoctor, enabled: readEnabled });
  const verify = useQuery({ queryKey: ["verify"], queryFn: runVerify, enabled: readEnabled });
  const repair = useQuery({
    queryKey: ["repair", "dry-run"],
    queryFn: () => runRepair({ apply: false, fixes: [] }),
    enabled: readEnabled,
  });
  const [importDrafts, setImportDrafts] = useState<Record<string, string>>({});
  const [bundleCopyMessage, setBundleCopyMessage] = useState("");
  const [selectedFindingKey, setSelectedFindingKey] = useState<string | null>(null);
  const [repairPlanOpen, setRepairPlanOpen] = useState(false);
  const applyRepair = useMutation({
    mutationFn: (fixes: string[]) => runRepair({ apply: true, fixes }),
    onSuccess: async () => {
      setRepairPlanOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["repair", "dry-run"] });
      await queryClient.invalidateQueries({ queryKey: ["doctor"] });
      await queryClient.invalidateQueries({ queryKey: ["verify"] });
      await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
      await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
  const exportBundle = useMutation({
    mutationFn: exportDiagnosticBundle,
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
  const recentFailures = buildRecentFailureCards(lastCommandResults, snapshot);
  const findings = useMemo(
    () => buildDiagnosticFindings(issueCards, recentFailures, snapshot),
    [issueCards, recentFailures, snapshot],
  );
  const quickFixes = buildQuickFixes({
    snapshot,
    doctor: doctor.data,
    repair: repair.data,
    settings,
    toolCapabilities,
    useProfile: useProfileMutation.mutate,
    useContext: useContextMutation.mutate,
    activateProfileSet: activateProfileSetMutation.mutate,
    activateWorkspaceTarget: activateWorkspaceTargetMutation.mutate,
    applyRepairFixes: (fixes) => applyRepair.mutate(fixes),
    onOpenSettings,
    onOpenContexts,
    onOpenProfileSetup,
    onRefreshDiagnostics: () =>
      void refreshDiagnostics(queryClient, doctor.refetch, verify.refetch, repair.refetch),
  });
  const totalIssues = issueCards.length + recentFailures.length;
  const summaryHighlights = [
    ...quickFixes.slice(0, 2).map((fix) => fix.title),
    ...issueCards.flatMap((card) => card.issues).slice(0, 2),
    ...recentFailures.slice(0, 1).map((failure) => failure.title),
  ].slice(0, 3);
  const diagnosticPills = buildDiagnosticPills({
    totalIssues,
    repairCount: repairActions.length,
    exportReady: Boolean(exportBundle.data),
  });
  const checkRows = useMemo(
    () => buildDiagnosticCheckRows(summaryCards, snapshot),
    [snapshot, summaryCards],
  );
  useEffect(() => {
    if (selectedFindingKey && findings.some((finding) => finding.key === selectedFindingKey)) {
      return;
    }
    setSelectedFindingKey(findings[0]?.key ?? null);
  }, [findings, selectedFindingKey]);
  const selectedFinding =
    findings.find((finding) => finding.key === selectedFindingKey) ?? findings[0] ?? null;

  return (
    <SectionCard
      title="Diagnostics"
      kicker="Checks and recovery"
      actions={
        <div className="button-row">
          <button
            className="ghost-button"
            disabled={mutationLock.isBusy}
            onClick={() =>
              void refreshDiagnostics(queryClient, doctor.refetch, verify.refetch, repair.refetch)
            }
          >
            Refresh Checks
          </button>
          <button
            className="ghost-button"
            onClick={() => setRepairPlanOpen(true)}
            disabled={applyRepair.isPending || !repairActions.length}
          >
            {applyRepair.isPending ? "Applying Repairs…" : "Review Repair Plan"}
          </button>
          <button
            className="ghost-button"
            onClick={() => exportBundle.mutate()}
            disabled={exportBundle.isPending}
          >
            {exportBundle.isPending ? "Exporting Report…" : "Export Report"}
          </button>
        </div>
      }
    >
      {exportBundle.data ? (
        <article className="diagnostic-card diagnostic-pass diagnostics-body">
          <h3>Support report ready</h3>
          <p className="inline-note">{exportBundle.data.filename}</p>
          <p className="inline-note">{exportBundle.data.path}</p>
          <div className="button-row">
            <button
              className="ghost-button"
              type="button"
              onClick={() => void copyBundlePath(exportBundle.data.path, setBundleCopyMessage)}
            >
              Copy report path
            </button>
          </div>
          {bundleCopyMessage ? <p className="inline-note">{bundleCopyMessage}</p> : null}
        </article>
      ) : null}
      {exportBundle.error ? (
        <article className="diagnostic-card diagnostic-fail diagnostics-body">
          <h3>Support report could not be exported</h3>
          <p className="inline-note">
            {exportBundle.error instanceof Error
              ? exportBundle.error.message
              : "Support report export failed."}
          </p>
        </article>
      ) : null}

      {applyRepair.data ? (
        <article className="diagnostic-card diagnostic-pass diagnostics-body">
          <h3>Last repair run</h3>
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

      <SplitView
        className="diagnostics-layout diagnostics-body"
        primaryClassName="diagnostics-checks-pane"
        secondaryClassName="diagnostics-recovery-pane"
        primary={
          <div className="stack-list desktop-pane-column">
            <article className={`diagnostic-card diagnostics-check-card ${totalIssues ? "diagnostic-warn" : "diagnostic-pass"}`}>
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Health</p>
                  <h3>{totalIssues ? `${totalIssues} issue${totalIssues === 1 ? "" : "s"} found` : "System looks healthy"}</h3>
                </div>
                <span className={`pill ${totalIssues ? "pill-warn" : "pill-ok"}`}>
                  {repairActions.length ? `${repairActions.length} repairs queued` : "Recovery ready"}
                </span>
              </div>
              <p className="inline-note">
                Health checks, live matching, and repair stay in one recovery surface so switching issues
                use one consistent flow.
              </p>
              <div className="diagnostics-overview-meta">
                <div>
                  <span className="overview-current-set-cell-label">Checks</span>
                  <strong>{checkRows.length} monitored</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Recovery</span>
                  <strong>{repairActions.length ? `${repairActions.length} safe repair${repairActions.length === 1 ? "" : "s"}` : "No repairs queued"}</strong>
                </div>
                <div>
                  <span className="overview-current-set-cell-label">Highlights</span>
                  <strong>{diagnosticPills.join(" · ") || "Quick actions"}</strong>
                </div>
              </div>
              {summaryHighlights.length ? (
                <div className="stack-list diagnostics-overview-list">
                  {summaryHighlights.map((line) => (
                    <p key={line} className="inline-note">{line}</p>
                  ))}
                </div>
              ) : (
                <p className="inline-note">
                  Active profiles, local storage, and repair checks are currently passing.
                </p>
              )}
              <div className="diagnostics-check-summary">
                {summaryCards.map((card) => (
                  <div key={card.title} className={`diagnostics-check-summary-cell diagnostic-${card.status}`}>
                    <strong>{card.title}</strong>
                    <span className={`pill ${card.status === "pass" ? "pill-ok" : "pill-warn"}`}>
                      {card.status}
                    </span>
                    <p className="inline-note">{card.lines[0]}</p>
                  </div>
                ))}
              </div>
              <div className="diagnostics-check-list" aria-label="Diagnostics checks">
                {checkRows.map((row) => (
                  <div key={row.label} className="diagnostics-check-row">
                    <span
                      className={`diagnostics-check-indicator diagnostics-check-indicator-${row.status}`}
                      aria-hidden="true"
                    >
                      {row.status === "pass" ? "✓" : row.status === "warn" ? "▲" : "●"}
                    </span>
                    <div className="diagnostics-check-copy">
                      <strong>{row.label}</strong>
                      <p className="inline-note">{row.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <div className="desktop-pane-section desktop-list-surface">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Findings</p>
                  <h3>Checks and details</h3>
                </div>
                <p className="inline-note">
                  Select a finding to inspect the failing details before you apply a recovery action.
                </p>
              </div>
            </div>
            {findings.length ? (
              <div className="stack-list desktop-list-stack">
                {findings.map((finding) => (
                  <button
                    key={finding.key}
                    type="button"
                    aria-label={`Inspect ${finding.title}`}
                    aria-pressed={selectedFinding?.key === finding.key}
                    className={`list-row diagnostic-finding-row ${
                      selectedFinding?.key === finding.key ? "diagnostic-finding-row-selected" : ""
                    }`}
                    onClick={() => setSelectedFindingKey(finding.key)}
                  >
                    <div className="diagnostic-finding-main">
                      <div className="diagnostic-finding-title">
                        <strong>{finding.title}</strong>
                        <span className={`pill ${finding.status === "fail" ? "pill-warn" : "pill-soft"}`}>
                          {finding.countLabel}
                        </span>
                      </div>
                      <p className="inline-note">{finding.preview}</p>
                    </div>
                    <div className="diagnostic-finding-meta">
                      <span>{finding.scopeLabel}</span>
                    </div>
                    <span className="diagnostic-finding-chevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <article className="diagnostic-card diagnostic-pass">
                <h3>Everything looks good</h3>
                <p className="inline-note">All configured tools match their active desktop profiles.</p>
              </article>
            )}
          </div>
        }
        secondary={
          <div className="stack-list desktop-pane-column">
            {selectedFinding ? (
              <article className={`diagnostic-card diagnostic-${selectedFinding.status}`}>
                <div className="desktop-pane-section-header">
                  <div>
                    <p className="card-kicker">Inspector</p>
                    <h3>{selectedFinding.title}</h3>
                  </div>
                  <span className={`pill ${selectedFinding.status === "fail" ? "pill-warn" : "pill-soft"}`}>
                    {selectedFinding.scopeLabel}
                  </span>
                </div>
                <div className="diagnostics-inspector-section">
                  <p className="card-kicker">What this means</p>
                {selectedFinding.lines.map((line) => (
                  <p key={line} className="inline-note">
                    {normalizeRuntimeLanguage(line)}
                  </p>
                ))}
                </div>
                {selectedFinding.remediation.length ? (
                  <div className="diagnostics-inspector-section">
                    <p className="card-kicker">Recommended fix</p>
                    <div className="diagnostic-remediation">
                    {selectedFinding.remediation.map((item) => (
                      <code key={item}>{item}</code>
                    ))}
                    </div>
                  </div>
                ) : null}
                {selectedFinding.profileTarget ? (
                  <div className="button-row">
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() =>
                        onOpenProfiles(
                          selectedFinding.profileTarget!.tool,
                          selectedFinding.profileTarget!.profile,
                        )
                      }
                    >
                      Open profile
                    </button>
                  </div>
                ) : null}
              </article>
            ) : (
              <article className="diagnostic-card diagnostic-pass">
                <h3>Everything looks good</h3>
                <p className="inline-note">
                  Active profiles, local storage, and repair checks are currently passing.
                </p>
              </article>
            )}
            <article className="diagnostic-card diagnostics-recovery-intro">
              <div className="desktop-pane-section-header">
                <div>
                  <p className="card-kicker">Recovery</p>
                  <h3>Recommended fixes</h3>
                </div>
              </div>
              <p className="inline-note">
                Apply the safest repair path first, then refresh checks from this pane.
              </p>
            </article>
            {quickFixes.map((fix) => (
              <article key={quickFixKey(fix)} className={`diagnostic-card diagnostic-${fix.status}`}>
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
                  {fix.secondaryAction ? (
                    <button
                      className="ghost-button"
                      type="button"
                      disabled={mutationLock.isBusy}
                      onClick={() => void fix.secondaryAction?.action()}
                    >
                      {fix.secondaryAction?.label}
                    </button>
                  ) : null}
                  {fix.profileTarget ? (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => onOpenProfiles(fix.profileTarget!.tool, fix.profileTarget!.profile)}
                    >
                      Open profile
                    </button>
                  ) : null}
                </div>
                {fix.importTarget ? (
                  supportsProfileImportMode(fix.importTarget.tool, toolCapabilities, "from_live") ? (
                    <div className="inline-form">
                      <input
                        aria-label={`import ${fix.importTarget.tool} current login from diagnostics`}
                        placeholder="new profile name"
                        value={importDrafts[quickFixKey(fix)] ?? ""}
                        onChange={(event) =>
                          setImportDrafts((current) => ({
                            ...current,
                            [quickFixKey(fix)]: event.target.value,
                          }))
                        }
                      />
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={mutationLock.isBusy || !importDrafts[quickFixKey(fix)]?.trim()}
                        onClick={() => {
                          const profile = importDrafts[quickFixKey(fix)]?.trim();
                          if (!profile) return;
                          addProfileMutation.mutate(
                            {
                              tool: fix.importTarget!.tool,
                              profile,
                              label: titleCase(profile),
                              stateMode: fix.importTarget!.stateMode,
                              importMode: { kind: "from_live" },
                            },
                            {
                              onSuccess: () =>
                                setImportDrafts((current) => ({
                                  ...current,
                                  [quickFixKey(fix)]: "",
                                })),
                            },
                          );
                        }}
                      >
                        Import current as new
                      </button>
                    </div>
                  ) : (
                    <div className="stack-list">
                      <p className="inline-note">
                        This AI Switch release cannot import the current {toolDisplayName(fix.importTarget.tool)} login
                        directly. Open profile setup to choose another sign-in method.
                      </p>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() =>
                          onOpenProfileSetup({
                            tool: fix.importTarget?.tool,
                            mode:
                              fix.importFallbackMode ??
                              preferredProfileImportMode(fix.importTarget!.tool, toolCapabilities, "from_live"),
                          })
                        }
                      >
                        Open profile setup
                      </button>
                    </div>
                  )
                ) : null}
              </article>
            ))}
            {!quickFixes.length ? (
              <p className="inline-note">No direct recovery actions are available from the current diagnostics state.</p>
            ) : null}
            <article className="diagnostic-card diagnostics-repair-plan-card">
              <div className="desktop-pane-section-header diagnostics-subsection-header">
                <div>
                  <p className="card-kicker">Repair plan</p>
                  <h3>Safe automatic repairs</h3>
                </div>
                <p className="inline-note">
                  Review the planned safe repairs before applying them.
                </p>
              </div>
              <div className="stack-list">
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
            </article>

            <article className="diagnostic-card diagnostics-history-card">
              <div className="desktop-pane-section-header diagnostics-subsection-header">
                <div>
                  <p className="card-kicker">History</p>
                  <h3>Recent problems</h3>
                </div>
              </div>
              <div className="stack-list">
                {recentFailures.map((failure) => (
                  <article key={failure.key} className="diagnostic-card diagnostic-fail">
                    <h4>{failure.title}</h4>
                    <p className="inline-note">{failure.message}</p>
                    {failure.remediation ? <p className="inline-note">{failure.remediation}</p> : null}
                    {failure.profileTarget ? (
                      <div className="button-row">
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => onOpenProfiles(failure.profileTarget!.tool, failure.profileTarget!.profile)}
                        >
                          Open profile
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
                {!recentFailures.length ? (
                  <p className="inline-note">No recent command failures are recorded in this session.</p>
                ) : null}
              </div>
            </article>
          </div>
        }
      />
      {repairPlanOpen ? (
        <div className="quick-switch-overlay" role="presentation" onClick={() => setRepairPlanOpen(false)}>
          <section
            className="quick-switch-palette profile-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Apply Safe Repairs"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">Repair plan</p>
                <h3>Apply safe repairs</h3>
                <p className="inline-note">
                  AI Switch only applies repairs that do not switch accounts or overwrite stored profiles.
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setRepairPlanOpen(false)}>
                Close
              </button>
            </div>
            {repairActions.length ? (
              <div className="stack-list">
                {repairActions.map((action) => (
                  <article key={`sheet-${action.title}-${action.detail}`} className="diagnostic-card">
                    <h4>{action.title}</h4>
                    <p className="inline-note">{action.detail}</p>
                    <p className="diagnostic-status">{action.status}</p>
                  </article>
                ))}
              </div>
            ) : (
              <article className="diagnostic-card diagnostic-pass">
                <h3>No safe repairs queued</h3>
                <p className="inline-note">
                  Diagnostics did not find any safe automatic repairs to apply right now.
                </p>
              </article>
            )}
            <footer className="quick-switch-footer">
              <div className="quick-switch-selection">
                <p className="card-kicker">Repairs</p>
                <strong>{repairActions.length} planned</strong>
                <p>Profile re-apply, restore, and removal actions still require their own explicit flow.</p>
              </div>
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={() => setRepairPlanOpen(false)}>
                  Cancel
                </button>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!repairActions.length || applyRepair.isPending}
                  onClick={() => applyRepair.mutate([])}
                >
                  {applyRepair.isPending ? "Applying Repairs…" : "Apply Safe Repairs"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </SectionCard>
  );
}

type DiagnosticCheckRow = {
  label: string;
  detail: string;
  status: "pass" | "warn" | "fail";
};

type QuickFixCard = {
  title: string;
  detail: string;
  label: string;
  status: "warn" | "fail";
  profileTarget?: { tool: string; profile: string | null };
  importTarget?: { tool: string; stateMode: string | null };
  importFallbackMode?: ProfileImportMode;
  primary?: boolean;
  disabled?: boolean;
  secondaryAction?: {
    label: string;
    action: () => void | Promise<void>;
  };
  action: () => void;
};

type DiagnosticFinding = {
  key: string;
  title: string;
  preview: string;
  lines: string[];
  remediation: string[];
  status: "warn" | "fail";
  scopeLabel: string;
  countLabel: string;
  profileTarget?: { tool: string; profile: string | null };
};

function buildDiagnosticFindings(
  issueCards: IssueCardData[],
  recentFailures: ReturnType<typeof buildRecentFailureCards>,
  snapshot: AppSnapshot | undefined,
): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = issueCards.map((card) => ({
    key: `issue-${card.title}-${card.status}`,
    title: card.title,
    preview: normalizeRuntimeLanguage(card.issues[0] ?? "Review diagnostic details."),
    lines: card.issues,
    remediation: card.remediation,
    status: card.status === "fail" ? "fail" : "warn",
    scopeLabel: "Check",
    countLabel: `${card.issues.length} detail${card.issues.length === 1 ? "" : "s"}`,
    profileTarget: snapshot ? resolveIssueProfileTarget(card, snapshot) ?? undefined : undefined,
  }));

  recentFailures.forEach((failure) => {
    findings.push({
      key: `failure-${failure.key}`,
      title: failure.title,
      preview: normalizeRuntimeLanguage(failure.message),
      lines: [failure.message],
      remediation: failure.remediation ? [failure.remediation] : [],
      status: "fail",
      scopeLabel: "Recent failure",
      countLabel: "History",
      profileTarget: failure.profileTarget,
    });
  });

  return findings;
}

function buildDiagnosticCheckRows(
  summaryCards: SummaryCardData[],
  snapshot: AppSnapshot | undefined,
): DiagnosticCheckRow[] {
  const rows: DiagnosticCheckRow[] = summaryCards.map((card) => ({
    label: card.title,
    detail: card.lines.join(" · "),
    status:
      card.status === "fail" ? "fail" : card.status === "warn" ? "warn" : "pass",
  }));

  snapshot?.statuses.forEach((status) => {
    if (!status.binary_found) {
      rows.push({
        label: `${toolDisplayName(status.tool)} availability`,
        detail: `${toolDisplayName(status.tool)} is not installed on this Mac yet.`,
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
        ? `${toolStatusDisplayLabel(status)} is ready.`
        : `${toolDisplayName(status.tool)} is installed, but no saved profile is configured yet.`,
      status: status.active_profile ? "pass" : "warn",
    });
  });

  return rows;
}

function toolStatusDisplayLabel(status: ToolStatus) {
  return `${toolDisplayName(status.tool)}${status.active_profile ? ` is using ${status.active_profile}` : ""}`;
}

function buildQuickFixes(
  {
    snapshot,
    doctor,
    repair,
    settings,
    toolCapabilities,
    useProfile,
    useContext,
    activateProfileSet,
    activateWorkspaceTarget,
    applyRepairFixes,
    onOpenSettings,
    onOpenContexts,
    onOpenProfileSetup,
    onRefreshDiagnostics,
  }: {
    snapshot: AppSnapshot | undefined;
    doctor: Record<string, unknown> | undefined;
    repair: Record<string, unknown> | undefined;
    settings: DesktopSettings;
    toolCapabilities: NonNullable<AppBootstrap["runtime_status"]["capabilities"]>["tools"];
    useProfile: (request: {
      tool: string;
      profile: string;
      stateMode: string | null;
      label?: string;
    }) => void;
    useContext: (request: { context: string; stateMode: string | null }) => void;
    activateProfileSet: (request: { name: string }) => void;
    activateWorkspaceTarget: (request: {
      kind: "profile_set";
      name: string;
      matchedTarget: string;
    } | {
      kind: "context";
      name: string;
      matchedTarget: string;
      stateMode: string | null;
    }) => void;
    applyRepairFixes: (fixes: string[]) => void;
    onOpenSettings: (section?: SettingsSection) => void;
    onOpenContexts: () => void;
    onOpenProfileSetup: (options?: {
      tool?: string;
      mode?: ProfileImportMode;
      credentialBackend?: "file" | "system-keyring" | null;
    }) => void;
    onRefreshDiagnostics: () => void;
  },
): QuickFixCard[] {
  const fixes: QuickFixCard[] = [];
  const repairFixMap = buildRepairFixMap(repair);

  for (const issue of repairableDoctorIssues(doctor, repairFixMap)) {
    fixes.push({
      title: issue.title,
      detail: issue.detail,
      label: issue.label,
      status: issue.status,
      primary: issue.primary,
      action: () => applyRepairFixes([issue.fix]),
    });
  }

  const shellHookIssue = shellHookDoctorIssue(doctor);
  if (shellHookIssue) {
    fixes.push({
      title: "Terminal integration not active",
      detail: shellHookIssue.detail,
      label: "Open terminal setup",
      status: shellHookIssue.status,
      action: () => onOpenSettings("shell"),
    });
  }

  const keyringIssue = keyringDoctorIssue(doctor);
  if (keyringIssue) {
    fixes.push({
      title: "Use file-backed storage",
      detail: "Open profile setup with file-backed credential storage preselected for the next import or add flow.",
      label: "Use file-backed storage",
      status: keyringIssue.status,
      action: () =>
        onOpenProfileSetup({
          mode: "from_live",
          credentialBackend: "file",
        }),
    });
    fixes.push({
      title: "Keyring setup instructions",
      detail: "Review the supported local keyring services for macOS, Windows, and Linux.",
      label: "Show keyring setup",
      status: keyringIssue.status,
      action: () => onOpenSettings("keyring"),
    });
  }

  if (!snapshot) {
    return fixes;
  }

  snapshot.statuses.forEach((status) => {
    if (!status.binary_found) {
      fixes.push({
        title: `${status.tool} is missing`,
        detail: `Open the install guide for ${status.tool} and then refresh diagnostics.`,
        label: "Open installation guide",
        status: "warn",
        action: () => openExternalGuide(installGuideUrlForTool(status.tool)),
        secondaryAction: {
          label: "Refresh diagnostics",
          action: onRefreshDiagnostics,
        },
      });
    }

    if (status.active_profile && status.active_profile_applied === false) {
      const profileLabel = toolProfileDisplayLabel(settings, snapshot, status.tool, status.active_profile);
      fixes.push({
        title: `${status.tool} live mismatch`,
        detail: `Re-apply ${profileLabel} so the live credentials match the saved profile again.`,
        label: `Re-apply ${profileLabel}`,
        status: "fail",
        profileTarget: {
          tool: status.tool,
          profile: status.active_profile,
        },
        importTarget: {
          tool: status.tool,
          stateMode: resolveStateMode(status),
        },
        importFallbackMode: preferredProfileImportMode(
          status.tool,
          toolCapabilities,
          "from_live",
        ),
        primary: true,
        action: () =>
          useProfile({
            tool: status.tool,
            profile: status.active_profile!,
            stateMode: resolveStateMode(status),
            label: profileLabel,
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
    const expectedContextLabel = contextDisplayLabel(settings, workspace.expectedContext);
    const currentContextLabel = contextDisplayLabel(settings, workspace.currentContext);
    const target = resolveWorkspaceActivationTarget(workspace.expectedContext, settings, snapshot);
    fixes.push({
      title: "Project set mismatch",
      detail: target
        ? `This folder wants ${expectedContextLabel}, but ${currentContextLabel} is currently active.`
        : `This folder wants ${expectedContextLabel}, but no matching imported set or ready saved set is currently available.`,
      label: target ? "Use expected set now" : "Set library",
      status: "warn",
      primary: true,
      action: () =>
        target
          ? activateWorkspaceTarget({
              ...target,
              matchedTarget: workspace.target,
            })
          : onOpenContexts(),
    });
  }

  return fixes;
}

function buildRepairFixMap(repair: Record<string, unknown> | undefined) {
  const result = asObject(repair?.result);
  return asArray(result?.actions)
    .map((action) => asObject(action))
    .filter((action): action is Record<string, unknown> => Boolean(action))
    .reduce((map, action) => {
      const fix = asStringValue(action.fix);
      if (fix) {
        map.set(fix.toLowerCase(), fix);
      }
      return map;
    }, new Map<string, string>());
}

function repairableDoctorIssues(
  doctor: Record<string, unknown> | undefined,
  repairFixMap: Map<string, string>,
): Array<{
  title: string;
  detail: string;
  label: string;
  fix: string;
  status: "warn" | "fail";
  primary?: boolean;
}> {
  return asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check))
    .flatMap((check) => {
      const name = asStringValue(check.name)?.toLowerCase() ?? "";
      const detail = asStringValue(check.detail) ?? "The desktop app reported an issue.";
      const status = (asStringValue(check.status) as "warn" | "fail" | undefined) ?? "warn";

      if (name.includes("keyring")) {
        return [doctorRepairFixCard(
          "Keyring unavailable",
          detail,
          "Apply keyring repair",
          status,
          repairFixMap.get("keyring") ?? "keyring",
        )];
      }
      if (name.includes("permission")) {
        return [doctorRepairFixCard(
          "Permission issue",
          detail,
          "Repair permissions",
          status,
          repairFixMap.get("permissions") ?? "permissions",
        )];
      }
      if (name.includes("oauth")) {
        return [doctorRepairFixCard(
          "OAuth failure",
          detail,
          "Retry OAuth repair",
          status,
          repairFixMap.get("oauth") ?? "oauth",
        )];
      }
      return [];
    });
}

function doctorRepairFixCard(
  title: string,
  detail: string,
  label: string,
  status: "warn" | "fail",
  fix: string,
) {
  return {
    title,
    detail,
    label,
    status,
    fix,
    primary: true,
  };
}

function shellHookDoctorIssue(doctor: Record<string, unknown> | undefined) {
  const checks = asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check));

  for (const check of checks) {
    const name = asStringValue(check.name)?.toLowerCase() ?? "";
    const detail = normalizeTerminalIntegrationText(
      asStringValue(check.detail) ?? "Terminal integration guidance needs attention.",
    );
    const status = (asStringValue(check.status) as "warn" | "fail" | undefined) ?? "warn";
    const detailText = detail.toLowerCase();
    if (
      (name.includes("shell") && name.includes("hook")) ||
      detailText.includes("shell hook") || detailText.includes("terminal integration")
    ) {
      return { detail, status };
    }
  }

  return null;
}

function keyringDoctorIssue(doctor: Record<string, unknown> | undefined) {
  const checks = asArray(doctor?.checks)
    .map((check) => asObject(check))
    .filter((check): check is Record<string, unknown> => Boolean(check));

  for (const check of checks) {
    const name = asStringValue(check.name)?.toLowerCase() ?? "";
    const detail = asStringValue(check.detail) ?? "Keyring access needs attention.";
    const status = (asStringValue(check.status) as "warn" | "fail" | undefined) ?? "warn";
    const detailText = detail.toLowerCase();
    if (name.includes("keyring") || detailText.includes("keyring")) {
      return { detail, status };
    }
  }

  return null;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringValue(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function resolveStateMode(status: ToolStatus) {
  if (status.tool === "gemini") {
    return null;
  }
  return status.state_mode ?? "isolated";
}

function resolveIssueProfileTarget(card: IssueCardData, snapshot: AppSnapshot) {
  const tool = resolveDiagnosticTool(card.title);
  if (!tool) {
    return null;
  }

  const status = snapshot.statuses.find((entry) => entry.tool === tool);
  const activeProfile = status?.active_profile ?? snapshot.profiles[tool]?.active ?? null;
  return {
    tool,
    profile: activeProfile,
  };
}

function resolveDiagnosticTool(title: string) {
  const normalized = title.trim().toLowerCase();
  const candidate = normalized.startsWith("tool/") ? normalized.slice("tool/".length) : normalized;
  return SUPPORTED_TOOLS.has(candidate) ? candidate : null;
}

function buildRecentFailureCards(
  lastCommandResults: ReturnType<typeof useLastCommandResults>,
  snapshot: AppSnapshot | undefined,
) {
  const failures: Array<{
    key: string;
    title: string;
    message: string;
    kind?: string;
    remediation?: string;
    at: number;
    profileTarget?: { tool: string; profile: string | null };
  }> = [];

  for (const [tool, result] of Object.entries(lastCommandResults.tool)) {
    if (!result || result.status !== "error") {
      continue;
    }
    const activeProfile =
      snapshot?.statuses.find((entry) => entry.tool === tool)?.active_profile ??
      snapshot?.profiles[tool]?.active ??
      null;
    failures.push({
      key: `tool:${tool}`,
      title: recentFailureTitle({
        kind: result.kind,
        scope: "tool",
        tool,
        label: result.label,
      }),
      message: result.message,
      kind: result.kind,
      remediation: result.remediation,
      at: result.at,
      profileTarget: { tool, profile: activeProfile },
    });
  }

  for (const [id, result] of Object.entries(lastCommandResults.global)) {
    if (!result || result.status !== "error") {
      continue;
    }
    failures.push({
      key: `global:${id}`,
      title: recentFailureTitle({
        kind: result.kind,
        scope: "global",
        id,
        label: result.label,
      }),
      message: result.message,
      kind: result.kind,
      remediation: result.remediation,
      at: result.at,
    });
  }

  return failures.sort((left, right) => right.at - left.at);
}

function buildDiagnosticPills({
  totalIssues,
  repairCount,
  exportReady,
}: {
  totalIssues: number;
  repairCount: number;
  exportReady: boolean;
}) {
  return [
    totalIssues ? `${totalIssues} active issue${totalIssues === 1 ? "" : "s"}` : "No active issues",
    repairCount ? `${repairCount} safe repair${repairCount === 1 ? "" : "s"}` : "Manual review only",
    exportReady ? "Report exported" : "Bundle export ready",
  ];
}

function recentFailureTitle(input: {
  kind?: string;
  scope: "tool" | "global";
  tool?: string;
  id?: string;
  label: string;
}) {
  switch (input.kind) {
    case "ToolMissing":
      return `${titleCase(input.tool ?? "Tool")} CLI missing`;
    case "ProfileMissing":
      return `${titleCase(input.tool ?? "Profile")} profile missing`;
    case "KeyringUnavailable":
      return `${titleCase(input.tool ?? "Credential")} keyring unavailable`;
    case "PermissionDenied":
      return "Permission issue";
    case "OAuthTimeout":
      return "OAuth timeout";
    case "ConfigLockTimeout":
      return "Config lock timeout";
    case "NonInteractiveMode":
      return "Non-interactive mode failure";
    case "InvalidStateMode":
      return input.tool === "gemini" ? "Gemini shared-mode failure" : "Unsupported state mode";
    default:
      if (input.scope === "global" && input.id === "backup") {
        return "Backup restore needs attention";
      }
      return input.tool ? `${titleCase(input.tool)} · ${input.label}` : input.label;
  }
}

function quickFixKey(fix: QuickFixCard) {
  return `${fix.title}:${fix.label}`;
}

async function refreshDiagnostics(
  queryClient: ReturnType<typeof useQueryClient>,
  refetchDoctor: () => Promise<unknown>,
  refetchVerify: () => Promise<unknown>,
  refetchRepair: () => Promise<unknown>,
) {
  await queryClient.invalidateQueries({ queryKey: ["bootstrap"] });
  await queryClient.invalidateQueries({ queryKey: ["snapshot"] });
  await Promise.all([refetchDoctor(), refetchVerify(), refetchRepair()]);
}

async function copyBundlePath(
  path: string,
  setMessage: (message: string) => void,
) {
  if (!navigator.clipboard?.writeText) {
    setMessage(`Clipboard access is unavailable. Copy the bundle path manually: ${path}`);
    return;
  }
  await navigator.clipboard.writeText(path);
  setMessage(`Copied bundle path ${path}.`);
}
