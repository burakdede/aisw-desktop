import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnchoredMenu } from "../../../components/AnchoredMenu";
import { DialogSurface } from "../../../components/DialogSurface";
import { SplitView } from "../../../components/SplitView";
import { useCompactLayout } from "../../../components/useCompactLayout";
import type {
  AppBootstrap,
  AppSnapshot,
  DesktopSettings,
  DoctorReport,
  RepairReport,
} from "../../../lib/schemas";
import { exportDiagnosticBundle, runDoctor, runRepair, runVerify } from "../../../lib/client";
import { DESKTOP_ACTION_COPY } from "../../../lib/desktop-action-copy";
import { DESKTOP_QUERY_KEYS } from "../../../lib/desktop-query-keys";
import { WIDE_PANEL_COMPACT_BREAKPOINT } from "../../../lib/layout";
import { useLastCommandResults } from "../../shared/lastCommandResult";
import { useDesktopActions } from "../../shared/useDesktopActions";
import { useMutationAwareQueryEnabled } from "../../shared/mutationQueue";
import { invalidateDiagnosticDesktopQueries } from "../../shared/postMutationRefresh";
import { normalizeRuntimeLanguage } from "../../shared/runtime-language";
import {
  DEFAULT_PROFILE_IMPORT_MODE,
  type ExplicitProfileCredentialBackend,
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
import { diagnosticCheckRows, type DiagnosticCheckRow } from "../../../lib/diagnostic-display";
import type { SettingsSection } from "../../../lib/settings-sections";
import {
  DIAGNOSTICS_PANEL_COPY,
  buildDiagnosticQuickFixModels,
  buildDiagnosticInspectorActions,
  buildDiagnosticFindings,
  buildDiagnosticsStatusMessage,
  buildDiagnosticsSummary,
  buildSelectedRepairFixes,
  buildRecentFailureCards,
  diagnosticBundlePathCopyMessage,
  diagnosticFindingAriaLabel,
  diagnosticInspectorStatusLabel,
  diagnosticsApplyRepairsLabel,
  diagnosticsPassedChecksSummary,
  diagnosticsRepairPlanSummary,
  diagnosticsRepairSelectionLabel,
  diagnosticTechnicalCommandBlock,
  diagnosticQuickFixKey,
  diagnosticRepairActionKey,
  formatRelativeVerifiedTime,
  groupDiagnosticFindings,
  impactTextForFinding,
  matchesQuickFixToFinding,
  resolveSelectedFindingKey,
  type DiagnosticFinding,
} from "../diagnostics-panel-display";
import {
  buildDiagnosticsQuickFixCards,
  copyDiagnosticsBundlePath,
  refreshDiagnosticsData,
} from "../diagnostics-panel-actions";

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
    credentialBackend?: ExplicitProfileCredentialBackend | null;
  }) => void;
}) {
  const queryClient = useQueryClient();
  const {
    useProfileMutation,
    activateWorkspaceTargetMutation,
    mutationLock,
  } =
    useDesktopActions();
  const lastCommandResults = useLastCommandResults();
  const readEnabled = useMutationAwareQueryEnabled();
  const doctor = useQuery({
    queryKey: DESKTOP_QUERY_KEYS.doctor,
    queryFn: runDoctor,
    enabled: readEnabled,
  });
  const verify = useQuery({
    queryKey: DESKTOP_QUERY_KEYS.verify,
    queryFn: runVerify,
    enabled: readEnabled,
  });
  const repair = useQuery({
    queryKey: DESKTOP_QUERY_KEYS.repairDryRun,
    queryFn: () => runRepair({ apply: false, fixes: [] }),
    enabled: readEnabled,
  });
  const [bundleCopyMessage, setBundleCopyMessage] = useState("");
  const [selectedFindingKey, setSelectedFindingKey] = useState<string | null>(null);
  const [repairPlanOpen, setRepairPlanOpen] = useState(false);
  const [selectedSafeFixes, setSelectedSafeFixes] = useState<string[]>([]);
  const [toolbarMenuOpen, setToolbarMenuOpen] = useState(false);
  const [inspectorMenuOpen, setInspectorMenuOpen] = useState(false);
  const toolbarMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const inspectorMenuAnchorRef = useRef<HTMLButtonElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const compactLayout = useCompactLayout(rootRef, WIDE_PANEL_COMPACT_BREAKPOINT);
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false);
  const applyRepair = useMutation({
    mutationFn: (fixes: string[]) => runRepair({ apply: true, fixes }),
    onSuccess: async () => {
      setRepairPlanOpen(false);
      await invalidateDiagnosticDesktopQueries(queryClient);
    },
  });
  const exportBundle = useMutation({
    mutationFn: exportDiagnosticBundle,
  });
  const requestDiagnosticsRefresh = () =>
    void refreshDiagnosticsData(queryClient, doctor.refetch, verify.refetch, repair.refetch);

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
  const quickFixes = buildDiagnosticsQuickFixCards({
    snapshot,
    doctor: doctor.data,
    repair: repair.data,
    settings,
    toolCapabilities,
    handlers: {
      useProfile: useProfileMutation.mutate,
      activateWorkspaceTarget: activateWorkspaceTargetMutation.mutate,
      applyRepairFixes: (fixes) => applyRepair.mutate(fixes),
      onOpenSettings,
      onOpenContexts,
      onOpenProfileSetup,
    },
    onRefreshDiagnostics: requestDiagnosticsRefresh,
  });
  const findings = useMemo(
    () => buildDiagnosticFindings(issueCards, recentFailures, quickFixes, snapshot),
    [issueCards, recentFailures, quickFixes, snapshot],
  );
  const totalIssues = issueCards.length + recentFailures.length;
  const checkRows = useMemo(
    () => diagnosticCheckRows(summaryCards, snapshot),
    [snapshot, summaryCards],
  );
  useEffect(() => {
    const nextFindingKey = resolveSelectedFindingKey(selectedFindingKey, findings);
    if (nextFindingKey !== selectedFindingKey) {
      setSelectedFindingKey(nextFindingKey);
    }
  }, [findings, selectedFindingKey]);
  const selectedFinding =
    findings.find((finding) => finding.key === selectedFindingKey) ?? findings[0] ?? null;
  const findingGroups = useMemo(() => groupDiagnosticFindings(findings), [findings]);
  const passedChecks = useMemo(
    () => checkRows.filter((row) => row.status === "pass"),
    [checkRows],
  );
  const safeFixIds = useMemo(
    () => repairActions.map((action) => diagnosticRepairActionKey(action)),
    [repairActions],
  );
  const selectedFindingQuickFixes = useMemo(
    () => quickFixes.filter((fix) => matchesQuickFixToFinding(fix, selectedFinding)),
    [quickFixes, selectedFinding],
  );
  const primaryFindingFix =
    selectedFindingQuickFixes.find((fix) => fix.primary) ?? selectedFindingQuickFixes[0] ?? null;
  const secondaryFindingFixes = selectedFindingQuickFixes.filter((fix) => fix !== primaryFindingFix);
  const verifiedAt = Math.max(
    doctor.dataUpdatedAt || 0,
    verify.dataUpdatedAt || 0,
    repair.dataUpdatedAt || 0,
  );
  const verifiedLabel = formatRelativeVerifiedTime(verifiedAt);
  const diagnosticsSummary = buildDiagnosticsSummary(totalIssues, repairActions.length);
  const lastAppliedCount = Number(
    ((applyRepair.data?.result as {
      summary?: { actions_applied?: number };
    } | undefined)?.summary?.actions_applied ?? 0),
  );
  const exportedBundle = exportBundle.data;
  const diagnosticsStatusMessage = buildDiagnosticsStatusMessage({
    bundleCopyMessage,
    exportedBundle,
    exportErrorMessage: exportBundle.error
      ? exportBundle.error instanceof Error
        ? exportBundle.error.message
        : DIAGNOSTICS_PANEL_COPY.exportReportFailedMessage
      : undefined,
    appliedFixCount: applyRepair.data ? lastAppliedCount : undefined,
  });

  useEffect(() => {
    setSelectedSafeFixes(safeFixIds);
  }, [safeFixIds.join("|")]);

  const importCurrentLabel = primaryFindingFix?.importTarget
    ? supportsProfileImportMode(
        primaryFindingFix.importTarget.tool,
        toolCapabilities,
        DEFAULT_PROFILE_IMPORT_MODE,
      )
      ? DESKTOP_ACTION_COPY.importCurrentEllipsisLabel
      : DESKTOP_ACTION_COPY.openAccountSetupLabel
    : null;
  const {
    secondaryInspectorAction,
    overflowActions: inspectorOverflowActions,
  } = buildDiagnosticInspectorActions({
    selectedFinding,
    primaryFindingFix,
    secondaryFindingFixes,
    importCurrentLabel,
  });

  useEffect(() => {
    setInspectorMenuOpen(false);
  }, [selectedFindingKey]);

  useEffect(() => {
    if (!compactLayout) {
      setCompactInspectorOpen(false);
    }
  }, [compactLayout]);

  const showFindings = !compactLayout || !compactInspectorOpen;
  const showInspector = !compactLayout || compactInspectorOpen;

  function runInspectorAction(action: NonNullable<typeof secondaryInspectorAction>) {
    switch (action.kind) {
      case "quick_fix": {
        const fix = [primaryFindingFix, ...secondaryFindingFixes]
          .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
          .find((candidate) => diagnosticQuickFixKey(candidate) === action.quickFixKey);
        if (fix) {
          void fix.action();
        }
        return;
      }
      case "quick_fix_secondary":
        if (
          primaryFindingFix
          && primaryFindingFix.secondaryAction
          && diagnosticQuickFixKey(primaryFindingFix) === action.quickFixKey
        ) {
          void primaryFindingFix.secondaryAction.action();
        }
        return;
      case "import_current":
        if (!action.importTarget) {
          return;
        }
        onOpenProfileSetup({
          tool: action.importTarget.tool,
          mode: action.importFallbackMode ?? DEFAULT_PROFILE_IMPORT_MODE,
        });
        return;
      case "open_profile_details":
        if (!action.profileTarget) {
          return;
        }
        onOpenProfiles(action.profileTarget.tool, action.profileTarget.profile);
        return;
    }
  }

  return (
    <div ref={rootRef} className="diagnostics-screen screen-content">
      <div className="diagnostics-toolbar-row">
        <div className="button-row">
          <button
            className="primary-button"
            aria-label={DIAGNOSTICS_PANEL_COPY.verifyAgainAriaLabel}
            disabled={mutationLock.isBusy}
            onClick={requestDiagnosticsRefresh}
          >
            {DIAGNOSTICS_PANEL_COPY.verifyButtonLabel}
          </button>
          <button
            className="ghost-button"
            aria-label={DIAGNOSTICS_PANEL_COPY.reviewSafeFixesAriaLabel}
            onClick={() => setRepairPlanOpen(true)}
            disabled={applyRepair.isPending || !repairActions.length}
          >
            {applyRepair.isPending
              ? DIAGNOSTICS_PANEL_COPY.applyingRepairsLabel
              : DIAGNOSTICS_PANEL_COPY.reviewSafeFixesButtonLabel}
          </button>
          <div className="diagnostics-toolbar-menu-wrap">
            <button
              ref={toolbarMenuAnchorRef}
              className="ghost-button"
              type="button"
              aria-haspopup="menu"
              aria-expanded={toolbarMenuOpen}
              aria-label={DIAGNOSTICS_PANEL_COPY.diagnosticsActionsTriggerAriaLabel}
              onClick={() => setToolbarMenuOpen((open) => !open)}
            >
              •••
            </button>
            {toolbarMenuOpen ? (
              <AnchoredMenu
                anchorRef={toolbarMenuAnchorRef}
                className="profile-row-actions-menu"
                role="menu"
                aria-label={DIAGNOSTICS_PANEL_COPY.diagnosticsActionsAriaLabel}
              >
                <button
                  className="ghost-button"
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setToolbarMenuOpen(false);
                    exportBundle.mutate();
                  }}
                  disabled={exportBundle.isPending}
                >
                  {exportBundle.isPending
                    ? DIAGNOSTICS_PANEL_COPY.exportingReportLabel
                    : DIAGNOSTICS_PANEL_COPY.exportReportLabel}
                </button>
              </AnchoredMenu>
            ) : null}
          </div>
        </div>
      </div>

      <section className={`diagnostics-summary-strip ${totalIssues ? "diagnostics-summary-strip-warn" : "diagnostics-summary-strip-ok"}`}>
        <div className="diagnostics-summary-copy">
          <div className="diagnostics-summary-headline">
            <span className="diagnostics-summary-symbol" aria-hidden="true">
              {totalIssues ? "▲" : "✓"}
            </span>
            <strong>{diagnosticsSummary.title}</strong>
          </div>
          <p className="inline-note">{diagnosticsSummary.detail}</p>
        </div>
        <div className="diagnostics-summary-meta">
          <span className="overview-current-set-cell-label">Verified</span>
          <strong>{verifiedLabel}</strong>
        </div>
      </section>

      <SplitView
        className="diagnostics-master-detail"
        primaryClassName="diagnostics-findings-pane"
        secondaryClassName="diagnostics-inspector-pane"
        primary={showFindings ? (
          <section className="diagnostics-pane">
            {findings.length ? (
              <div
                className="diagnostics-findings-list"
                aria-label={DIAGNOSTICS_PANEL_COPY.findingsAriaLabel}
              >
                {findingGroups.map((group) => (
                  group.items.length ? (
                    <section key={group.id} className="diagnostics-finding-group">
                      <div className="diagnostics-finding-group-header">
                        <p className="card-kicker">{group.label}</p>
                        <span className="diagnostics-group-count">{group.items.length}</span>
                      </div>
                      <div className="stack-list">
                        {group.items.map((finding) => (
                          <button
                            key={finding.key}
                            type="button"
                            aria-label={diagnosticFindingAriaLabel(finding)}
                            aria-pressed={selectedFinding?.key === finding.key}
                            className={`list-row diagnostic-finding-row ${
                              selectedFinding?.key === finding.key ? "diagnostic-finding-row-selected" : ""
                            }`}
                            onClick={() => {
                              setSelectedFindingKey(finding.key);
                              if (compactLayout) {
                                setCompactInspectorOpen(true);
                              }
                            }}
                          >
                            <div className="diagnostic-finding-main">
                              <div className="diagnostic-finding-title">
                                <span className={`diagnostic-finding-symbol diagnostic-finding-symbol-${finding.status}`} aria-hidden="true">
                                  {finding.status === "fail" ? "⨯" : "▲"}
                                </span>
                                <strong>{finding.title}</strong>
                              </div>
                              <p className="inline-note">{finding.preview}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </section>
                  ) : null
                ))}
                {passedChecks.length ? (
                  <details className="diagnostics-passed-section">
                    <summary>{diagnosticsPassedChecksSummary(passedChecks.length)}</summary>
                    <div className="stack-list">
                      {passedChecks.map((row) => (
                        <div key={row.label} className="diagnostics-passed-row">
                          <strong>{row.label}</strong>
                          <p className="inline-note">{row.detail}</p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : (
              <div className="diagnostics-healthy-state">
                <span aria-hidden="true">✓</span>
                <h3>{DIAGNOSTICS_PANEL_COPY.healthyTitle}</h3>
                <p className="inline-note">
                  {DIAGNOSTICS_PANEL_COPY.healthyPrimaryDetail}
                </p>
                <p className="inline-note">
                  {DIAGNOSTICS_PANEL_COPY.verifiedPrefix} {verifiedLabel.toLowerCase()}
                </p>
                <div className="button-row">
                  <button
                    className="ghost-button"
                    aria-label={DIAGNOSTICS_PANEL_COPY.verifyAgainAriaLabel}
                    disabled={mutationLock.isBusy}
                    onClick={requestDiagnosticsRefresh}
                  >
                    {DIAGNOSTICS_PANEL_COPY.verifyAgainAriaLabel}
                  </button>
                </div>
              </div>
            )}
          </section>
        ) : null}
        secondary={showInspector ? (
          <aside className="diagnostics-pane diagnostics-inspector-surface">
            {selectedFinding ? (
              <>
                <header className="diagnostics-pane-header diagnostics-inspector-header">
                  <div>
                    {compactLayout ? (
                      <button
                        className="ghost-button diagnostics-inspector-back"
                        type="button"
                        onClick={() => setCompactInspectorOpen(false)}
                      >
                        {DIAGNOSTICS_PANEL_COPY.inspectorBackLabel}
                      </button>
                    ) : null}
                    <h3>{selectedFinding.title}</h3>
                    <p className={`diagnostics-inspector-status diagnostics-inspector-status-${selectedFinding.status}`}>
                      <span aria-hidden="true">{selectedFinding.status === "fail" ? "⨯" : "▲"}</span>
                      <span>{diagnosticInspectorStatusLabel(selectedFinding.status)}</span>
                    </p>
                  </div>
                </header>
                <section className="diagnostics-inspector-section">
                  <p className="card-kicker">{DIAGNOSTICS_PANEL_COPY.inspectorWhatHappenedKicker}</p>
                  <p className="inline-note">{normalizeRuntimeLanguage(selectedFinding.preview)}</p>
                  {selectedFinding.lines.slice(1, 2).map((line) => (
                    <p key={line} className="inline-note">{normalizeRuntimeLanguage(line)}</p>
                  ))}
                </section>
                <section className="diagnostics-inspector-section">
                  <p className="card-kicker">{DIAGNOSTICS_PANEL_COPY.inspectorImpactKicker}</p>
                  <p className="inline-note">{impactTextForFinding(selectedFinding)}</p>
                </section>
                <section className="diagnostics-inspector-section">
                  <p className="card-kicker">{DIAGNOSTICS_PANEL_COPY.inspectorRecommendedActionKicker}</p>
                  <p className="inline-note">
                    {primaryFindingFix?.detail ??
                      selectedFinding.remediation[0] ??
                      DIAGNOSTICS_PANEL_COPY.inspectorRecommendedActionFallback}
                  </p>
                </section>
                {primaryFindingFix || secondaryInspectorAction || inspectorOverflowActions.length ? (
                  <div className="button-row diagnostics-inspector-actions">
                    {primaryFindingFix ? (
                      <button
                        className={primaryFindingFix.primary ? "primary-button" : "ghost-button"}
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={primaryFindingFix.action}
                      >
                        {primaryFindingFix.label}
                      </button>
                    ) : null}
                    {secondaryInspectorAction ? (
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={mutationLock.isBusy}
                        onClick={() => runInspectorAction(secondaryInspectorAction)}
                      >
                        {secondaryInspectorAction.label}
                      </button>
                    ) : null}
                    {inspectorOverflowActions.length ? (
                      <div className="profile-row-actions" data-profile-row-actions>
                        <button
                          ref={inspectorMenuAnchorRef}
                          className="ghost-button profile-row-actions-trigger profile-row-actions-trigger-visible"
                          type="button"
                          aria-label={DIAGNOSTICS_PANEL_COPY.inspectorOverflowTriggerAriaLabel}
                          aria-expanded={inspectorMenuOpen}
                          onClick={() => setInspectorMenuOpen((open) => !open)}
                        >
                          •••
                        </button>
                        {inspectorMenuOpen ? (
                          <AnchoredMenu
                            anchorRef={inspectorMenuAnchorRef}
                            className="profile-row-actions-menu"
                            align="start"
                            boundaryAttribute="data-profile-row-actions"
                            containmentSelector=".diagnostics-inspector-surface"
                            role="menu"
                            aria-label={DIAGNOSTICS_PANEL_COPY.inspectorOverflowMenuAriaLabel}
                          >
                            {inspectorOverflowActions.map((action) => (
                              <button
                                key={action.key}
                                type="button"
                                role="menuitem"
                                disabled={mutationLock.isBusy}
                                onClick={() => {
                                  setInspectorMenuOpen(false);
                                  runInspectorAction(action);
                                }}
                              >
                                {action.label}
                              </button>
                            ))}
                          </AnchoredMenu>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <details className="diagnostics-disclosure">
                  <summary>{DIAGNOSTICS_PANEL_COPY.evidenceSummary}</summary>
                  <div className="stack-list">
                    {selectedFinding.lines.map((line) => (
                      <p key={line} className="inline-note">{normalizeRuntimeLanguage(line)}</p>
                    ))}
                  </div>
                </details>
                <details className="diagnostics-disclosure">
                  <summary>{DIAGNOSTICS_PANEL_COPY.technicalDetailsSummary}</summary>
                  <div className="stack-list">
                    <p className="inline-note">{DIAGNOSTICS_PANEL_COPY.technicalDetailsIntro}</p>
                    <pre className="diagnostics-command-block">
{diagnosticTechnicalCommandBlock(primaryFindingFix?.label)}
                    </pre>
                    {selectedFinding.remediation.length ? (
                      <div className="stack-list">
                        {selectedFinding.remediation.map((item) => (
                          <code key={item}>{item}</code>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </details>
              </>
            ) : (
              <div className="diagnostics-healthy-state diagnostics-healthy-state-compact">
                <span aria-hidden="true">✓</span>
                <h3>{DIAGNOSTICS_PANEL_COPY.healthyTitle}</h3>
                <p className="inline-note">
                  {DIAGNOSTICS_PANEL_COPY.healthyCompactDetail}
                </p>
              </div>
            )}
          </aside>
        ) : null}
      />
      {repairPlanOpen ? (
        <DialogSurface
          ariaLabel={DIAGNOSTICS_PANEL_COPY.repairPlanDialogAriaLabel}
          className="quick-switch-palette profile-sheet"
          initialFocusSelector="button:not([disabled])"
          onClose={() => setRepairPlanOpen(false)}
        >
            <div className="quick-switch-header">
              <div>
                <p className="card-kicker">{DIAGNOSTICS_PANEL_COPY.repairPlanKicker}</p>
                <h3>{DIAGNOSTICS_PANEL_COPY.repairPlanTitle}</h3>
                <p className="inline-note">
                  {diagnosticsRepairPlanSummary(repairActions.length)}
                </p>
              </div>
              <button className="ghost-button" type="button" onClick={() => setRepairPlanOpen(false)}>
                {DIAGNOSTICS_PANEL_COPY.repairPlanCloseLabel}
              </button>
            </div>
            {repairActions.length ? (
              <div className="stack-list">
                {repairActions.map((action) => (
                  <label key={`sheet-${action.title}-${action.detail}`} className="diagnostics-safe-fix-row">
                    <input
                      type="checkbox"
                      checked={selectedSafeFixes.includes(diagnosticRepairActionKey(action))}
                      onChange={(event) =>
                        setSelectedSafeFixes((current) =>
                          event.target.checked
                            ? [...current, diagnosticRepairActionKey(action)]
                            : current.filter(
                                (item) => item !== diagnosticRepairActionKey(action),
                              ),
                        )
                      }
                    />
                    <div>
                      <strong>{action.title}</strong>
                      <p className="inline-note">{action.detail}</p>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="diagnostics-sheet-empty">
                <h3>{DIAGNOSTICS_PANEL_COPY.repairPlanEmptyTitle}</h3>
                <p className="inline-note">
                  {DIAGNOSTICS_PANEL_COPY.repairPlanEmptyDetail}
                </p>
              </div>
            )}
            <footer className="quick-switch-footer">
              <div className="quick-switch-selection">
                <p className="card-kicker">{DIAGNOSTICS_PANEL_COPY.repairPlanSelectionKicker}</p>
                <strong>{diagnosticsRepairSelectionLabel(selectedSafeFixes.length)}</strong>
                <p>{DIAGNOSTICS_PANEL_COPY.repairPlanSelectionDetail}</p>
              </div>
              <div className="button-row">
                <button className="ghost-button" type="button" onClick={() => setRepairPlanOpen(false)}>
                  {DIAGNOSTICS_PANEL_COPY.repairPlanCancelLabel}
                </button>
                <button
                  className="primary-button"
                  aria-label={DIAGNOSTICS_PANEL_COPY.applySafeFixesAriaLabel}
                  type="button"
                  disabled={!selectedSafeFixes.length || applyRepair.isPending}
                  onClick={() =>
                    applyRepair.mutate(buildSelectedRepairFixes(selectedSafeFixes, repairActions))
                  }
                >
                  {diagnosticsApplyRepairsLabel(selectedSafeFixes.length, applyRepair.isPending)}
                </button>
              </div>
            </footer>
        </DialogSurface>
      ) : null}
      {diagnosticsStatusMessage ? (
        <div className="diagnostics-footer-line">
          <p className={`inline-note ${exportBundle.error ? "diagnostics-footer-line-error" : ""}`}>
            {diagnosticsStatusMessage}
          </p>
          {exportedBundle ? (
            <button
              className="ghost-button"
              type="button"
              onClick={() =>
                void copyDiagnosticsBundlePath(exportedBundle.path, setBundleCopyMessage)
              }
            >
              {DIAGNOSTICS_PANEL_COPY.copyReportPathLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
